import { useRef, useState } from 'react';
import { buildBackup, parseBackup } from '../lib/backup';
import { progressRatio, resumeIndex } from '../lib/material';
import type { Material } from '../lib/material';
import type { LibraryApi } from '../lib/useLibrary';

function formatDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

/** 書き出したファイルを保存させる。 */
function download(materials: Material[]): void {
  const json = JSON.stringify(buildBackup(materials), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `repeading-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

interface Props extends Pick<LibraryApi, 'materials' | 'status' | 'persisted' | 'remove'> {
  onOpen: (material: Material) => void;
  onImport: (materials: Material[]) => Promise<number>;
}

export function Library({ materials, status, persisted, remove, onOpen, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  if (status === 'loading') return null;

  if (status === 'unavailable') {
    return (
      <section className="library">
        <h2>保存した教材</h2>
        <p className="hint warn">
          このブラウザでは教材を保存できません（プライベートモードなどで保存領域が使えない状態です）。
          取り込んで練習することはできます。
        </p>
      </section>
    );
  }

  const readFile = async (file: File) => {
    try {
      const count = await onImport(parseBackup(await file.text()));
      setMessage({ text: `${count} 件を読み込みました。`, error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : '読み込めませんでした。', error: true });
    }
  };

  return (
    <section className="library">
      <h2>保存した教材</h2>

      {materials.length > 0 ? (
        <ul className="library-list">
          {materials.map((material) => {
            const position = resumeIndex(material.sentences, material.resumeSentenceId) + 1;
            return (
              <li key={material.id}>
                <button type="button" className="library-open" onClick={() => onOpen(material)}>
                  <span className="library-title">{material.title}</span>
                  <span className="library-meta">
                    {position} / {material.sentences.length} 文
                    {material.hardIds.length > 0 && ` ・ 苦手 ${material.hardIds.length}`}
                    {` ・ ${formatDate(material.updatedAt)}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="ghost library-delete"
                  title={`${material.title} を削除`}
                  aria-label={`${material.title} を削除`}
                  onClick={() => {
                    if (confirm(`「${material.title}」を削除しますか？`)) void remove(material.id);
                  }}
                >
                  削除
                </button>
                <span
                  className="library-progress"
                  style={{ '--value': progressRatio(material) } as React.CSSProperties}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">
          まだありません。取り込んで練習を始めると、ここに残ります。
          別の端末で書き出したファイルを読み込むこともできます。
        </p>
      )}

      <div className="row">
        {materials.length > 0 && (
          <button type="button" className="ghost" onClick={() => download(materials)}>
            書き出す
          </button>
        )}
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          読み込む
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 同じファイルを続けて選べるよう、値を消しておく。
            e.target.value = '';
            if (file) void readFile(file);
          }}
        />
      </div>

      {message && <p className={`hint ${message.error ? 'warn' : ''}`}>{message.text}</p>}

      <p className="hint">
        教材はこのブラウザの中だけに保存され、期限を設けずに残ります。ただしブラウザ側の
        都合で消えることがあります（Safari は一定期間このサイトを開かないと保存を消します）。
        {persisted
          ? ' このブラウザでは保存領域の保持が許可されています。'
          : ' 大事な教材は書き出して控えを持っておくと確実です。'}
      </p>
    </section>
  );
}
