import { isMaterial, mergeMaterials } from './backup';
import type { Material } from './material';
import { isWordEntry, mergeWords, type WordEntry } from './words';

/** 置き場に預ける中身。書き出しファイルと同じものに、同期用の目印を足しただけ。 */
export interface SyncPayload {
  app: 'repeading';
  version: number;
  /** 最後に書き込んだ時刻。表示用で、突き合わせには使わない。 */
  updatedAt: number;
  materials: Material[];
  words: WordEntry[];
}

export const SYNC_VERSION = 1;

/** 自前の置き場（Cloudflare Workers）。鍵を知っている人だけが読み書きできる。 */
export interface WorkerSettings {
  kind: 'worker';
  endpoint: string;
  key: string;
}

/**
 * GitHub の非公開リポジトリに 1 ファイル置く方式。
 * 新しいアカウントもデプロイも要らない。ファイルの sha がそのまま版として使える。
 */
export interface GitHubSettings {
  kind: 'github';
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export type SyncSettings = WorkerSettings | GitHubSettings;

export const DEFAULT_PATH = 'repeading.json';

/** `owner/repo` でも GitHub の URL でも受ける。 */
export function parseRepo(raw: string): { owner: string; repo: string } | null {
  const text = raw.trim().replace(/\.git$/, '');
  if (!text) return null;

  // URL で貼られることが多いので、先に取り除く。
  const stripped = text.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/.exec(stripped);
  if (!match) return null;

  return { owner: match[1], repo: match[2] };
}

/** 置き場を人に見せるときの一行。設定画面に出す。 */
export function describeSettings(settings: SyncSettings): string {
  return settings.kind === 'github'
    ? `github.com/${settings.owner}/${settings.repo} の ${settings.path}`
    : settings.endpoint;
}

/** 画面から入ってきたままの、まだ確かめていない設定。 */
export type SyncDraft =
  | { kind: 'worker'; endpoint: string; key: string }
  | { kind: 'github'; repo: string; path: string; token: string };

export type Validated =
  | { ok: true; settings: SyncSettings }
  | { ok: false; error: string };

/** 鍵・トークンの最短。これより短いものは打ち間違いか、入れ忘れ。 */
const MIN_SECRET = 20;

/** 画面の入力を確かめて、置き場の設定に変える。通らなければ理由を返す。 */
export function validateDraft(draft: SyncDraft): Validated {
  if (draft.kind === 'worker') {
    const endpoint = normalizeEndpoint(draft.endpoint);
    if (!endpoint) return { ok: false, error: '置き場の URL が読み取れません（https で始まる必要があります）。' };

    const key = draft.key.trim();
    if (key.length < MIN_SECRET) return { ok: false, error: '同期キーが短すぎます。' };

    return { ok: true, settings: { kind: 'worker', endpoint, key } };
  }

  const repo = parseRepo(draft.repo);
  if (!repo) return { ok: false, error: 'リポジトリは owner/repo の形で入れてください。' };

  const token = draft.token.trim();
  if (token.length < MIN_SECRET) return { ok: false, error: 'トークンが短すぎます。貼り漏れていないか確かめてください。' };

  const path = (draft.path.trim() || DEFAULT_PATH).replace(/^\/+/, '');
  if (!path) return { ok: false, error: 'ファイル名を入れてください。' };

  return { ok: true, settings: { kind: 'github', owner: repo.owner, repo: repo.repo, path, token } };
}

/** 保存してあった設定を読み直す。形が変わっていれば捨てる。 */
export function reviveSettings(value: unknown): SyncSettings | null {
  if (!value || typeof value !== 'object') return null;
  const stored = value as Record<string, unknown>;

  const draft: SyncDraft =
    stored.kind === 'github'
      ? {
          kind: 'github',
          repo: `${stored.owner}/${stored.repo}`,
          path: typeof stored.path === 'string' ? stored.path : DEFAULT_PATH,
          token: typeof stored.token === 'string' ? stored.token : '',
        }
      : {
          // kind が無い古い保存は、自前の置き場として読む。
          kind: 'worker',
          endpoint: typeof stored.endpoint === 'string' ? stored.endpoint : '',
          key: typeof stored.key === 'string' ? stored.key : '',
        };

  const checked = validateDraft(draft);
  return checked.ok ? checked.settings : null;
}

/** 鍵の長さの下限。短いと総当たりで他人の棚に当たりうる。 */
export const KEY_LENGTH = 26;

// 紛らわしい字（0/O、1/I/L）を外した英数字。口頭やメモで写しても壊れない。
const KEY_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** 鍵を作る。推測できないことだけが安全性の根拠なので、乱数の質を落とさない。 */
export function generateKey(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('');
}

/** 置き場の URL を整える。受け付けられない形なら null。 */
export function normalizeEndpoint(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  // 鍵を平文で載せるので、暗号化されていない経路は受け付けない。
  if (url.protocol !== 'https:') return null;

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function isSyncPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SyncPayload>;
  return (
    Array.isArray(payload.materials) &&
    payload.materials.every(isMaterial) &&
    Array.isArray(payload.words) &&
    payload.words.every(isWordEntry)
  );
}

export function buildPayload(
  materials: Material[],
  words: WordEntry[],
  now = Date.now(),
): SyncPayload {
  return { app: 'repeading', version: SYNC_VERSION, updatedAt: now, materials, words };
}

/**
 * 中身の指紋。押す必要があるかを決めるのに使う。
 *
 * 件数だけでは、同じ数のまま中身が変わった場合を取りこぼす。
 * 教材は更新時刻、単語は回数と最終時刻まで含めれば、実用上の変化は拾える。
 */
export function signature(materials: Material[], words: WordEntry[]): string {
  const m = [...materials]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `${item.id}:${item.updatedAt}`)
    .join(',');

  const w = [...words]
    .sort((a, b) => a.word.localeCompare(b.word))
    .map((item) => `${item.word}:${item.count}:${item.lastAt}`)
    .join(',');

  return `${m}|${w}`;
}

export interface MergeResult {
  materials: Material[];
  words: WordEntry[];
  /** 手元に、置き場がまだ知らない変更があるか。あれば押す。 */
  shouldPush: boolean;
  /** 置き場に、手元がまだ知らない変更があったか。あれば書き戻す。 */
  shouldApply: boolean;
}

/**
 * 手元と置き場を突き合わせる。
 *
 * 単一の利用者が複数の端末で使う前提なので、項目ごとに新しい方を残せばよい。
 * 教材は updatedAt が新しい方、単語は回数の多い方（`mergeWords`）。
 * どちらの判断も書き出し・読み込みで既に使っているものを流用する。
 */
export function mergeWithRemote(
  local: { materials: Material[]; words: WordEntry[] },
  remote: SyncPayload | null,
): MergeResult {
  if (!remote) {
    return {
      materials: local.materials,
      words: local.words,
      // 置き場が空なら、手元に何かある場合だけ押す。
      shouldPush: local.materials.length > 0 || local.words.length > 0,
      shouldApply: false,
    };
  }

  const materials = mergeMaterials(local.materials, remote.materials);
  const words = mergeWords(local.words, remote.words);

  const merged = signature(materials, words);

  return {
    materials,
    words,
    shouldPush: merged !== signature(remote.materials, remote.words),
    shouldApply: merged !== signature(local.materials, local.words),
  };
}
