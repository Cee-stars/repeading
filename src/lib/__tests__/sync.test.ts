import { describe, expect, it } from 'vitest';
import {
  KEY_LENGTH,
  buildPayload,
  generateKey,
  isSyncPayload,
  mergeWithRemote,
  normalizeEndpoint,
  signature,
} from '../sync';
import { createMaterial } from '../material';
import type { Material } from '../material';
import type { Sentence } from '../types';
import type { WordEntry } from '../words';

const sentences: Sentence[] = [{ id: 0, start: 0, end: 2, text: 'the sky is clear today.' }];

function material(id: string, updatedAt: number, over: Partial<Material> = {}): Material {
  return { ...createMaterial('abcdefghij1', id, sentences, 1000), id, updatedAt, ...over };
}

function word(w: string, over: Partial<WordEntry> = {}): WordEntry {
  return { word: w, count: 1, firstAt: 1, lastAt: 1, context: 'a sentence', from: 'A', ...over };
}

describe('generateKey', () => {
  it('makes a key long enough that guessing it is hopeless', () => {
    expect(generateKey()).toHaveLength(KEY_LENGTH);
  });

  it('avoids characters that are easy to mistype', () => {
    // 0/O や 1/l が混ざると、手で写したときに壊れる。
    for (let i = 0; i < 20; i++) {
      expect(generateKey()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/);
    }
  });

  it('does not repeat itself', () => {
    const keys = new Set(Array.from({ length: 50 }, generateKey));
    expect(keys.size).toBe(50);
  });
});

describe('normalizeEndpoint', () => {
  it('keeps the origin and path, dropping trailing slashes', () => {
    expect(normalizeEndpoint('https://x.workers.dev/sync/')).toBe('https://x.workers.dev/sync');
    expect(normalizeEndpoint('  https://x.workers.dev  ')).toBe('https://x.workers.dev');
  });

  it('refuses anything not encrypted', () => {
    // 鍵をそのまま載せるので、http は通さない。
    expect(normalizeEndpoint('http://x.workers.dev')).toBeNull();
  });

  it('refuses what is not a URL at all', () => {
    expect(normalizeEndpoint('x.workers.dev')).toBeNull();
    expect(normalizeEndpoint('')).toBeNull();
  });
});

describe('signature', () => {
  it('changes when a material is edited', () => {
    const before = signature([material('a', 10)], []);
    const after = signature([material('a', 20)], []);

    expect(before).not.toBe(after);
  });

  it('changes when a word is looked up again', () => {
    const before = signature([], [word('reckon', { count: 1, lastAt: 5 })]);
    const after = signature([], [word('reckon', { count: 2, lastAt: 9 })]);

    expect(before).not.toBe(after);
  });

  it('ignores the order things happen to be in', () => {
    const a = signature([material('a', 10), material('b', 20)], [word('x'), word('y')]);
    const b = signature([material('b', 20), material('a', 10)], [word('y'), word('x')]);

    expect(a).toBe(b);
  });
});

describe('mergeWithRemote', () => {
  it('pushes everything when the shelf is still empty', () => {
    const result = mergeWithRemote({ materials: [material('a', 10)], words: [] }, null);

    expect(result.shouldPush).toBe(true);
    expect(result.shouldApply).toBe(false);
    expect(result.materials).toHaveLength(1);
  });

  it('does nothing when both sides are empty', () => {
    const result = mergeWithRemote({ materials: [], words: [] }, null);

    expect(result.shouldPush).toBe(false);
    expect(result.shouldApply).toBe(false);
  });

  it('keeps the newer side of the same material', () => {
    const older = material('a', 10, { resumeSentenceId: null });
    const newer = material('a', 99, { resumeSentenceId: 0 });

    // 別の端末で進めた続きを取り込む。古い進捗で上書きしない。
    const pulled = mergeWithRemote({ materials: [older], words: [] }, buildPayload([newer], []));
    expect(pulled.materials[0].updatedAt).toBe(99);
    expect(pulled.shouldApply).toBe(true);
    expect(pulled.shouldPush).toBe(false);

    const pushed = mergeWithRemote({ materials: [newer], words: [] }, buildPayload([older], []));
    expect(pushed.materials[0].updatedAt).toBe(99);
    expect(pushed.shouldPush).toBe(true);
    expect(pushed.shouldApply).toBe(false);
  });

  it('brings both sides together when each has something the other lacks', () => {
    const result = mergeWithRemote(
      { materials: [material('here', 10)], words: [word('here')] },
      buildPayload([material('there', 20)], [word('there')]),
    );

    expect(result.materials.map((m) => m.id).sort()).toEqual(['here', 'there']);
    expect(result.words.map((w) => w.word).sort()).toEqual(['here', 'there']);
    // 双方に相手の知らないものがあるので、書き戻しも押し出しも要る。
    expect(result.shouldApply).toBe(true);
    expect(result.shouldPush).toBe(true);
  });

  it('stays quiet when both sides already agree', () => {
    const local = { materials: [material('a', 10)], words: [word('reckon')] };
    const result = mergeWithRemote(local, buildPayload(local.materials, local.words));

    expect(result.shouldPush).toBe(false);
    expect(result.shouldApply).toBe(false);
  });

  it('does not double count a word that both sides saw', () => {
    const result = mergeWithRemote(
      { materials: [], words: [word('reckon', { count: 3, lastAt: 10 })] },
      buildPayload([], [word('reckon', { count: 3, lastAt: 10 })]),
    );

    expect(result.words[0].count).toBe(3);
    expect(result.shouldPush).toBe(false);
  });
});

describe('isSyncPayload', () => {
  it('accepts what this app wrote', () => {
    expect(isSyncPayload(buildPayload([material('a', 1)], [word('reckon')]))).toBe(true);
  });

  it('rejects anything with the wrong shape', () => {
    expect(isSyncPayload(null)).toBe(false);
    expect(isSyncPayload({ materials: [], words: [{ word: 'broken' }] })).toBe(false);
    expect(isSyncPayload({ materials: [{ id: 'broken' }], words: [] })).toBe(false);
  });
});
