import { useEffect, useMemo, useState } from 'react';
import { SentenceList } from './SentenceList';
import { usePractice, DEFAULT_SETTINGS } from '../lib/usePractice';
import type { PracticeSettings } from '../lib/usePractice';
import { useYouTubePlayer } from '../lib/useYouTubePlayer';
import type { Sentence } from '../lib/types';

type Reveal = 'hidden' | 'hint' | 'shown';

const REVEAL_ORDER: Reveal[] = ['hidden', 'hint', 'shown'];
const REVEAL_LABELS: Record<Reveal, string> = {
  hidden: '隠す',
  hint: 'ヒント',
  shown: '表示',
};

const RATES = [0.5, 0.75, 1];
const REPEATS = [1, 2, 3];
const PAUSE_RATIOS = [0, 0.5, 1, 1.5, 2];

/** 各単語の 1 文字目だけ残す。思い出せないときの手がかり用。 */
function toHint(text: string): string {
  return text.replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, (word) =>
    word[0] + '·'.repeat(word.length - 1),
  );
}

interface Props {
  videoId: string;
  sentences: Sentence[];
  onBack: () => void;
}

export function PracticeView({ videoId, sentences, onBack }: Props) {
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [reveal, setReveal] = useState<Reveal>('hidden');

  const player = useYouTubePlayer(videoId);
  const practice = usePractice(sentences, player, settings);

  const current = sentences[practice.index];
  const displayText = useMemo(() => {
    if (!current) return '';
    if (reveal === 'shown') return current.text;
    if (reveal === 'hint') return toHint(current.text);
    return '';
  }, [current, reveal]);

  const update = <K extends keyof PracticeSettings>(key: K, value: PracticeSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const cycleReveal = () =>
    setReveal((prev) => REVEAL_ORDER[(REVEAL_ORDER.indexOf(prev) + 1) % REVEAL_ORDER.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 入力欄にフォーカスがあるときはショートカットを無効にする。
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const actions: Record<string, () => void> = {
        ' ': practice.toggle,
        ArrowRight: practice.next,
        ArrowLeft: practice.prev,
        ArrowUp: practice.replay,
        r: practice.replay,
        h: cycleReveal,
        Escape: practice.stop,
        s: () =>
          update(
            'playbackRate',
            RATES[(RATES.indexOf(settings.playbackRate) + 1) % RATES.length],
          ),
      };

      const action = actions[event.key] ?? actions[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [practice, settings.playbackRate]);

  return (
    <div className="practice">
      <header className="practice-head">
        <button type="button" className="ghost" onClick={onBack}>
          ← 教材を変える
        </button>
        <span className="counter">
          {practice.index + 1} / {sentences.length}
          {settings.repeatCount > 1 && (
            <span className="repeat-dots">
              {Array.from({ length: settings.repeatCount }, (_, i) => (
                <span key={i} className={i < practice.repeatsDone ? 'dot done' : 'dot'} />
              ))}
            </span>
          )}
        </span>
      </header>

      <div className="stage">
        <div className="video">
          <div ref={player.containerRef} className="video-frame" />
          {!player.ready && <div className="video-loading">プレーヤーを準備中…</div>}
        </div>

        <div className={`caption phase-${practice.phase}`}>
          <div className="phase-label">
            {practice.phase === 'listening' && '聞く'}
            {practice.phase === 'mimicking' && '真似る'}
            {practice.phase === 'idle' && 'スペースキーで開始'}
          </div>
          <p className={`caption-text reveal-${reveal}`}>
            {displayText || (reveal === 'hidden' ? '　' : '')}
          </p>
        </div>
      </div>

      <div className="controls">
        <button type="button" className="ghost" onClick={practice.prev} title="← 前の文">
          ◀︎
        </button>
        <button type="button" className="primary wide" onClick={practice.toggle}>
          {practice.phase === 'listening'
            ? '停止'
            : practice.phase === 'mimicking'
              ? '次へ進む'
              : '再生'}
        </button>
        <button type="button" className="ghost" onClick={practice.replay} title="R もう一度">
          ↻
        </button>
        <button type="button" className="ghost" onClick={practice.next} title="→ 次の文">
          ▶︎
        </button>
      </div>

      <div className="settings">
        <div className="setting">
          <span className="setting-label">速度</span>
          <div className="segmented">
            {RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                className={settings.playbackRate === rate ? 'on' : ''}
                onClick={() => update('playbackRate', rate)}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">繰り返し</span>
          <div className="segmented">
            {REPEATS.map((count) => (
              <button
                key={count}
                type="button"
                className={settings.repeatCount === count ? 'on' : ''}
                onClick={() => update('repeatCount', count)}
              >
                {count}回
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">真似る間</span>
          <div className="segmented">
            {PAUSE_RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                className={settings.pauseRatio === ratio ? 'on' : ''}
                onClick={() => update('pauseRatio', ratio)}
              >
                {ratio === 0 ? 'なし' : `${ratio}×`}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <span className="setting-label">字幕</span>
          <div className="segmented">
            {REVEAL_ORDER.map((mode) => (
              <button
                key={mode}
                type="button"
                className={reveal === mode ? 'on' : ''}
                onClick={() => setReveal(mode)}
              >
                {REVEAL_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <label className="setting checkbox">
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(e) => update('autoAdvance', e.target.checked)}
          />
          自動で次の文へ
        </label>
      </div>

      <SentenceList
        sentences={sentences}
        activeIndex={practice.index}
        onSelect={practice.jumpTo}
      />

      <p className="shortcuts">
        <kbd>Space</kbd> 再生 / 次へ　<kbd>←</kbd><kbd>→</kbd> 文の移動　<kbd>R</kbd> もう一度
        <kbd>H</kbd> 字幕　<kbd>S</kbd> 速度　<kbd>Esc</kbd> 停止
      </p>
    </div>
  );
}
