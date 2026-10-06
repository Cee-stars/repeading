import { isSyncPayload, type SyncPayload, type SyncSettings } from './sync';

/** 置き場にいま入っているもの。空なら payload は null。 */
export interface RemoteState {
  payload: SyncPayload | null;
  rev: string | null;
}

/** 失敗の理由を、そのまま画面に出せる日本語で持つ。 */
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

/** 回線が死んでいるときに、いつまでも待たされないための上限。 */
const TIMEOUT_MS = 15000;

async function request(
  settings: SyncSettings,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(settings.endpoint, {
      ...init,
      signal: controller.signal,
      headers: {
        ...init.headers,
        authorization: `Bearer ${settings.key}`,
      },
    });
  } catch (error) {
    // 中断・名前解決の失敗・CORS 拒否はすべてここに来る。区別が付かないので一括で説明する。
    throw new SyncError(
      controller.signal.aborted
        ? '置き場から応答がありませんでした。通信状況を確かめてください。'
        : '置き場に接続できませんでした。URL が正しいか確かめてください。',
    );
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // 本文が無い・壊れている場合は status だけで判断する。
  }

  if (response.status === 401) {
    throw new SyncError('同期キーが受け付けられませんでした。貼り直してください。');
  }
  if (response.status === 413) {
    throw new SyncError('データが大きすぎて預けられませんでした。');
  }

  return { status: response.status, body };
}

function toRemoteState(body: unknown): RemoteState {
  if (!body || typeof body !== 'object') return { payload: null, rev: null };

  const value = body as { payload?: unknown; rev?: unknown };
  const rev = typeof value.rev === 'string' ? value.rev : null;

  // 置き場の中身は人が触れる余地があるので、形を確かめてから受け入れる。
  // 読めないものが入っていたら、無いものとして扱い、手元の内容で上書きする。
  return { payload: isSyncPayload(value.payload) ? value.payload : null, rev };
}

export async function fetchRemote(settings: SyncSettings): Promise<RemoteState> {
  const { status, body } = await request(settings, { method: 'GET' });

  if (status !== 200) {
    throw new SyncError(`置き場が応答しませんでした（${status}）。`);
  }

  return toRemoteState(body);
}

export type PushResult =
  | { ok: true; rev: string }
  /** 別の端末が先に書いていた。返ってきた中身と突き合わせ直す。 */
  | { ok: false; remote: RemoteState };

export async function pushRemote(
  settings: SyncSettings,
  payload: SyncPayload,
  ifRev: string | null,
): Promise<PushResult> {
  const { status, body } = await request(settings, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload, ifRev }),
  });

  if (status === 409) {
    return { ok: false, remote: toRemoteState(body) };
  }

  if (status !== 200) {
    throw new SyncError(`置き場に書き込めませんでした（${status}）。`);
  }

  const rev = (body as { rev?: unknown } | null)?.rev;
  if (typeof rev !== 'string') {
    throw new SyncError('置き場からの応答が読み取れませんでした。');
  }

  return { ok: true, rev };
}
