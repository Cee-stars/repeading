import { useCallback, useEffect, useRef, useState } from 'react';
import { resumeIndex } from './material';
import type { Sentence } from './types';
import type { YouTubePlayerApi } from './useYouTubePlayer';

/**
 * リピーディングの 1 周は 聞く → 理解する → 真似る。
 * 理解を挟まずに真似ると、音をなぞるだけで意味が入らない。
 */
export type Phase = 'idle' | 'listening' | 'understanding' | 'mimicking';

export interface PracticeSettings {
  /** 次の文へ進む前に同じ文を再生する回数。 */
  repeatCount: number;
  /** 意味を取るための間 = 文の長さ × この倍率。0 なら理解の段を飛ばす。 */
  understandRatio: number;
  /** 真似るための無音時間 = 文の長さ × この倍率。0 なら無音を挟まない。 */
  pauseRatio: number;
  /** 無音のあと自動で次の文へ進むか。 */
  autoAdvance: boolean;
  playbackRate: number;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  repeatCount: 1,
  understandRatio: 1,
  pauseRatio: 1,
  autoAdvance: true,
  playbackRate: 1,
};

/** 間が一瞬で終わって忙しなくならないための下限。 */
const MIN_PAUSE_MS = 400;

/** 区間を聞き終えたあとに挟む段。 */
export interface Gap {
  phase: 'understanding' | 'mimicking';
  waitMs: number;
}

/**
 * 聞き終えたあと、どの段をどれだけ挟むか。
 *
 * 順番が要。リピーディングは 聞く → 理解する → 真似る で、
 * 理解を飛ばして真似ると音をなぞるだけになる。
 * 倍率が 0 の段は落ちるので、どちらも 0 ならそのまま次へ進む。
 */
export function gapPlan(
  understandRatio: number,
  pauseRatio: number,
  spokenMs: number,
): Gap[] {
  const gaps: Gap[] = [];

  if (understandRatio > 0) {
    gaps.push({ phase: 'understanding', waitMs: Math.max(MIN_PAUSE_MS, spokenMs * understandRatio) });
  }
  if (pauseRatio > 0) {
    gaps.push({ phase: 'mimicking', waitMs: Math.max(MIN_PAUSE_MS, spokenMs * pauseRatio) });
  }

  return gaps;
}

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
  /** 間を待たずに次の段へ進むための関数。理解・真似のあいだだけ入っている。 */
  const skipRef = useRef<(() => void) | null>(null);
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
    skipRef.current = null;
    player.stop();
    setPhase('idle');
  }, [clearPause, player]);

  stopRef.current = stop;

  const handleSegmentEnd = useCallback(() => {
    const { repeatCount, autoAdvance, understandRatio, pauseRatio, playbackRate } =
      settingsRef.current;
    const sentence = sentencesRef.current[indexRef.current];
    if (!sentence) return;

    const done = repeatsRef.current + 1;
    repeatsRef.current = done;
    setRepeatsDone(done);

    // 体感の長さは再生速度で変わるので、実時間ベースで間を取る。
    const spokenMs = ((sentence.end - sentence.start) / playbackRate) * 1000;

    const proceed = () => {
      pauseTimerRef.current = null;
      skipRef.current = null;
      if (done < repeatCount) {
        playAtRef.current(indexRef.current, done);
      } else if (autoAdvance && indexRef.current + 1 < sentencesRef.current.length) {
        playAtRef.current(indexRef.current + 1, 0);
      } else {
        setPhase('idle');
      }
    };

    // 聞いたあとは、まず意味を取る段。ここで字幕が出て、語句も調べられる。
    const gaps = gapPlan(understandRatio, pauseRatio, spokenMs);

    const runGap = (step: number) => {
      pauseTimerRef.current = null;
      const gap = gaps[step];
      if (!gap) {
        proceed();
        return;
      }

      setPhase(gap.phase);
      // スペースキーはこれを呼ぶだけ。段ごとに分岐を書き足さずに済む。
      skipRef.current = () => runGap(step + 1);
      pauseTimerRef.current = window.setTimeout(() => runGap(step + 1), gap.waitMs);
    };

    runGap(0);
  }, []);

  const playAt = useCallback(
    (target: number, done: number) => {
      const sentence = sentencesRef.current[target];
      if (!sentence) return;

      clearPause();
      skipRef.current = null;
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
      return;
    }

    // 理解できた・真似し終わったので、残りの間を待たずに次の段へ。
    if (phase === 'understanding' || phase === 'mimicking') {
      clearPause();
      const skip = skipRef.current;
      skipRef.current = null;
      if (skip) skip();
      else setPhase('idle');
      return;
    }

    start();
  }, [phase, stop, clearPause, start]);

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
