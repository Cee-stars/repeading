import { useCallback, useEffect, useRef, useState } from 'react';
import { resumeIndex } from './material';
import type { Sentence } from './types';
import type { YouTubePlayerApi } from './useYouTubePlayer';

export type Phase = 'idle' | 'listening' | 'mimicking';

export interface PracticeSettings {
  /** 次の文へ進む前に同じ文を再生する回数。 */
  repeatCount: number;
  /** 真似るための無音時間 = 文の長さ × この倍率。0 なら無音を挟まない。 */
  pauseRatio: number;
  /** 無音のあと自動で次の文へ進むか。 */
  autoAdvance: boolean;
  playbackRate: number;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  repeatCount: 1,
  pauseRatio: 1,
  autoAdvance: true,
  playbackRate: 1,
};

/** 無音が一瞬で終わって忙しなくならないための下限。 */
const MIN_PAUSE_MS = 400;

export interface PracticeApi {
  index: number;
  phase: Phase;
  /** 現在の文をすでに再生した回数。 */
  repeatsDone: number;
  start: () => void;
  stop: () => void;
  /** 再生中なら停止、無音待ち中なら待たずに次へ、停止中なら再生。 */
  toggle: () => void;
  next: () => void;
  prev: () => void;
  replay: () => void;
  jumpTo: (index: number) => void;
}

export function usePractice(
  sentences: Sentence[],
  player: YouTubePlayerApi,
  settings: PracticeSettings,
  /** 再開したい文の id。教材を開き直したときに続きから始める。 */
  resumeSentenceId: number | null = null,
): PracticeApi {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [repeatsDone, setRepeatsDone] = useState(0);

  // コールバックの中から常に最新値を読むための参照。
  const indexRef = useRef(0);
  const repeatsRef = useRef(0);
  const settingsRef = useRef(settings);
  const sentencesRef = useRef(sentences);
  const pauseTimerRef = useRef<number | null>(null);
  const playAtRef = useRef<(index: number, repeatsDone: number) => void>(() => {});
  const resumeRef = useRef(resumeSentenceId);
  const stopRef = useRef<() => void>(() => {});

  settingsRef.current = settings;
  sentencesRef.current = sentences;
  resumeRef.current = resumeSentenceId;

  const clearPause = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearPause();
    player.stop();
    setPhase('idle');
  }, [clearPause, player]);

  stopRef.current = stop;

  const handleSegmentEnd = useCallback(() => {
    const { repeatCount, autoAdvance, pauseRatio, playbackRate } = settingsRef.current;
    const sentence = sentencesRef.current[indexRef.current];
    if (!sentence) return;

    const done = repeatsRef.current + 1;
    repeatsRef.current = done;
    setRepeatsDone(done);

    const proceed = () => {
      pauseTimerRef.current = null;
      if (done < repeatCount) {
        playAtRef.current(indexRef.current, done);
      } else if (autoAdvance && indexRef.current + 1 < sentencesRef.current.length) {
        playAtRef.current(indexRef.current + 1, 0);
      } else {
        setPhase('idle');
      }
    };

    if (pauseRatio <= 0) {
      proceed();
      return;
    }

    setPhase('mimicking');
    // 体感の長さは再生速度で変わるので、実時間ベースで無音を取る。
    const spokenMs = ((sentence.end - sentence.start) / playbackRate) * 1000;
    const waitMs = Math.max(MIN_PAUSE_MS, spokenMs * pauseRatio);
    pauseTimerRef.current = window.setTimeout(proceed, waitMs);
  }, []);

  const playAt = useCallback(
    (target: number, done: number) => {
      const sentence = sentencesRef.current[target];
      if (!sentence) return;

      clearPause();
      indexRef.current = target;
      repeatsRef.current = done;
      setIndex(target);
      setRepeatsDone(done);
      setPhase('listening');
      player.playRange(sentence.start, sentence.end, handleSegmentEnd);
    },
    [clearPause, handleSegmentEnd, player],
  );

  playAtRef.current = playAt;

  const start = useCallback(() => playAt(indexRef.current, 0), [playAt]);
  const replay = useCallback(() => playAt(indexRef.current, 0), [playAt]);
  const next = useCallback(
    () => playAt(Math.min(indexRef.current + 1, sentencesRef.current.length - 1), 0),
    [playAt],
  );
  const prev = useCallback(() => playAt(Math.max(indexRef.current - 1, 0), 0), [playAt]);
  const jumpTo = useCallback((target: number) => playAt(target, 0), [playAt]);

  const toggle = useCallback(() => {
    if (phase === 'listening') {
      stop();
    } else if (phase === 'mimicking') {
      // 真似し終わったので無音を待たずに進む。
      clearPause();
      const { repeatCount, autoAdvance } = settingsRef.current;
      if (repeatsRef.current < repeatCount) playAt(indexRef.current, repeatsRef.current);
      else if (autoAdvance) next();
      else setPhase('idle');
    } else {
      start();
    }
  }, [phase, stop, clearPause, playAt, next, start]);

  // 速度変更は再生中でも即反映する。
  useEffect(() => {
    player.setPlaybackRate(settings.playbackRate);
  }, [player, settings.playbackRate]);

  // 教材や練習範囲が差し替わったら、再開したい文の位置に戻して止める。
  // その文が新しい並びに無ければ（復習モードで絞られた等）先頭から。
  useEffect(() => {
    stopRef.current();
    const start = resumeIndex(sentences, resumeRef.current);
    indexRef.current = start;
    repeatsRef.current = 0;
    setIndex(start);
    setRepeatsDone(0);
  }, [sentences]);

  useEffect(() => clearPause, [clearPause]);

  return { index, phase, repeatsDone, start, stop, toggle, next, prev, replay, jumpTo };
}
