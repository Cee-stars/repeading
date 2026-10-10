import {
  isSyncPayload,
  type GitHubSettings,
  type SyncPayload,
  type SyncSettings,
  type WorkerSettings,
} from './sync';

/** 置き場にいま入っているもの。空なら payload は null。 */
export interface RemoteState {
  payload: SyncPayload | null;
  /** 置き場ごとの「版」。worker は rev、GitHub はファイルの sha。 */
  rev: string | null;
}

/** 失敗の理由を、そのまま画面に出せる日本語で持つ。 */
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export type PushResult =
  | { ok: true; rev: string }
  /** 別の端末が先に書いていた。返ってきた中身と突き合わせ直す。 */
  | { ok: false; remote: RemoteState };

/** 回線が死んでいるときに、いつまでも待たされないための上限。 */
const TIMEOUT_MS = 15000;

const EMPTY: RemoteState = { payload: null, rev: null };

async function send(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    // 中断・名前解決の失敗・CORS 拒否はすべてここに来る。区別が付かないので一括で説明する。
    throw new SyncError(
      controller.signal.aborted
        ? '置き場から応答がありませんでした。通信状況を確かめてください。'
        : '置き場に接続できませんでした。設定を確かめてください。',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** 置き場の中身は人が触れる余地があるので、形を確かめてから受け入れる。 */
function acceptPayload(value: unknown): SyncPayload | null {
  return isSyncPayload(value) ? value : null;
}

// ---------------------------------------------------------------- 自前の置き場

function workerHeaders(settings: WorkerSettings): HeadersInit {
  return { authorization: `Bearer ${settings.key}` };
}

async function workerFetch(settings: WorkerSettings): Promise<RemoteState> {
  const response = await send(settings.endpoint, { headers: workerHeaders(settings) });

  if (response.status === 401) {
    throw new SyncError('同期キーが受け付けられませんでした。貼り直してください。');
  }
  if (response.status !== 200) {
    throw new SyncError(`置き場が応答しませんでした（${response.status}）。`);
  }

  const body = (await readJson(response)) as { payload?: unknown; rev?: unknown } | null;
  return {
    payload: acceptPayload(body?.payload),
    rev: typeof body?.rev === 'string' ? body.rev : null,
  };
}

async function workerPush(
  settings: WorkerSettings,
  payload: SyncPayload,
  ifRev: string | null,
): Promise<PushResult> {
  const response = await send(settings.endpoint, {
    method: 'PUT',
    headers: { ...workerHeaders(settings), 'content-type': 'application/json' },
    body: JSON.stringify({ payload, ifRev }),
  });

  const body = (await readJson(response)) as { payload?: unknown; rev?: unknown } | null;

  if (response.status === 409) {
    return {
      ok: false,
      remote: {
        payload: acceptPayload(body?.payload),
        rev: typeof body?.rev === 'string' ? body.rev : null,
      },
    };
  }
  if (response.status === 401) {
    throw new SyncError('同期キーが受け付けられませんでした。貼り直してください。');
  }
  if (response.status === 413) {
    throw new SyncError('データが大きすぎて預けられませんでした。');
  }
  if (response.status !== 200 || typeof body?.rev !== 'string') {
    throw new SyncError(`置き場に書き込めませんでした（${response.status}）。`);
  }

  return { ok: true, rev: body.rev };
}

// ------------------------------------------------------------------- GitHub

const GITHUB_API = 'https://api.github.com';

function contentsUrl(settings: GitHubSettings): string {
  const path = settings.path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`;
}

function githubHeaders(settings: GitHubSettings): HeadersInit {
  return {
    authorization: `Bearer ${settings.token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
}

/** btoa は 1 文字 1 バイトしか扱えない。日本語が入るので、先にバイト列へ落とす。 */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  // GitHub は改行入りで返してくる。
  const binary = atob(encoded.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function githubAuthError(status: number): SyncError {
  return new SyncError(
    status === 401
      ? 'トークンが受け付けられませんでした。期限が切れていないか確かめてください。'
      : 'リポジトリに手が届きませんでした。トークンの権限（Contents の読み書き）とリポジトリ名を確かめてください。',
  );
}

async function githubFetch(settings: GitHubSettings): Promise<RemoteState> {
  const response = await send(contentsUrl(settings), { headers: githubHeaders(settings) });

  // まだ一度も置いていない。
  if (response.status === 404) return EMPTY;
  if (response.status === 401 || response.status === 403) throw githubAuthError(response.status);
  if (response.status !== 200) {
    throw new SyncError(`リポジトリが応答しませんでした（${response.status}）。`);
  }

  const body = (await readJson(response)) as
    | { content?: unknown; sha?: unknown; size?: unknown }
    | null;

  const sha = typeof body?.sha === 'string' ? body.sha : null;

  // 1MB を超えるとこの API は中身を返さない。今の使い方では届かないが、黙って壊れないようにする。
  if (typeof body?.content !== 'string' || !body.content) {
    if (typeof body?.size === 'number' && body.size > 1_000_000) {
      throw new SyncError('同期ファイルが大きくなりすぎました。');
    }
    return { payload: null, rev: sha };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64(body.content));
  } catch {
    // 読めないものが入っていたら、無いものとして扱い、手元の内容で置き直す。
    return { payload: null, rev: sha };
  }

  return { payload: acceptPayload(parsed), rev: sha };
}

async function githubPush(
  settings: GitHubSettings,
  payload: SyncPayload,
  ifRev: string | null,
): Promise<PushResult> {
  const response = await send(contentsUrl(settings), {
    method: 'PUT',
    headers: { ...githubHeaders(settings), 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `Repeading 同期 ${new Date().toISOString()}`,
      content: toBase64(JSON.stringify(payload)),
      // 初回は sha を送らない。送ると「無いものを更新しようとした」で弾かれる。
      ...(ifRev ? { sha: ifRev } : {}),
    }),
  });

  // 409 は sha 不一致、422 は「既にあるのに sha が無い」。どちらも別の端末が先に書いた形。
  if (response.status === 409 || response.status === 422) {
    return { ok: false, remote: await githubFetch(settings) };
  }
  if (response.status === 401 || response.status === 403) throw githubAuthError(response.status);

  if (response.status !== 200 && response.status !== 201) {
    throw new SyncError(`リポジトリに書き込めませんでした（${response.status}）。`);
  }

  const body = (await readJson(response)) as { content?: { sha?: unknown } } | null;
  const sha = body?.content?.sha;
  if (typeof sha !== 'string') {
    throw new SyncError('書き込みの応答が読み取れませんでした。');
  }

  return { ok: true, rev: sha };
}

// ------------------------------------------------------------------ 振り分け

export function fetchRemote(settings: SyncSettings): Promise<RemoteState> {
  return settings.kind === 'github' ? githubFetch(settings) : workerFetch(settings);
}

export function pushRemote(
  settings: SyncSettings,
  payload: SyncPayload,
  ifRev: string | null,
): Promise<PushResult> {
  return settings.kind === 'github'
    ? githubPush(settings, payload, ifRev)
    : workerPush(settings, payload, ifRev);
}
