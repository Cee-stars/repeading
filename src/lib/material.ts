import type { Sentence } from './types';

/** 保存される教材 1 件。 */
export interface Material {
  id: string;
  videoId: string;
  title: string;
  sentences: Sentence[];
  /** 苦手として印を付けた文の id。復習モードで使う。 */
  hardIds: number[];
  /** 次に開いたとき再開する文の id。 */
  resumeSentenceId: number | null;
  createdAt: number;
  updatedAt: number;
}

const TITLE_MAX = 40;

/** 教材名の既定値。最初の文から作り、無ければ動画 ID で代用する。 */
export function deriveTitle(sentences: Sentence[], videoId: string): string {
  const first = sentences[0]?.text.trim();
  if (!first) return videoId;
  return first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX)}…` : first;
}

export function createMaterial(
  videoId: string,
  title: string,
  sentences: Sentence[],
  now = Date.now(),
): Material {
  return {
    id: crypto.randomUUID(),
    videoId,
    title: title.trim() || deriveTitle(sentences, videoId),
    sentences,
    hardIds: [],
    resumeSentenceId: sentences[0]?.id ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 苦手フラグを付け外しする。並びは常に昇順に保つ。 */
export function toggleHardId(hardIds: number[], id: number): number[] {
  return hardIds.includes(id)
    ? hardIds.filter((x) => x !== id)
    : [...hardIds, id].sort((a, b) => a - b);
}

/** 練習に流す文を選ぶ。復習モードでは苦手な文だけにする。 */
export function selectSentences(
  sentences: Sentence[],
  hardIds: number[],
  reviewOnly: boolean,
): Sentence[] {
  if (!reviewOnly) return sentences;
  const hard = new Set(hardIds);
  return sentences.filter((s) => hard.has(s.id));
}

/** 再開位置を配列上の位置に直す。見つからなければ先頭。 */
export function resumeIndex(sentences: Sentence[], resumeSentenceId: number | null): number {
  if (resumeSentenceId === null) return 0;
  const index = sentences.findIndex((s) => s.id === resumeSentenceId);
  return index === -1 ? 0 : index;
}

/** 一覧に出す進捗（0〜1）。何文目まで来たかを全体に対する比で表す。 */
export function progressRatio(material: Material): number {
  if (!material.sentences.length) return 0;
  return (resumeIndex(material.sentences, material.resumeSentenceId) + 1) / material.sentences.length;
}
