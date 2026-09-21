import { describe, expect, it } from 'vitest';
import {
  createMaterial,
  deriveTitle,
  progressRatio,
  resumeIndex,
  selectSentences,
  toggleHardId,
} from '../material';
import type { Sentence } from '../types';

const sentences: Sentence[] = [
  { id: 0, start: 0, end: 2, text: 'the sky is clear today.' },
  { id: 1, start: 2, end: 4, text: 'the wind is cold.' },
  { id: 2, start: 4, end: 6, text: 'we should take a coat.' },
];

describe('deriveTitle', () => {
  it('names the material after its first sentence', () => {
    expect(deriveTitle(sentences, 'abcdefghij1')).toBe('the sky is clear today.');
  });

  it('truncates a long first sentence', () => {
    const long = [{ ...sentences[0], text: 'a'.repeat(60) }];
    const title = deriveTitle(long, 'abcdefghij1');

    expect(title).toHaveLength(41); // 40 文字 + 省略記号
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to the video id when there is no text', () => {
    expect(deriveTitle([], 'abcdefghij1')).toBe('abcdefghij1');
  });
});

describe('createMaterial', () => {
  it('fills in the defaults a new material needs', () => {
    const material = createMaterial('abcdefghij1', '', sentences, 1000);

    expect(material.title).toBe('the sky is clear today.');
    expect(material.hardIds).toEqual([]);
    expect(material.resumeSentenceId).toBe(0);
    expect(material.createdAt).toBe(1000);
    expect(material.updatedAt).toBe(1000);
    expect(material.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a title the user typed, trimmed', () => {
    expect(createMaterial('abcdefghij1', '  朝のニュース  ', sentences).title).toBe('朝のニュース');
  });
});

describe('toggleHardId', () => {
  it('adds and removes, keeping the order stable', () => {
    expect(toggleHardId([], 2)).toEqual([2]);
    expect(toggleHardId([2], 0)).toEqual([0, 2]);
    expect(toggleHardId([0, 2], 2)).toEqual([0]);
  });
});

describe('selectSentences', () => {
  it('passes everything through when review mode is off', () => {
    expect(selectSentences(sentences, [1], false)).toEqual(sentences);
  });

  it('keeps only the marked sentences in review mode', () => {
    expect(selectSentences(sentences, [0, 2], true).map((s) => s.id)).toEqual([0, 2]);
  });

  it('returns nothing when review mode is on but nothing is marked', () => {
    expect(selectSentences(sentences, [], true)).toEqual([]);
  });
});

describe('resumeIndex', () => {
  it('finds the saved sentence by id, not by position', () => {
    expect(resumeIndex(sentences, 2)).toBe(2);
    // 復習モードで絞られた並びでも、id さえ残っていれば追える。
    expect(resumeIndex(selectSentences(sentences, [1, 2], true), 2)).toBe(1);
  });

  it('falls back to the start when the sentence is gone', () => {
    expect(resumeIndex(sentences, 99)).toBe(0);
    expect(resumeIndex(sentences, null)).toBe(0);
  });
});

describe('progressRatio', () => {
  it('reports how far through the material the reader is', () => {
    const material = createMaterial('abcdefghij1', '', sentences);

    expect(progressRatio(material)).toBeCloseTo(1 / 3);
    expect(progressRatio({ ...material, resumeSentenceId: 2 })).toBe(1);
  });

  it('is zero for an empty material', () => {
    expect(progressRatio(createMaterial('abcdefghij1', 'から', []))).toBe(0);
  });
});
