import { describe, expect, it } from 'vitest';
import {
  analyzeDifficulty,
  countSyllables,
  difficultyAdvice,
  fleschReadingEase,
} from '../difficulty';
import type { Sentence } from '../types';

/** 語数と長さを指定して 1 文作る。速さの計算を確かめやすくするため。 */
function line(id: number, text: string, start: number, end: number): Sentence {
  return { id, start, end, text };
}

const SIMPLE = 'the cat sat on the mat and ran far away';
const HARD =
  'consequently the administration implemented considerable regulatory modifications affecting international distribution agreements significantly';

describe('countSyllables', () => {
  it('counts vowel groups', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('water')).toBe(2);
    expect(countSyllables('beautiful')).toBe(3);
  });

  it('drops the silent e at the end', () => {
    expect(countSyllables('make')).toBe(1);
    expect(countSyllables('hope')).toBe(1);
  });

  it('keeps the e when it is the only vowel', () => {
    expect(countSyllables('the')).toBe(1);
    expect(countSyllables('he')).toBe(1);
  });

  it('keeps the syllable in a -le ending', () => {
    expect(countSyllables('apple')).toBe(2);
    expect(countSyllables('little')).toBe(2);
  });

  it('never returns zero for a real word', () => {
    expect(countSyllables('rhythm')).toBeGreaterThanOrEqual(1);
  });

  it('ignores punctuation and anything with no letters', () => {
    expect(countSyllables('cat,')).toBe(1);
    expect(countSyllables('123')).toBe(0);
    expect(countSyllables('')).toBe(0);
  });
});

describe('fleschReadingEase', () => {
  it('scores short, one-syllable sentences as very easy', () => {
    // 10 語・1 文・10 音節。
    expect(fleschReadingEase(10, 1, 10)).toBeGreaterThan(90);
  });

  it('scores long sentences of long words as hard', () => {
    // 30 語・1 文・90 音節。
    expect(fleschReadingEase(30, 1, 90)).toBeLessThan(30);
  });

  it('returns zero rather than dividing by zero', () => {
    expect(fleschReadingEase(0, 0, 0)).toBe(0);
  });
});

describe('analyzeDifficulty', () => {
  it('measures speed against speaking time, not the whole timeline', () => {
    // 各 10 語を 5 秒で。間に 30 秒空いていても、速さは 120 語/分 のまま。
    const sentences = [line(0, SIMPLE, 0, 5), line(1, SIMPLE, 35, 40)];
    const result = analyzeDifficulty(sentences)!;

    expect(result.wordsPerMinute).toBe(120);
    expect(result.seconds).toBe(10);
    expect(result.words).toBe(20);
  });

  it('reports how much has to be held in memory per sentence', () => {
    const result = analyzeDifficulty([line(0, SIMPLE, 0, 5), line(1, SIMPLE, 5, 10)])!;
    expect(result.wordsPerSentence).toBe(10);
  });

  it('calls slow, plain speech easy', () => {
    // 10 語を 6 秒 = 100 語/分。
    const result = analyzeDifficulty([line(0, SIMPLE, 0, 6)])!;

    expect(result.level).toBeLessThanOrEqual(2);
    expect(result.label).toMatch(/やさしい/);
  });

  it('calls fast, dense speech hard', () => {
    // 12 語を 2.5 秒 = 288 語/分。
    const result = analyzeDifficulty([line(0, HARD, 0, 2.5)])!;

    expect(result.level).toBe(5);
    expect(result.label).toBe('難しい');
  });

  it('separates speed from wording: the same words read fast score higher', () => {
    const slow = analyzeDifficulty([line(0, SIMPLE, 0, 10)])!;
    const fast = analyzeDifficulty([line(0, SIMPLE, 0, 2)])!;

    expect(fast.wordsPerMinute).toBeGreaterThan(slow.wordsPerMinute);
    expect(fast.level).toBeGreaterThan(slow.level);
    // 言葉そのものは同じなので、読みやすさは変わらない。
    expect(fast.readingEase).toBe(slow.readingEase);
  });

  it('keeps the reported reading ease inside 0-100', () => {
    // 素の式は 100 を超える。「104 / 100」と出ると壊れて見えるので丸める。
    expect(fleschReadingEase(10, 1, 10)).toBeGreaterThan(100);
    expect(analyzeDifficulty([line(0, SIMPLE, 0, 6)])!.readingEase).toBe(100);

    // 下側も同じ。負の値は出さない。
    const dense = analyzeDifficulty([line(0, `${HARD} ${HARD}`, 0, 20)])!;
    expect(dense.readingEase).toBeGreaterThanOrEqual(0);
  });

  it('still bands by the true score, not the clamped one', () => {
    // 丸めた値だけを見ると、とてもやさしい文とふつうの文の区別が消える。
    const veryEasy = analyzeDifficulty([line(0, SIMPLE, 0, 6)])!;
    expect(veryEasy.readingEase).toBe(100);
    expect(veryEasy.level).toBeLessThanOrEqual(2);
  });

  it('gives nothing when there is nothing to measure', () => {
    expect(analyzeDifficulty([])).toBeNull();
    // 時間が無ければ速さは出せない。
    expect(analyzeDifficulty([line(0, SIMPLE, 5, 5)])).toBeNull();
    // 文字が無ければ語数が出せない。
    expect(analyzeDifficulty([line(0, '123 456', 0, 5)])).toBeNull();
  });
});

describe('difficultyAdvice', () => {
  it('tells you what 0.75x would feel like when it is too fast', () => {
    const fast = analyzeDifficulty([line(0, HARD, 0, 2.5)])!;
    const advice = difficultyAdvice(fast);

    expect(advice).toContain('0.75×');
    expect(advice).toContain(String(Math.round(fast.wordsPerMinute * 0.75)));
  });

  it('points at sentence editing when the sentences are long', () => {
    // 20 語を 9 秒 = 133 語/分。速さは普通だが 1 文が長い。
    const long = analyzeDifficulty([line(0, `${SIMPLE} ${SIMPLE}`, 0, 9)])!;

    expect(long.wordsPerSentence).toBeGreaterThanOrEqual(14);
    expect(difficultyAdvice(long)).toContain('文を編集');
  });

  it('suggests raising the load when it is easy', () => {
    const easy = analyzeDifficulty([line(0, SIMPLE, 0, 6)])!;
    expect(difficultyAdvice(easy)).toContain('負荷');
  });
});
