import { useState } from 'react';
import { generateKey } from '../lib/sync';
import type { SyncApi } from '../lib/useSync';

const STATUS_LABELS: Record<SyncApi['status'], string> = {
  off: '使っていません',
  idle: '待機中',
  syncing: '同期中…',
  ok: '同期しました',
  error: '同期できませんでした',
};

function formatTime(time: number): string {
  return new Date(time).toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SyncPanel({
  settings,
  status,
  message,
  lastSyncedAt,
  configure,
  disable,
  syncNow,
}: SyncApi) {
  const [endpoint, setEndpoint] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const start = () => setError(configure(endpoint, key));

  return (
    <section className="sync">
      <div className="sync-head">
        <h2>
          端末間の同期
          <span className={`sync-badge sync-${status}`}>{STATUS_LABELS[status]}</span>
        </h2>
        {settings && (
          <button type="button" className="ghost" onClick={syncNow} disabled={status === 'syncing'}>
            今すぐ同期
          </button>
        )}
      </div>

      {settings ? (
        <>
          <p className="hint">
            教材と調べた単語が、この端末と置き場のあいだで自動的に揃います。
            開いたときと、他の画面から戻ってきたとき、そして内容が変わったあとに走ります。
            {lastSyncedAt && ` 最後に合わせたのは ${formatTime(lastSyncedAt)}。`}
          </p>

          {message && <p className="hint warn">{message}</p>}

          <p className="hint sync-endpoint">{settings.endpoint}</p>

          <div className="row">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (confirm('同期をやめますか？ 置き場の中身も、この端末の中身もそのまま残ります。')) {
                  disable();
                }
              }}
            >
              同期をやめる
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            置き場を 1 つ用意すると、PC と iPhone で同じ教材・同じ単語を使えます。
            置き場は自分で持つもので、鍵を知っている人だけが読み書きできます。
            費用は無料枠に収まります。
          </p>

          {!open ? (
            <div className="row">
              <button type="button" className="ghost" onClick={() => setOpen(true)}>
                同期を設定する
              </button>
            </div>
          ) : (
            <div className="sync-form">
              <label htmlFor="sync-endpoint">置き場の URL</label>
              <input
                id="sync-endpoint"
                type="text"
                value={endpoint}
                placeholder="https://repeading-sync.xxxx.workers.dev"
                spellCheck={false}
                onChange={(e) => setEndpoint(e.target.value)}
              />
              <p className="hint">
                置き場の作り方はリポジトリの <code>worker/README.md</code> にあります。
                Cloudflare の無料枠で、置くのは一度だけです。
              </p>

              <label htmlFor="sync-key">同期キー</label>
              <div className="row">
                <input
                  id="sync-key"
                  type="text"
                  value={key}
                  placeholder="26 文字の鍵"
                  spellCheck={false}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button type="button" className="ghost" onClick={() => setKey(generateKey())}>
                  鍵を作る
                </button>
              </div>
              <p className="hint">
                最初の端末で鍵を作り、<strong>同じ鍵を 2 台目にも貼ります</strong>。
                これが置き場を開ける唯一の手段なので、無くすと中身を取り出せません。
                人に渡さないでください。
              </p>

              {error && <p className="hint warn">{error}</p>}

              <div className="row">
                <button type="button" className="primary" onClick={start}>
                  同期を始める
                </button>
                <button type="button" className="ghost" onClick={() => setOpen(false)}>
                  やめる
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
