import type { Sentence } from './types';

/** 区間を詰めすぎて無音にならないための最小の長さ（秒）。 */
const MIN_DURATION = 0.2;

function nextId(sentences: Sentence[]): number {
  return sentences.reduce((max, s) => Math.max(max, s.id), -1) + 1;
}

/** 文を語単位で見たときの、分割できる位置の数（両端は含まない）。 */
export function splitPoints(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * 文を `wordIndex` 語目の手前で 2 つに割る。
 * 語ごとの時刻は持っていないので、境目の時刻は文字数の比で按分する。
 * 前半は元の id を保つので、苦手マークや再開位置はそのまま生き残る。
 */
export function splitSentence(sentences: Sentence[], id: number, wordIndex: number): Sentence[] {
  const index = sentences.findIndex((s) => s.id === id);
  if (index === -1) return sentences;

  const target = sentences[index];
  const words = splitPoints(target.text);
  if (wordIndex <= 0 || wordIndex >= words.length) return sentences;

  const head = words.slice(0, wordIndex).join(' ');
  const tail = words.slice(wordIndex).join(' ');
  const ratio = head.length / (head.length + tail.length);
  const boundary = target.start + (target.end - target.start) * ratio;

  return [
    ...sentences.slice(0, index),
    { id: target.id, start: target.start, end: boundary, text: head },
    { id: nextId(sentences), start: boundary, end: target.end, text: tail },
    ...sentences.slice(index + 1),
  ];
}

/** 文を 1 つ前の文とつなぐ。前の文の id を残すので、先頭側の印は保たれる。 */
export function mergeWithPrevious(sentences: Sentence[], id: number): Sentence[] {
  const index = sentences.findIndex((s) => s.id === id);
  if (index <= 0) return sentences;

  const previous = sentences[index - 1];
  const target = sentences[index];

  return [
    ...sentences.slice(0, index - 1),
    {
      id: previous.id,
      start: previous.start,
      end: target.end,
      text: `${previous.text} ${target.text}`,
    },
    ...sentences.slice(index + 1),
  ];
}

/**
 * 区間の端をずらす。自動字幕は時刻が甘く、頭が切れたり次の文を巻き込んだりするので、
 * 隣と重なること自体は許す。潰れないことだけを守る。
 */
export function nudgeBoundary(
  sentences: Sentence[],
  id: number,
  edge: 'start' | 'end',
  delta: number,
): Sentence[] {
  return sentences.map((sentence) => {
    if (sentence.id !== id) return sentence;

    if (edge === 'start') {
      const start = Math.min(Math.max(0, sentence.start + delta), sentence.end - MIN_DURATION);
      return { ...sentence, start };
    }

    const end = Math.max(sentence.end + delta, sentence.start + MIN_DURATION);
    return { ...sentence, end };
  });
}

/** 分割や結合で消えた文の印を落とす。 */
export function pruneHardIds(hardIds: number[], sentences: Sentence[]): number[] {
  const alive = new Set(sentences.map((s) => s.id));
  return hardIds.filter((id) => alive.has(id));
}
