import type { Material } from './material';
import type { Sentence } from './types';

/** 書き出しファイルの形。version は将来の読み込み分岐のために持たせる。 */
export interface Backup {
  app: 'repeading';
  version: number;
  exportedAt: number;
  materials: Material[];
}

export const BACKUP_VERSION = 1;

function isSentence(value: unknown): value is Sentence {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<Sentence>;
  return (
    typeof s.id === 'number' &&
    typeof s.start === 'number' &&
    typeof s.end === 'number' &&
    typeof s.text === 'string'
  );
}

/** 読み込むのは人が触れるファイルなので、形を確かめてから受け入れる。 */
export function isMaterial(value: unknown): value is Material {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<Material>;
  return (
    typeof m.id === 'string' &&
    m.id !== '' &&
    typeof m.videoId === 'string' &&
    typeof m.title === 'string' &&
    Array.isArray(m.sentences) &&
    m.sentences.every(isSentence) &&
    Array.isArray(m.hardIds) &&
    m.hardIds.every((id) => typeof id === 'number') &&
    (m.resumeSentenceId === null || typeof m.resumeSentenceId === 'number') &&
    typeof m.createdAt === 'number' &&
    typeof m.updatedAt === 'number'
  );
}

export function buildBackup(materials: Material[], now = Date.now()): Backup {
  return { app: 'repeading', version: BACKUP_VERSION, exportedAt: now, materials };
}

/**
 * 書き出したファイルを読む。壊れていれば理由を添えて投げる。
 * 教材の配列だけの JSON も受け付ける（手で切り貼りされることを想定）。
 */
export function parseBackup(text: string): Material[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ファイルの形式が読み取れません。');
  }

  const list = Array.isArray(data)
    ? data
    : ((data as Partial<Backup> | null)?.materials ?? null);

  if (!Array.isArray(list)) throw new Error('教材が入っていないファイルです。');

  const materials = list.filter(isMaterial);
  if (!materials.length) throw new Error('読み込める教材がありませんでした。');

  return materials;
}

/**
 * 既存と読み込んだものを混ぜる。同じ id は更新が新しい方を残す。
 * 別の端末で進めた続きを取り込んでも、古い進捗で上書きしないため。
 */
export function mergeMaterials(existing: Material[], incoming: Material[]): Material[] {
  const byId = new Map(existing.map((m) => [m.id, m]));

  for (const material of incoming) {
    const current = byId.get(material.id);
    if (!current || material.updatedAt > current.updatedAt) byId.set(material.id, material);
  }

  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
