import type { Sentence } from './types';

/** 教材の手応え。すべて字幕そのものから出すので、外部に問い合わせない。 */
export interface Difficulty {
  /** 話す速さ（1 分あたりの語数）。無音は除いた、実際に喋っている時間で割る。 */
  wordsPerMinute: number;
  /** 1 文あたりの語数。真似るときに覚えておく量。 */
  wordsPerSentence: number;
  /**
   * Flesch Reading Ease を 0〜100 に収めた値。高いほどやさしい。
   * 素の式は 100 を超えることも負になることもあるが、
   * 「104 / 100」と出ると壊れて見えるので、表に出す前に丸める。
   */
  readingEase: number;
  /** 1（かなりやさしい）〜 5（難しい）。 */
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  words: number;
  /** 喋っている時間の合計（秒）。 */
  seconds: number;
}

export const LEVEL_LABELS: Record<Difficulty['level'], string> = {
  1: 'かなりやさしい',
  2: 'やさしい',
  3: 'ふつう',
  4: 'やや難しい',
  5: '難しい',
};

/**
 * 語の音節数を見積もる。母音のかたまりを数えるだけの近似。
 *
 * 辞書を持たずに済ませるための割り切り。`queue` や `fire` のような語は外すが、
 * 教材 1 本ぶんを平均すれば傾向は十分に出る。
 */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;

  const groups = clean.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  // 語末の e はたいてい読まない（`make`）。ただし `the` のように e しか母音が無い語は残す。
  if (clean.endsWith('e') && !clean.endsWith('le') && count > 1) count -= 1;

  return Math.max(1, count);
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((part) => /[a-zA-Z]/.test(part));
}

/**
 * Flesch Reading Ease。高いほどやさしい。
 * 90 以上でとてもやさしい、60 前後が標準的な文章、30 未満はかなり硬い。
 */
export function fleschReadingEase(
  wordCount: number,
  sentenceCount: number,
  syllableCount: number,
): number {
  if (!wordCount || !sentenceCount) return 0;
  return 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
}

/** 速さを 1〜5 に直す。リピーディングでは速さが一番効くので、幅を広めに取る。 */
function speedBand(wpm: number): number {
  if (wpm < 110) return 1;
  if (wpm < 140) return 2;
  if (wpm < 170) return 3;
  if (wpm < 200) return 4;
  return 5;
}

/** 文章そのものの硬さを 1〜5 に直す。 */
function textBand(readingEase: number): number {
  if (readingEase >= 80) return 1;
  if (readingEase >= 65) return 2;
  if (readingEase >= 50) return 3;
  if (readingEase >= 35) return 4;
  return 5;
}

/**
 * 字幕から教材の手応えを見積もる。
 *
 * 動画を外から見て難易度を当てるのは難しいが、字幕を貼った時点で材料は揃っている。
 * 速さは実際に喋っている時間で測る。間を含めると、ゆっくり喋る人と
 * 間が多い人の区別が付かなくなる。
 */
export function analyzeDifficulty(sentences: Sentence[]): Difficulty | null {
  if (!sentences.length) return null;

  let wordCount = 0;
  let syllableCount = 0;
  let seconds = 0;

  for (const sentence of sentences) {
    const parts = words(sentence.text);
    wordCount += parts.length;
    for (const part of parts) syllableCount += countSyllables(part);
    seconds += Math.max(0, sentence.end - sentence.start);
  }

  if (!wordCount || seconds <= 0) return null;

  const wordsPerMinute = (wordCount / seconds) * 60;
  const wordsPerSentence = wordCount / sentences.length;
  const rawEase = fleschReadingEase(wordCount, sentences.length, syllableCount);

  // 段階分けには素の値を使う。丸めるのは表に出す数字だけ。
  const score = speedBand(wordsPerMinute) * 0.65 + textBand(rawEase) * 0.35;
  const level = Math.min(5, Math.max(1, Math.round(score))) as Difficulty['level'];

  return {
    wordsPerMinute: Math.round(wordsPerMinute),
    wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    readingEase: Math.round(Math.min(100, Math.max(0, rawEase))),
    level,
    label: LEVEL_LABELS[level],
    words: wordCount,
    seconds: Math.round(seconds),
  };
}

/**
 * 速すぎる教材を今の設定でどう扱えるか、一言で返す。
 * 「難しい」で終わらせず、次の一手を示す。
 */
export function difficultyAdvice(difficulty: Difficulty): string {
  if (difficulty.level >= 4) {
    const slowed = Math.round(difficulty.wordsPerMinute * 0.75);
    return `速いので 0.75× にすると ${slowed} 語/分 相当になります。文が長いときは「文を編集」で分けられます。`;
  }
  if (difficulty.wordsPerSentence >= 14) {
    return '1 文が長めです。覚えきれないときは「文を編集」で区切ると真似やすくなります。';
  }
  if (difficulty.level <= 2) {
    return '余裕があれば「繰り返し 1 回」「真似る間 なし」にすると負荷を上げられます。';
  }
  return '';
}
