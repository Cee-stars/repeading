import { describe, expect, it } from 'vitest';
import { dedupeCues, endsSentence, overlapLength, segmentCues, segmentPlainText } from '../segment';
import type { Cue } from '../types';

describe('endsSentence', () => {
  it('treats real sentence endings as breaks', () => {
    expect(endsSentence('the wind is cold.')).toBe(true);
    expect(endsSentence('is the wind cold?')).toBe(true);
    expect(endsSentence('"the wind is cold."')).toBe(true);
    expect(endsSentence('風が冷たい。')).toBe(true);
  });

  it('does not break on abbreviations or initials', () => {
    expect(endsSentence('we met Dr.')).toBe(false);
    expect(endsSentence('signed by J.')).toBe(false);
    expect(endsSentence('the wind is cold')).toBe(false);
  });
});

describe('overlapLength', () => {
  it('finds the repeated tail of a rolling caption', () => {
    expect(overlapLength(['the', 'sky', 'is'], ['the', 'sky', 'is', 'clear'])).toBe(3);
  });

  it('ignores a single shared word that may be a genuine repetition', () => {
    expect(overlapLength(['it', 'is', 'very'], ['very', 'cold', 'today'])).toBe(0);
  });

  it('drops a cue that repeats the previous one entirely', () => {
    expect(overlapLength(['the', 'sky'], ['sky'])).toBe(1);
  });
});

describe('dedupeCues', () => {
  it('removes the overlap YouTube auto-captions scroll through', () => {
    const cues: Cue[] = [
      { start: 0, end: 2, text: 'the sky is' },
      { start: 1, end: 3, text: 'the sky is clear today' },
      { start: 3, end: 5, text: 'clear today and the wind is cold' },
    ];

    expect(dedupeCues(cues).map((c) => c.text)).toEqual([
      'the sky is',
      'clear today',
      'and the wind is cold',
    ]);
  });

  it('pushes the start time forward by the share of words removed', () => {
    const cues: Cue[] = [
      { start: 0, end: 2, text: 'the sky is' },
      { start: 2, end: 6, text: 'the sky is clear' },
    ];

    // 4 語中 3 語が重複なので、開始は 2 + 4 * 0.75 = 5 秒。
    expect(dedupeCues(cues)[1].start).toBe(5);
  });
});

describe('segmentCues', () => {
  it('joins cues into sentences using punctuation', () => {
    const cues: Cue[] = [
      { start: 0, end: 1.5, text: 'the sky is clear today' },
      { start: 1.5, end: 3, text: 'and the wind is cold.' },
      { start: 3, end: 5, text: 'we should take a coat.' },
    ];

    const sentences = segmentCues(cues);

    expect(sentences.map((s) => s.text)).toEqual([
      'the sky is clear today and the wind is cold.',
      'we should take a coat.',
    ]);
    expect(sentences[0]).toMatchObject({ id: 0, start: 0, end: 3 });
  });

  it('splits on silence when the captions carry no punctuation', () => {
    const cues: Cue[] = [
      { start: 0, end: 1, text: 'the sky is clear' },
      { start: 1, end: 2, text: 'today' },
      // 1.2 秒の無音 = 文の切れ目
      { start: 3.2, end: 4.2, text: 'the wind is cold' },
    ];

    expect(segmentCues(cues).map((s) => s.text)).toEqual([
      'the sky is clear today',
      'the wind is cold',
    ]);
  });

  it('does not split punctuated subtitles on ordinary short gaps', () => {
    const cues: Cue[] = [
      { start: 0, end: 1, text: 'the sky is clear today' },
      { start: 1.8, end: 3, text: 'and the wind is cold.' },
    ];

    expect(segmentCues(cues)).toHaveLength(1);
  });

  it('breaks a run-on stretch at the length limit', () => {
    // 句読点も無音も無く、内容だけが続いていく自動字幕を想定する。
    const cues: Cue[] = Array.from({ length: 12 }, (_, i) => ({
      start: i,
      end: i + 1,
      text: `part ${i} of a long stretch`,
    }));

    const sentences = segmentCues(cues);

    expect(sentences.length).toBeGreaterThan(1);
    for (const sentence of sentences) {
      expect(sentence.end - sentence.start).toBeLessThanOrEqual(9);
      // 上限を跨いだ cue の分だけは超えるので、1 cue 分の余裕を見て確認する。
      expect(sentence.text.length).toBeLessThan(80 + 25);
    }
    // 分割しても本文は落ちない。
    expect(sentences.map((s) => s.text).join(' ').split(/\s+/)).toHaveLength(12 * 6);
  });

  it('returns nothing for empty input', () => {
    expect(segmentCues([])).toEqual([]);
  });
});

describe('segmentPlainText', () => {
  it('splits on punctuation and keeps it', () => {
    expect(segmentPlainText('the sky is clear. is the wind cold?').map((s) => s.text)).toEqual([
      'the sky is clear.',
      'is the wind cold?',
    ]);
  });
});
