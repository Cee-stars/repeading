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

/** 置き場の設定。鍵は capability（知っている人だけが読み書きできる）。 */
export interface SyncSettings {
  endpoint: string;
  key: string;
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
