import { describe, expect, it } from 'vitest';
import {
  byFrequency,
  byRecent,
  isWordEntry,
  mergeWords,
  recordLookup,
  type WordEntry,
} from '../words';

function entry(word: string, over: Partial<WordEntry> = {}): WordEntry {
  return { word, count: 1, firstAt: 1000, lastAt: 1000, context: 'a sentence', from: '教材', ...over };
}

describe('recordLookup', () => {
  it('records a word that has not been looked up before', () => {
    const words = recordLookup([], 'reckon', 'I reckon so.', '動画 A', 5000);

    expect(words).toHaveLength(1);
    expect(words[0]).toEqual({
      word: 'reckon',
      count: 1,
      firstAt: 5000,
      lastAt: 5000,
      context: 'I reckon so.',
      from: '動画 A',
    });
  });

  it('counts a repeat instead of adding a second row', () => {
    const first = recordLookup([], 'reckon', 'I reckon so.', '動画 A', 5000);
    const second = recordLookup(first, 'reckon', 'What do you reckon?', '動画 B', 9000);

    expect(second).toHaveLength(1);
    expect(second[0].count).toBe(2);
    // 初めて調べた時刻は残し、最後に調べた時刻だけ進める。
    expect(second[0].firstAt).toBe(5000);
    expect(second[0].lastAt).toBe(9000);
    // 文と出どころは、最後に出会ったほうが思い出しやすい。
    expect(second[0].context).toBe('What do you reckon?');
    expect(second[0].from).toBe('動画 B');
  });

  it('treats a sentence-initial capital as the same word', () => {
    // 字幕では文頭の語だけ大文字になる。別の語として二重に数えたくない。
    const words = recordLookup(recordLookup([], 'the', 'the end', 'A'), 'The', 'The end', 'A');

    expect(words).toHaveLength(1);
    expect(words[0].count).toBe(2);
    // 表記は先に見たものを保つ。
    expect(words[0].word).toBe('the');
  });

  it('moves the word just looked up to the front', () => {
    const words = recordLookup(
      [entry('old', { lastAt: 1 }), entry('reckon', { lastAt: 2 })],
      'old',
      'context',
      'A',
      3000,
    );

    expect(words.map((w) => w.word)).toEqual(['old', 'reckon']);
  });
});

describe('sorting', () => {
  const words = [
    entry('a', { count: 1, lastAt: 300 }),
    entry('b', { count: 9, lastAt: 100 }),
    entry('c', { count: 4, lastAt: 200 }),
  ];

  it('orders by when the word was last looked up', () => {
    expect(byRecent(words).map((w) => w.word)).toEqual(['a', 'c', 'b']);
  });

  it('orders by how often the word was looked up', () => {
    expect(byFrequency(words).map((w) => w.word)).toEqual(['b', 'c', 'a']);
  });

  it('does not reorder the array it was given', () => {
    byRecent(words);
    byFrequency(words);

    expect(words.map((w) => w.word)).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeWords', () => {
  it('keeps words that only one side has', () => {
    const merged = mergeWords([entry('here')], [entry('there')]);

    expect(merged.map((w) => w.word).sort()).toEqual(['here', 'there']);
  });

  it('does not double count when the same file is read twice', () => {
    const exported = [entry('reckon', { count: 3 })];

    // 同じ控えを二度取り込んでも 3 回のまま。足し算にすると回数が壊れる。
    expect(mergeWords(exported, exported)[0].count).toBe(3);
  });

  it('takes the wider range when two devices disagree', () => {
    const phone = [entry('reckon', { count: 2, firstAt: 500, lastAt: 900, context: '古い文' })];
    const pc = [entry('reckon', { count: 5, firstAt: 700, lastAt: 2000, context: '新しい文' })];

    const merged = mergeWords(phone, pc);

    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(5);
    expect(merged[0].firstAt).toBe(500);
    expect(merged[0].lastAt).toBe(2000);
    // 文は最後に調べたほうを採る。
    expect(merged[0].context).toBe('新しい文');
  });

  it('matches regardless of case', () => {
    expect(mergeWords([entry('The')], [entry('the')])).toHaveLength(1);
  });
});

describe('isWordEntry', () => {
  it('accepts a complete entry', () => {
    expect(isWordEntry(entry('reckon'))).toBe(true);
  });

  it('rejects anything that is missing a field or is not an object', () => {
    expect(isWordEntry(null)).toBe(false);
    expect(isWordEntry('reckon')).toBe(false);
    expect(isWordEntry({ ...entry('reckon'), count: '3' })).toBe(false);
    expect(isWordEntry({ ...entry('reckon'), word: '' })).toBe(false);
  });
});
