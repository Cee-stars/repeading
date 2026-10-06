import { useEffect, useMemo, useRef, useState } from 'react';
import { CaptionWords } from './CaptionWords';
import { PracticeSettings } from './PracticeSettings';
import { TransportControls } from './TransportControls';
import { LONG_PHRASE_WORDS, longPhrases, toSentences, type Phrase } from '../lib/phrases';
import { usePractice } from '../lib/usePractice';
import { RATES, REVEAL_ORDER, useSettings } from '../lib/useSettings';
import { useYouTubePlayer } from '../lib/useYouTubePlayer';

/** 各単語の 1 文字目だけ残す。思い出せないときの手がかり用。 */
function toHint(text: string): string {
  return text.replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, (word) =>
    word[0] + '·'.repeat(word.length - 1),
  );
}

const REASON_LABELS = {
  hard: '苦手',
  'looked-up': '調べた',
} as const;

interface Props {
  phrases: Phrase[];
  onBack: () => void;
  lookedUp: Set<string>;
  onLookup: (phrase: string, context: string, from: string) => void;
}

/**
 * フレーズ集の練習。
 *
 * 教材を 1 本ずつ回すのではなく、全教材から集めた文を横断して流す。
 * 各文は元の動画と区間を持っているので、合成音声ではなく本物の音声で鳴る。
 */
export function PhrasePractice({ phrases, onBack, lookedUp, onLookup }: Props) {
  const { settings, update } = useSettings();
  const [longOnly, setLongOnly] = useState(false);

  const shown = useMemo(
    () => (longOnly ? longPhrases(phrases) : phrases),
    [phrases, longOnly],
  );
  const sentences = useMemo(() => toSentences(shown), [shown]);

  // いま流す文の動画。文が変わればここも変わる。
  const [videoId, setVideoId] = useState<string | null>(shown[0]?.videoId ?? null);
  const player = useYouTubePlayer(videoId);
  const practice = usePractice(sentences, player, settings, null);

  const current = shown[practice.index];

  // プレーヤーを作り直すと再生が落ちるので、準備でき次第もう一度鳴らす。
  const resumeAfterLoad = useRef(false);
  const replayRef = useRef(practice.replay);
  replayRef.current = practice.replay;

  useEffect(() => {
    if (!current || current.videoId === videoId) return;
    // 動画が変わる。いま鳴っていたなら、読み込みのあとに続きを鳴らす。
    resumeAfterLoad.current = practice.phase === 'listening';
    setVideoId(current.videoId);
  }, [current, videoId, practice.phase]);

  useEffect(() => {
    if (!player.ready || !resumeAfterLoad.current) return;
    resumeAfterLoad.current = false;
    replayRef.current();
  }, [player.ready]);

  const displayText = useMemo(() => {
    if (!current) return '';
    if (settings.reveal === 'shown') return current.text;
    if (settings.reveal === 'hint') return toHint(current.text);
    return '';
  }, [current, settings.reveal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const actions: Record<string, () => void> = {
        ' ': practice.toggle,
        ArrowRight: practice.next,
        ArrowLeft: practice.prev,
        ArrowUp: practice.replay,
        r: practice.replay,
        h: () =>
          update(
            'reveal',
            REVEAL_ORDER[(REVEAL_ORDER.indexOf(settings.reveal) + 1) % REVEAL_ORDER.length],
          ),
        Escape: practice.stop,
        s: () =>
          update('playbackRate', RATES[(RATES.indexOf(settings.playbackRate) + 1) % RATES.length]),
      };

      const action = actions[event.key] ?? actions[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="practice">
      <header className="practice-head">
        <button type="button" className="ghost" onClick={onBack}>
          ← 戻る
        </button>
        <div className="practice-head-right">
          <span className="counter">
            {shown.length ? practice.index + 1 : 0} / {shown.length}
            {settings.repeatCount > 1 && (
              <span className="repeat-dots">
                {Array.from({ length: settings.repeatCount }, (_, i) => (
                  <span key={i} className={i < practice.repeatsDone ? 'dot done' : 'dot'} />
                ))}
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="stage">
        <div className="video">
          <div ref={player.containerRef} className="video-frame" />

          {player.problem ? (
            <div className="video-problem">
              <p>{player.problem}</p>
              <button type="button" className="primary" onClick={player.retry}>
                もう一度試す
              </button>
            </div>
          ) : (
            !player.ready && <div className="video-loading">プレーヤーを準備中…</div>
          )}
        </div>

        <div className={`caption phase-${practice.phase}`}>
          <div className="caption-head">
            <div className="phase-label">
              {practice.phase === 'listening' && '聞く'}
              {practice.phase === 'understanding' && '理解する'}
              {practice.phase === 'mimicking' && '真似る'}
              {practice.phase === 'idle' && (
                <>
                  <span className="for-keyboard">スペースキーで開始</span>
                  <span className="for-touch">再生を押して開始</span>
                </>
              )}
            </div>

            {current && (
              <span className="phrase-origin">
                {current.reasons.map((reason) => (
                  <span key={reason} className="phrase-tag">
                    {REASON_LABELS[reason]}
                  </span>
                ))}
                <span className="phrase-source">{current.materialTitle}</span>
              </span>
            )}
          </div>

          {current && (settings.reveal === 'shown' || practice.phase === 'understanding') ? (
            // 理解する段では、設定にかかわらず全文を出す。意味を取るための段なので。
            <CaptionWords
              text={current.text}
              lookedUp={lookedUp}
              onLookup={(phrase, context) => onLookup(phrase, context, current.materialTitle)}
            />
          ) : (
            <p className={`caption-text reveal-${settings.reveal}`}>
              {!current
                ? '流せるフレーズがありません。長さの条件をゆるめてください。'
                : displayText || '　'}
            </p>
          )}

          {player.blocked && (
            <div className="blocked">
              <p className="hint">
                再生が始まりませんでした。この端末では、操作なしの再生が止められることがあります。
              </p>
              <button type="button" className="primary" onClick={practice.replay}>
                タップして続ける
              </button>
            </div>
          )}
        </div>
      </div>

      <TransportControls practice={practice} disabled={!current} />

      <PracticeSettings settings={settings} update={update}>
        <label className="setting checkbox">
          <input
            type="checkbox"
            checked={longOnly}
            onChange={(e) => setLongOnly(e.target.checked)}
          />
          長めのフレーズだけ
          <span className="setting-count">{LONG_PHRASE_WORDS} 語以上</span>
        </label>
      </PracticeSettings>

      <ul className="phrase-list">
        {shown.map((phrase, index) => (
          <li key={phrase.key}>
            <button
              type="button"
              className={index === practice.index ? 'phrase-row on' : 'phrase-row'}
              onClick={() => practice.jumpTo(index)}
            >
              <span className="phrase-text">{phrase.text}</span>
              <span className="phrase-meta">{phrase.materialTitle}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="shortcuts">
        <kbd>Space</kbd> 再生 / 次へ　<kbd>←</kbd><kbd>→</kbd> 移動　<kbd>R</kbd> もう一度
        <kbd>H</kbd> 字幕　<kbd>S</kbd> 速度　<kbd>Esc</kbd> 停止
      </p>
    </div>
  );
}
