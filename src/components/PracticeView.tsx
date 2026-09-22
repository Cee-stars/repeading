import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { SentenceList } from './SentenceList';
import {
  mergeWithPrevious,
  nudgeBoundary,
  pruneHardIds,
  splitPoints,
  splitSentence,
} from '../lib/edit';
import { selectSentences, toggleHardId } from '../lib/material';
import type { Material } from '../lib/material';
import { formatPreciseTimestamp } from '../lib/time';
import type { Sentence } from '../lib/types';
import { usePractice } from '../lib/usePractice';
import {
  PAUSE_RATIOS,
  RATES,
  REPEATS,
  REVEAL_ORDER,
  useSettings,
} from '../lib/useSettings';
import type { Reveal } from '../lib/useSettings';
import { useYouTubePlayer } from '../lib/useYouTubePlayer';

const REVEAL_LABELS: Record<Reveal, string> = {
  hidden: '隠す',
  hint: 'ヒント',
  shown: '表示',
};

/** 進捗を書き込むまでの待ち時間。文を移るたびに保存しにいかないための間引き。 */
const SAVE_DEBOUNCE_MS = 600;

/** 区間の端を 1 回でずらす量（秒）。自動字幕のずれはおおむねこの単位で直せる。 */
const NUDGE = 0.2;

/** 各単語の 1 文字目だけ残す。思い出せないときの手がかり用。 */
function toHint(text: string): string {
  return text.replace(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu, (word) =>
    word[0] + '·'.repeat(word.length - 1),
  );
}

interface Props {
  material: Material;
  onBack: () => void;
  onChange: (material: Material) => void;
}

