import { describe, expect, it } from 'vitest';
import {
  collectPhrases,
  longPhrases,
  phraseWordCount,
  toSentences,
  videoSwitches,
} from '../phrases';
import type { Material } from '../material';
import type { WordEntry } from '../words';

function material(over: Partial<Material> & Pick<Material, 'id' | 'title'>): Material {
  return {
    videoId: `vid-${over.id}`,
    sentences: [],
    hardIds: [],
    resumeSentenceId: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const morning = material({
  id: 'm1',
  title: '朝のニュース',
  videoId: 'aaa',
  updatedAt: 2000,
  sentences: [
    { id: 0, start: 0, end: 3, text: 'He could not put up with the noise any longer.' },
    { id: 1, start: 3, end: 5, text: 'She left.' },
    { id: 2, start: 5, end: 9, text: 'They looked forward to the weekend every single week.' },
  ],
  hardIds: [0],
});

const story = material({
  id: 'm2',
  title: '短編を読む',
  videoId: 'bbb',
  updatedAt: 1000,
  sentences: [
    { id: 0, start: 1, end: 4, text: 'The wind had been blowing all through the night.' },
    { id: 1, start: 4, end: 6, text: 'Nobody moved.' },
  ],
  hardIds: [1],
});

function word(over: Partial<WordEntry> & Pick<WordEntry, 'word' | 'context' | 'from'>): WordEntry {
  return { count: 1, firstAt: 0, lastAt: 0, ...over };
}

describe('collectPhrases', () => {
  it('collects the sentences marked as hard', () => {
    const phrases = collectPhrases([morning], []);

    expect(phrases).toHaveLength(1);
    expect(phrases[0].text).toContain('put up with');
    expect(phrases[0].reasons).toEqual(['hard']);
  });

  it('keeps the original video and timings so it plays in the real voice', () => {
    const phrases = collectPhrases([morning], []);

    expect(phrases[0].videoId).toBe('aaa');
    expect(phrases[0].start).toBe(0);
    expect(phrases[0].end).toBe(3);
    expect(phrases[0].materialTitle).toBe('朝のニュース');
  });

  it('also collects the sentences where a word was looked up', () => {
    const words = [
      word({
        word: 'look forward to',
        context: 'They looked forward to the weekend every single week.',
        from: '朝のニュース',
      }),
    ];
    const phrases = collectPhrases([morning], words);

    expect(phrases.map((p) => p.sentenceId).sort()).toEqual([0, 2]);
    expect(phrases.find((p) => p.sentenceId === 2)!.reasons).toEqual(['looked-up']);
  });

  it('records both reasons when a sentence is hard and was looked up', () => {
    const words = [
      word({
        word: 'put up with',
        context: 'He could not put up with the noise any longer.',
        from: '朝のニュース',
      }),
    ];
    const phrases = collectPhrases([morning], words);

    // 行は増えない。
    expect(phrases).toHaveLength(1);
    expect(phrases[0].reasons.sort()).toEqual(['hard', 'looked-up']);
  });

  it('matches a looked-up sentence even if the spacing differs', () => {
    const words = [
      word({
        word: 'weekend',
        context: '  They looked forward to   the weekend every single week. ',
        from: '朝のニュース',
      }),
    ];

    expect(collectPhrases([morning], words)).toHaveLength(2);
  });

  it('uses the recorded material name when the same sentence is in two materials', () => {
    const shared = 'Nobody moved.';
    const a = material({
      id: 'a',
      title: 'A',
      videoId: 'v-a',
      updatedAt: 9,
      sentences: [{ id: 0, start: 0, end: 1, text: shared }],
    });
    const b = material({
      id: 'b',
      title: 'B',
      videoId: 'v-b',
      updatedAt: 8,
      sentences: [{ id: 0, start: 7, end: 8, text: shared }],
    });

    const phrases = collectPhrases([a, b], [word({ word: 'moved', context: shared, from: 'B' })]);

    expect(phrases).toHaveLength(1);
    expect(phrases[0].videoId).toBe('v-b');
    expect(phrases[0].start).toBe(7);
  });

  it('skips a looked-up sentence whose material is gone', () => {
    // 教材を消しても単語の記録は残る。再生できないものは出さない。
    const words = [word({ word: 'gone', context: 'A sentence from a deleted material.', from: 'X' })];

    expect(collectPhrases([morning], words)).toHaveLength(1);
  });

  it('keeps phrases from the same video together', () => {
    const phrases = collectPhrases([morning, story], []);

    // 動画をまたぐたびに読み込み直すので、まとめて並べる。
    expect(videoSwitches(phrases)).toBe(1);
    expect(phrases.map((p) => p.videoId)).toEqual(['aaa', 'bbb']);
  });

  it('orders by time inside one material', () => {
    const many = { ...morning, hardIds: [2, 0] };
    const phrases = collectPhrases([many], []);

    expect(phrases.map((p) => p.start)).toEqual([0, 5]);
  });

  it('returns nothing when nothing has been marked or looked up', () => {
    expect(collectPhrases([{ ...morning, hardIds: [] }], [])).toEqual([]);
    expect(collectPhrases([], [])).toEqual([]);
  });
});

describe('longPhrases', () => {
  it('drops the short ones', () => {
    const phrases = collectPhrases([{ ...morning, hardIds: [0, 1, 2] }], []);
    const long = longPhrases(phrases);

    // 「She left.」は 2 語なので落ちる。
    expect(phrases).toHaveLength(3);
    expect(long).toHaveLength(2);
    expect(long.every((p) => phraseWordCount(p) >= 8)).toBe(true);
  });

  it('takes the threshold as an argument', () => {
    const phrases = collectPhrases([{ ...morning, hardIds: [0, 1, 2] }], []);
    expect(longPhrases(phrases, 1)).toHaveLength(3);
  });
});

describe('toSentences', () => {
  it('numbers by position so the resume point survives refiltering', () => {
    // 元の文 id は教材ごとに重複しうる。位置なら一意になる。
    const phrases = collectPhrases([morning, story], []);
    const sentences = toSentences(phrases);

    expect(sentences.map((s) => s.id)).toEqual([0, 1]);
    expect(sentences[0].text).toBe(phrases[0].text);
    expect(sentences[0].start).toBe(phrases[0].start);
  });
});
