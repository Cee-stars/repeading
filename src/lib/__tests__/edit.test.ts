import { describe, expect, it } from 'vitest';
import { mergeWithPrevious, nudgeBoundary, pruneHardIds, splitSentence } from '../edit';
import type { Sentence } from '../types';

const sentences: Sentence[] = [
  { id: 0, start: 0, end: 4, text: 'the sky is clear today' },
  { id: 1, start: 4, end: 8, text: 'the wind is cold' },
];

describe('splitSentence', () => {
  it('splits at the chosen word and keeps the original id on the first half', () => {
    const result = splitSentence(sentences, 0, 3);

    expect(result.map((s) => s.text)).toEqual([
      'the sky is',
      'clear today',
      'the wind is cold',
    ]);
    // 前半が元の id を保つので、苦手マークや再開位置が生き残る。
    expect(result[0].id).toBe(0);
    // 後半は未使用の id をもらう。
    expect(result[1].id).toBe(2);
  });

  it('splits the time by character share, leaving no gap', () => {
    const [head, tail] = splitSentence(sentences, 0, 3);

    expect(head.start).toBe(0);
    expect(tail.end).toBe(4);
    expect(head.end).toBe(tail.start);
    // 'the sky is' (10) / 'clear today' (11) → 10/21 の位置。
    expect(head.end).toBeCloseTo(4 * (10 / 21));
  });

  it('refuses a split that would produce an empty half', () => {
    expect(splitSentence(sentences, 0, 0)).toEqual(sentences);
    expect(splitSentence(sentences, 0, 5)).toEqual(sentences);
  });

  it('ignores an unknown id', () => {
    expect(splitSentence(sentences, 99, 1)).toEqual(sentences);
  });
});

describe('mergeWithPrevious', () => {
  it('joins the two sentences and spans both intervals', () => {
    expect(mergeWithPrevious(sentences, 1)).toEqual([
      { id: 0, start: 0, end: 8, text: 'the sky is clear today the wind is cold' },
    ]);
  });

  it('does nothing for the first sentence or an unknown id', () => {
    expect(mergeWithPrevious(sentences, 0)).toEqual(sentences);
    expect(mergeWithPrevious(sentences, 99)).toEqual(sentences);
  });

  it('round-trips with a split', () => {
    const split = splitSentence(sentences, 0, 3);
    const merged = mergeWithPrevious(split, split[1].id);

    expect(merged.map((s) => s.text)).toEqual(['the sky is clear today', 'the wind is cold']);
    expect(merged[0]).toMatchObject({ id: 0, start: 0, end: 4 });
  });
});

describe('nudgeBoundary', () => {
  it('moves the edge by the given amount', () => {
    expect(nudgeBoundary(sentences, 0, 'start', -0.5)[0].start).toBe(0);
    expect(nudgeBoundary(sentences, 1, 'start', -0.5)[1].start).toBe(3.5);
    expect(nudgeBoundary(sentences, 0, 'end', 0.5)[0].end).toBe(4.5);
  });

  it('never lets the interval collapse', () => {
    const tightened = nudgeBoundary(sentences, 0, 'start', 99)[0];
    expect(tightened.start).toBeCloseTo(tightened.end - 0.2);

    const shrunk = nudgeBoundary(sentences, 0, 'end', -99)[0];
    expect(shrunk.end).toBeCloseTo(shrunk.start + 0.2);
  });

  it('never moves the start before the video begins', () => {
    expect(nudgeBoundary(sentences, 0, 'start', -5)[0].start).toBe(0);
  });

  it('leaves the other sentences untouched', () => {
    expect(nudgeBoundary(sentences, 0, 'end', 0.5)[1]).toBe(sentences[1]);
  });
});

describe('pruneHardIds', () => {
  it('drops marks whose sentence no longer exists', () => {
    const merged = mergeWithPrevious(sentences, 1);
    expect(pruneHardIds([0, 1], merged)).toEqual([0]);
  });

  it('keeps marks that survived a split', () => {
    const split = splitSentence(sentences, 0, 3);
    expect(pruneHardIds([0, 1], split)).toEqual([0, 1]);
  });
});