export function PracticeView({ material, onBack, onChange }: Props) {
  const { settings, update } = useSettings();
  const [hardIds, setHardIds] = useState(material.hardIds);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [resumeId, setResumeId] = useState(material.resumeSentenceId);
  const [editing, setEditing] = useState(false);

  const sentences = useMemo(
    () => selectSentences(material.sentences, hardIds, reviewOnly),
    [material.sentences, hardIds, reviewOnly],
  );

  const player = useYouTubePlayer(material.videoId);
  const practice = usePractice(sentences, player, settings, resumeId);

  const current = sentences[practice.index];
  const currentId = current?.id;
  const isHard = currentId !== undefined && hardIds.includes(currentId);

  const displayText = useMemo(() => {
    if (!current) return '';
    if (settings.reveal === 'shown') return current.text;
    if (settings.reveal === 'hint') return toHint(current.text);
    return '';
  }, [current, settings.reveal]);

  // 練習中に進んだ位置を、保存する再開位置として持っておく。
  useEffect(() => {
    if (currentId !== undefined) setResumeId(currentId);
  }, [currentId]);

  const toggleHard = () => {
    if (currentId === undefined) return;
    setHardIds((previous) => toggleHardId(previous, currentId));
  };

  const cycleReveal = () =>
    update(
      'reveal',
      REVEAL_ORDER[(REVEAL_ORDER.indexOf(settings.reveal) + 1) % REVEAL_ORDER.length],
    );

  // 保存は最新の値だけ要るので、参照経由で読む。
  const latest = useRef({ material, hardIds, resumeId, onChange });
  latest.current = { material, hardIds, resumeId, onChange };

  const save = (patch: Partial<Material> = {}) => {
    const { material: base, hardIds: ids, resumeId: id, onChange: commit } = latest.current;
    commit({ ...base, hardIds: ids, resumeSentenceId: id, ...patch, updatedAt: Date.now() });
  };

  /** 文の並びを編集する。消えた文に付いていた印は落とす。 */
  const applyEdit = (next: Sentence[]) => {
    const kept = pruneHardIds(latest.current.hardIds, next);
    setHardIds(kept);
    save({ sentences: next, hardIds: kept });
  };

  const editCurrent = (next: (all: Sentence[], id: number) => Sentence[]) => {
    if (currentId === undefined) return;
    applyEdit(next(material.sentences, currentId));
  };

  const mounted = useRef(false);
  useEffect(() => {
    // 初回はまだ何も変わっていないので書かない。
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [hardIds, resumeId]);

  // 間引きの待ち時間中に画面を離れても取りこぼさないよう、離脱時にも書く。
  useEffect(() => () => save(), []);

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
        m: toggleHard,
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
          ← 教材を変える
        </button>
        <div className="practice-head-right">
          <button
            type="button"
            className={`ghost edit-toggle ${editing ? 'on' : ''}`}
            disabled={!current}
            onClick={() => {
              // 編集は全文の並びに対する操作なので、絞り込みは解いておく。
              if (!editing) setReviewOnly(false);
              setEditing((previous) => !previous);
            }}
          >
            {editing ? '編集を終える' : '文を編集'}
          </button>
          <span className="counter">
            {sentences.length ? practice.index + 1 : 0} / {sentences.length}
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
          {!player.ready && <div className="video-loading">プレーヤーを準備中…</div>}
        </div>

        <div className={`caption phase-${practice.phase}`}>
          <div className="caption-head">
            <div className="phase-label">
              {practice.phase === 'listening' && '聞く'}
              {practice.phase === 'mimicking' && '真似る'}
              {practice.phase === 'idle' && 'スペースキーで開始'}
            </div>
            <button
              type="button"
              className={`ghost mark ${isHard ? 'on' : ''}`}
              onClick={toggleHard}
              disabled={!current}
              title="M 苦手な文として印を付ける"
            >
              {isHard ? '★ 苦手' : '☆ 苦手'}
            </button>
          </div>
          <p className={`caption-text reveal-${settings.reveal}`}>
            {current
              ? displayText || '　'
              : '苦手な文がまだありません。★ を付けると、ここに集まります。'}
          </p>
        </div>

        {editing && current && (
          <div className="editor">
            <div className="editor-row">
              <button
                type="button"
                className="ghost"
                disabled={material.sentences[0]?.id === currentId}
                onClick={() => editCurrent(mergeWithPrevious)}
              >
                前の文とつなぐ
              </button>
              <button type="button" className="ghost" onClick={practice.replay}>
                試聴
              </button>
            </div>

            <div className="editor-row">
              <span className="setting-label">開始 {formatPreciseTimestamp(current.start)}</span>
              <div className="segmented">
                <button
                  type="button"
                  onClick={() => editCurrent((all, id) => nudgeBoundary(all, id, 'start', -NUDGE))}
                >
                  早める
                </button>
                <button
                  type="button"
                  onClick={() => editCurrent((all, id) => nudgeBoundary(all, id, 'start', NUDGE))}
                >
                  遅らせる
                </button>
              </div>

              <span className="setting-label">終了 {formatPreciseTimestamp(current.end)}</span>
              <div className="segmented">
                <button
                  type="button"
                  onClick={() => editCurrent((all, id) => nudgeBoundary(all, id, 'end', -NUDGE))}
                >
                  早める
                </button>
                <button
                  type="button"
                  onClick={() => editCurrent((all, id) => nudgeBoundary(all, id, 'end', NUDGE))}
                >
                  遅らせる
                </button>
              </div>
            </div>

            <p className="hint">区切りたい位置を押すと、そこで 2 つの文に分かれます。</p>
            <div className="split-words">
              {splitPoints(current.text).map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <button
                      type="button"
                      className="split-at"
                      title="ここで分割"
                      onClick={() => editCurrent((all, id) => splitSentence(all, id, i))}
                    >
                      ⁄
                    </button>
                  )}
                  <span className="split-word">{word}</span>
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <button type="button" className="ghost" onClick={practice.prev} title="← 前の文">
          ◀︎
        </button>
        <button type="button" className="primary wide" onClick={practice.toggle} disabled={!current}>
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
                className={settings.reveal === mode ? 'on' : ''}
                onClick={() => update('reveal', mode)}
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

        <label className={`setting checkbox ${hardIds.length ? '' : 'disabled'}`}>
          <input
            type="checkbox"
            checked={reviewOnly}
            disabled={!hardIds.length}
            onChange={(e) => setReviewOnly(e.target.checked)}
          />
          苦手な文だけ
          {hardIds.length > 0 && <span className="setting-count">{hardIds.length}</span>}
        </label>
      </div>

      <SentenceList
        sentences={sentences}
        activeIndex={practice.index}
        hardIds={hardIds}
        onSelect={practice.jumpTo}
      />

      <p className="shortcuts">
        <kbd>Space</kbd> 再生 / 次へ　<kbd>←</kbd><kbd>→</kbd> 文の移動　<kbd>R</kbd> もう一度
        <kbd>M</kbd> 苦手　<kbd>H</kbd> 字幕　<kbd>S</kbd> 速度　<kbd>Esc</kbd> 停止
      </p>
    </div>
  );
}
