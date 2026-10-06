import type { Material } from './material';
import type { Sentence } from './types';
import type { WordEntry } from './words';

/** その文がフレーズ集に入った理由。 */
export type PhraseReason = 'hard' | 'looked-up';

/**
 * フレーズ集の 1 件。元の動画と区間を持ち続けるので、
 * 合成音声ではなく本物の音声でそのまま再生できる。
 */
export interface Phrase {
  /** 一意な鍵。教材 id と文 id の組。 */
  key: string;
  materialId: string;
  materialTitle: string;
  videoId: string;
  sentenceId: number;
  text: string;
  start: number;
  end: number;
  reasons: PhraseReason[];
}

/** 「長め」と見なす語数の下限。短い相づちを混ぜても練習にならない。 */
export const LONG_PHRASE_WORDS = 8;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 語数。長さで絞るのに使う。 */
export function phraseWordCount(phrase: Phrase): number {
  return phrase.text.split(/\s+/).filter((part) => /[a-zA-Z]/.test(part)).length;
}

/** 教材の並び順のまま、同じ動画の文が隣り合うように並べる。 */
function sortPhrases(phrases: Phrase[], materials: Material[]): Phrase[] {
  const order = new Map(materials.map((material, index) => [material.id, index]));

  // 動画をまたぐたびにプレーヤーを読み込み直すので、まとめておくと待ちが減る。
  return phrases.sort((a, b) => {
    const byMaterial = (order.get(a.materialId) ?? 0) - (order.get(b.materialId) ?? 0);
    return byMaterial !== 0 ? byMaterial : a.start - b.start;
  });
}

/**
 * 自分がつまずいた文を、全教材から集める。
 *
 * 「レベルに合う素材が見つからない」の答えになる。自分が真似られなかった文と、
 * 意味が取れなかった文だけなので、定義上そのときの自分のレベルに合っている。
 */
export function collectPhrases(materials: Material[], words: WordEntry[] = []): Phrase[] {
  const byKey = new Map<string, Phrase>();

  const add = (material: Material, sentence: Sentence, reason: PhraseReason) => {
    const key = `${material.id}:${sentence.id}`;
    const existing = byKey.get(key);

    if (existing) {
      // 苦手でもあり、語句を調べた文でもある、ということがある。
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }

    byKey.set(key, {
      key,
      materialId: material.id,
      materialTitle: material.title,
      videoId: material.videoId,
      sentenceId: sentence.id,
      text: sentence.text,
      start: sentence.start,
      end: sentence.end,
      reasons: [reason],
    });
  };

  for (const material of materials) {
    const hard = new Set(material.hardIds);
    for (const sentence of material.sentences) {
      if (hard.has(sentence.id)) add(material, sentence, 'hard');
    }
  }

  if (words.length) {
    // 単語側は教材 id を持たないので、残してある文そのもので突き合わせる。
    const index = new Map<string, { material: Material; sentence: Sentence }[]>();
    for (const material of materials) {
      for (const sentence of material.sentences) {
        const key = normalizeText(sentence.text);
        const hits = index.get(key);
        if (hits) hits.push({ material, sentence });
        else index.set(key, [{ material, sentence }]);
      }
    }

    for (const word of words) {
      const hits = index.get(normalizeText(word.context));
      if (!hits?.length) continue;
      // 同じ文が複数の教材にあるときは、記録された教材名で絞る。
      const hit = hits.find((candidate) => candidate.material.title === word.from) ?? hits[0];
      add(hit.material, hit.sentence, 'looked-up');
    }
  }

  return sortPhrases([...byKey.values()], materials);
}

/** 長めのものだけに絞る。短い文ばかりだと塊を保持する練習にならない。 */
export function longPhrases(phrases: Phrase[], minWords = LONG_PHRASE_WORDS): Phrase[] {
  return phrases.filter((phrase) => phraseWordCount(phrase) >= minWords);
}

/**
 * 練習ループに渡す形へ。id は並びの位置にする。
 * 元の文 id は教材ごとに重複しうるので、そのままでは再開位置の目印にできない。
 */
export function toSentences(phrases: Phrase[]): Sentence[] {
  return phrases.map((phrase, index) => ({
    id: index,
    start: phrase.start,
    end: phrase.end,
    text: phrase.text,
  }));
}

/** 動画が何回切り替わるか。読み込み直しの回数なので、並べ方の確認に使う。 */
export function videoSwitches(phrases: Phrase[]): number {
  let switches = 0;
  for (let i = 1; i < phrases.length; i++) {
    if (phrases[i].videoId !== phrases[i - 1].videoId) switches += 1;
  }
  return switches;
}
