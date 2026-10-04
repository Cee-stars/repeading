import { useEffect, useMemo, useState } from 'react';
import { ASK_LIMIT, buildAskPrompt } from '../lib/askPrompt';
import { copyText } from '../lib/clipboard';
import { dictionaryUrl } from '../lib/dictionary';
import type { WordsApi } from '../lib/useWords';
import { byFrequency, byRecent } from '../lib/words';

const ORDERS = {
  recent: { label: '新しい順', sort: byRecent },
  frequent: { label: 'よく調べた順', sort: byFrequency },
} as const;

type Order = keyof typeof ORDERS;

function formatDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

interface Props extends Pick<WordsApi, 'words' | 'available' | 'remove' | 'clear'> {}

export function WordList({ words, available, remove, clear }: Props) {
  const [order, setOrder] = useState<Order>('recent');
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => ORDERS[order].sort(words), [words, order]);

  // 知らせは残し続けない。
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!available) return null;

  return (
    <section className="words">
      <div className="words-head">
        <h2>
          調べた単語
          {words.length > 0 && <span className="words-count">{words.length}</span>}
        </h2>

        {words.length > 1 && (
          <div className="segmented small">
            {(Object.keys(ORDERS) as Order[]).map((key) => (
              <button
                key={key}
                type="button"
                className={order === key ? 'on' : ''}
                onClick={() => setOrder(key)}
              >
                {ORDERS[key].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {words.length === 0 ? (
        <p className="hint">
          練習中に字幕の単語を押すと辞書が開き、その単語がここに残ります。
          何度も調べた単語は「よく調べた順」で上に出てきます。
        </p>
      ) : (
        <>
          <ul className="word-list">
            {sorted.map((entry) => (
              <li key={entry.word}>
                {/* ここから開き直すぶんは数えない。見直しで回数が増えると当てにならなくなる。 */}
                <a
                  className="word-entry"
                  href={dictionaryUrl(entry.word) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="word-headword">
                    {entry.word}
                    {entry.count > 1 && <span className="word-times">{entry.count}回</span>}
                  </span>
                  <span className="word-context">{entry.context}</span>
                  <span className="word-meta">
                    {entry.from} ・ {formatDate(entry.lastAt)}
                  </span>
                </a>
                <button
                  type="button"
                  className="ghost word-delete"
                  title={`${entry.word} を消す`}
                  aria-label={`${entry.word} を消す`}
                  onClick={() => void remove(entry.word)}
                >
                  消す
                </button>
              </li>
            ))}
          </ul>

          <div className="row">
            {/* アプリから AI を呼ぶと鍵の置き場所が要るので、呼ぶのは利用者に任せる。 */}
            <button
              type="button"
              className="ghost"
              title="調べた語句をまとめて尋ねる文をコピーします。Claude などに貼ってください。"
              onClick={async () => {
                const items = sorted.map((entry) => ({
                  word: entry.word,
                  context: entry.context,
                  count: entry.count,
                }));
                setCopied(await copyText(buildAskPrompt(items)));
              }}
            >
              {copied ? '✓ コピーしました' : 'まとめて AI に聞く'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (confirm(`調べた単語 ${words.length} 件をすべて消しますか？`)) void clear();
              }}
            >
              すべて消す
            </button>
          </div>

          {copied && (
            <p className="hint">
              Claude などに貼ると、意味・文法・使い分けがまとめて返ってきます。
              {words.length > ASK_LIMIT &&
                `（一度に貼れるのは ${ASK_LIMIT} 件までなので、${ORDERS[order].label}の上から ${ASK_LIMIT} 件を入れました）`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
