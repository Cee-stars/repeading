import { progressRatio, resumeIndex } from '../lib/material';
import type { Material } from '../lib/material';
import type { LibraryApi } from '../lib/useLibrary';

function formatDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

interface Props extends Pick<LibraryApi, 'materials' | 'status' | 'remove'> {
  onOpen: (material: Material) => void;
}

export function Library({ materials, status, remove, onOpen }: Props) {
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

  if (status === 'loading' || !materials.length) return null;

  return (
    <section className="library">
      <h2>保存した教材</h2>
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
    </section>
  );
}
