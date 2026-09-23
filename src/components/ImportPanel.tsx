import { useMemo, useRef, useState } from 'react';
import { buildSentences } from '../lib/segment';
import { createMaterial, deriveTitle } from '../lib/material';
import { parseSubtitles } from '../lib/parseSubtitles';
import { formatTimestamp } from '../lib/time';
import { extractVideoId } from '../lib/youtubeUrl';
import type { Material } from '../lib/material';

const FORMAT_LABELS: Record<string, string> = {
  srt: 'SRT ファイル',
  vtt: 'WebVTT ファイル',
  'youtube-transcript': 'YouTube 文字起こし',
  'plain-text': 'タイムスタンプなしのテキスト',
};

interface Props {
  onStart: (material: Material) => void;
  /** 見出しの直後に差し込む内容（保存した教材の一覧）。 */
  children?: React.ReactNode;
}

export function ImportPanel({ onStart, children }: Props) {
  const [url, setUrl] = useState('');
  const [raw, setRaw] = useState('');
  const [title, setTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoId = useMemo(() => extractVideoId(url), [url]);
  const parsed = useMemo(() => (raw.trim() ? parseSubtitles(raw) : null), [raw]);
  const sentences = useMemo(() => (parsed ? buildSentences(parsed) : []), [parsed]);

  const canStart = Boolean(videoId) && sentences.length > 0 && parsed?.timed;

  const readFile = async (file: File) => setRaw(await file.text());

  return (
    <div className="panel">
      <header className="hero">
        <h1>Repeading</h1>
        <p>YouTube の字幕を一文ずつ区切って、聞いて、真似る。</p>
      </header>

      {children}

      <section className="field">
        <label htmlFor="url">1. 動画の URL</label>
        <input
          id="url"
          type="text"
          value={url}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
        />
        <p className={`hint ${url && !videoId ? 'warn' : ''}`}>
          {url && !videoId
            ? 'この URL からは動画 ID を読み取れませんでした。'
            : videoId
              ? `動画 ID: ${videoId}`
              : 'youtu.be / shorts / 動画 ID の直接入力にも対応しています。'}
        </p>
      </section>

      <section className="field">
        <label htmlFor="subs">2. 字幕</label>
        <p className="hint">
          YouTube の「…」→「文字起こしを表示」の内容を貼り付けてください。ページごとコピーしても、
          まわりの文章は自動で捨てます。SRT / VTT ファイルをここにドロップしても構いません。
        </p>
        <textarea
          id="subs"
          className={dragging ? 'dropping' : ''}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'0:00 here is the first line\n0:04 and here is the next one'}
          spellCheck={false}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
        />
        <div className="row">
          <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
            ファイルを選ぶ
          </button>
          {raw && (
            <button type="button" className="ghost" onClick={() => setRaw('')}>
              クリア
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </div>
      </section>

      {parsed && (
        <section className="preview">
          <div className="preview-head">
            <span className="badge">{FORMAT_LABELS[parsed.format]}</span>
            <span>{sentences.length} 文に分割</span>
          </div>

          {!parsed.timed && (
            <p className="hint warn">
              タイムスタンプが見つかりません。区間再生にはタイムスタンプ付きの字幕が必要です。
            </p>
          )}

          <ol className="preview-list">
            {sentences.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span className="time">{parsed.timed ? formatTimestamp(s.start) : '--:--'}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          {sentences.length > 5 && <p className="hint">…ほか {sentences.length - 5} 文</p>}

          {parsed.timed && sentences.length > 0 && (
            <div className="title-field">
              <label htmlFor="title">教材名</label>
              <input
                id="title"
                type="text"
                value={title}
                placeholder={deriveTitle(sentences, videoId ?? '')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className="primary"
        disabled={!canStart}
        onClick={() => videoId && onStart(createMaterial(videoId, title, sentences))}
      >
        練習を始める
      </button>
    </div>
  );
}
