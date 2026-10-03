import { describe, expect, it } from 'vitest';
import { buildBackup, isMaterial, mergeMaterials, parseBackup } from '../backup';
import { createMaterial } from '../material';
import type { Material } from '../material';
import type { Sentence } from '../types';

const sentences: Sentence[] = [
  { id: 0, start: 0, end: 2, text: 'the sky is clear today.' },
  { id: 1, start: 2, end: 4, text: 'the wind is cold.' },
];

const material = (title: string, updatedAt: number): Material => ({
  ...createMaterial('abcdefghij1', title, sentences, 1000),
  id: `id-${title}`,
  updatedAt,
});

describe('isMaterial', () => {
  it('accepts a material this app produced', () => {
    expect(isMaterial(createMaterial('abcdefghij1', '朝の習慣', sentences))).toBe(true);
  });

  it('rejects anything with the wrong shape', () => {
    const base = createMaterial('abcdefghij1', '朝の習慣', sentences);

    expect(isMaterial(null)).toBe(false);
    expect(isMaterial('a string')).toBe(false);
    expect(isMaterial({ ...base, id: '' })).toBe(false);
    expect(isMaterial({ ...base, sentences: [{ id: 0, text: 'no timings' }] })).toBe(false);
    expect(isMaterial({ ...base, hardIds: ['0'] })).toBe(false);
    expect(isMaterial({ ...base, resumeSentenceId: 'first' })).toBe(false);
  });

  it('allows a material that has no resume position yet', () => {
    const base = createMaterial('abcdefghij1', '朝の習慣', sentences);
    expect(isMaterial({ ...base, resumeSentenceId: null })).toBe(true);
  });
});

describe('parseBackup', () => {
  const word = {
    word: 'reckon',
    count: 2,
    firstAt: 1000,
    lastAt: 2000,
    context: 'I reckon so.',
    from: '朝の習慣',
  };

  it('reads a file this app wrote', () => {
    const backup = buildBackup([material('朝の習慣', 2000)], [word]);
    const content = parseBackup(JSON.stringify(backup));

    expect(content.materials.map((m) => m.title)).toEqual(['朝の習慣']);
    expect(content.words.map((w) => w.word)).toEqual(['reckon']);
  });

  it('also reads a bare array of materials', () => {
    expect(parseBackup(JSON.stringify([material('買い物', 2000)])).materials).toHaveLength(1);
  });

  it('reads a file written before the word list existed', () => {
    // 版 1 の控えには words が無い。教材だけ取り込めればよい。
    const old = { app: 'repeading', version: 1, exportedAt: 0, materials: [material('古い', 1)] };
    const content = parseBackup(JSON.stringify(old));

    expect(content.materials).toHaveLength(1);
    expect(content.words).toEqual([]);
  });

  it('accepts a file that only has words in it', () => {
    const content = parseBackup(JSON.stringify({ app: 'repeading', words: [word] }));

    expect(content.materials).toEqual([]);
    expect(content.words).toHaveLength(1);
  });

  it('drops entries that are not materials or words, keeping the rest', () => {
    const backup = buildBackup([material('朝の習慣', 2000)], [word]);
    const mixed = {
      ...backup,
      materials: [...backup.materials, { id: 'broken' }],
      words: [...backup.words, { word: 'broken' }],
    };
    const content = parseBackup(JSON.stringify(mixed));

    expect(content.materials).toHaveLength(1);
    expect(content.words).toHaveLength(1);
  });

  it('explains what is wrong instead of failing silently', () => {
    expect(() => parseBackup('not json at all')).toThrow('形式');
    expect(() => parseBackup('{"app":"repeading"}')).toThrow('読み込める教材がありません');
    expect(() => parseBackup('[{"id":"broken"}]')).toThrow('読み込める教材がありません');
  });
});

describe('mergeMaterials', () => {
  it('keeps the newer side when the same material exists on both', () => {
    const older = { ...material('朝の習慣', 1000), resumeSentenceId: 0 };
    const newer = { ...material('朝の習慣', 5000), resumeSentenceId: 1 };

    // 別の端末で進めた続きを取り込む。古い進捗で上書きしない。
    expect(mergeMaterials([older], [newer])[0].resumeSentenceId).toBe(1);
    expect(mergeMaterials([newer], [older])[0].resumeSentenceId).toBe(1);
  });

  it('adds materials that are not here yet', () => {
    const result = mergeMaterials([material('朝の習慣', 1000)], [material('買い物', 2000)]);
    expect(result.map((m) => m.title)).toEqual(['買い物', '朝の習慣']);
  });

  it('orders by last updated, newest first', () => {
    const result = mergeMaterials(
      [material('古い', 1000), material('新しい', 9000)],
      [material('中くらい', 5000)],
    );

    expect(result.map((m) => m.title)).toEqual(['新しい', '中くらい', '古い']);
  });

  it('leaves the existing list alone when there is nothing to add', () => {
    const existing = [material('朝の習慣', 1000)];
    expect(mergeMaterials(existing, [])).toEqual(existing);
  });
});
