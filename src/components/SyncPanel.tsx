import { useState } from 'react';
import { DEFAULT_PATH, describeSettings, generateKey, type SyncDraft } from '../lib/sync';
import type { SyncApi } from '../lib/useSync';

const STATUS_LABELS: Record<SyncApi['status'], string> = {
  off: '使っていません',
  idle: '待機中',
  syncing: '同期中…',
  ok: '同期しました',
  error: '同期できませんでした',
};

type Backend = 'github' | 'worker';

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
  const [open, setOpen] = useState(false);
  const [backend, setBackend] = useState<Backend>('github');
  const [error, setError] = useState<string | null>(null);

  const [repo, setRepo] = useState('');
  const [path, setPath] = useState(DEFAULT_PATH);
  const [token, setToken] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [key, setKey] = useState('');

  const start = () => {
    const draft: SyncDraft =
      backend === 'github'
        ? { kind: 'github', repo, path, token }
        : { kind: 'worker', endpoint, key };
    setError(configure(draft));
  };

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
            教材と調べた単語が自動的に揃います。開いたとき、他の画面から戻ってきたとき、
            そして内容が変わったあとに走ります。
            {lastSyncedAt && ` 最後に合わせたのは ${formatTime(lastSyncedAt)}。`}
          </p>

          {message && <p className="hint warn">{message}</p>}

          <p className="hint sync-endpoint">{describeSettings(settings)}</p>

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
            置き場は自分で持つもので、費用は無料枠に収まります。
          </p>

          {!open ? (
            <div className="row">
              <button type="button" className="ghost" onClick={() => setOpen(true)}>
                同期を設定する
              </button>
            </div>
          ) : (
            <div className="sync-form">
              <div className="segmented">
                <button
                  type="button"
                  className={backend === 'github' ? 'on' : ''}
                  onClick={() => setBackend('github')}
                >
                  GitHub
                </button>
                <button
                  type="button"
                  className={backend === 'worker' ? 'on' : ''}
                  onClick={() => setBackend('worker')}
                >
                  自前の置き場
                </button>
              </div>

              {backend === 'github' ? (
                <>
                  <p className="hint">
                    <strong>非公開</strong>リポジトリを 1 つ作り、そこに同期用のファイルを 1 つ置きます。
                    新しいアカウントもデプロイも要りません。
                  </p>

                  <label htmlFor="sync-repo">リポジトリ</label>
                  <input
                    id="sync-repo"
                    type="text"
                    value={repo}
                    placeholder="owner/repeading-sync"
                    spellCheck={false}
                    onChange={(e) => setRepo(e.target.value)}
                  />
                  <p className="hint">
                    GitHub で空の<strong>非公開</strong>リポジトリを作って、その名前を入れます。
                    公開リポジトリにすると中身が誰にでも見えるので、必ず非公開に。
                  </p>

                  <label htmlFor="sync-path">ファイル名</label>
                  <input
                    id="sync-path"
                    type="text"
                    value={path}
                    spellCheck={false}
                    onChange={(e) => setPath(e.target.value)}
                  />

                  <label htmlFor="sync-token">アクセストークン</label>
                  <input
                    id="sync-token"
                    type="password"
                    value={token}
                    placeholder="github_pat_..."
                    spellCheck={false}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p className="hint">
                    GitHub の Settings → Developer settings → Personal access tokens →
                    <strong> Fine-grained tokens</strong> で作ります。対象は<strong>そのリポジトリだけ</strong>、
                    権限は <strong>Contents の Read and write</strong> だけで足ります。
                    期限が切れたら作り直して貼り直してください。
                  </p>
                </>
              ) : (
                <>
                  <p className="hint">
                    Cloudflare Workers に置き場を自分で立てる方式。作り方は
                    <code> worker/README.md</code> にあります。
                  </p>

                  <label htmlFor="sync-endpoint">置き場の URL</label>
                  <input
                    id="sync-endpoint"
                    type="text"
                    value={endpoint}
                    placeholder="https://repeading-sync.xxxx.workers.dev"
                    spellCheck={false}
                    onChange={(e) => setEndpoint(e.target.value)}
                  />

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
                </>
              )}

              <p className="hint">
                <strong>2 台目には、同じ設定をそのまま入れます。</strong>
                1 台目と同じ置き場を指していれば、中身が降りてきます。
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
