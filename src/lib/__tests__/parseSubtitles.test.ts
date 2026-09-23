import { describe, expect, it } from 'vitest';
import { cleanCueText, detectFormat, parseSubtitles } from '../parseSubtitles';
import { parseTimestamp } from '../time';

describe('parseTimestamp', () => {
  it('reads the formats subtitle files use', () => {
    expect(parseTimestamp('00:00:04,500')).toBe(4.5);
    expect(parseTimestamp('00:01:02.250')).toBe(62.25);
    expect(parseTimestamp('2:03')).toBe(123);
    expect(parseTimestamp('1:02:03')).toBe(3723);
  });

  it('rejects anything that is not a timestamp', () => {
    expect(parseTimestamp('hello')).toBeNull();
    expect(parseTimestamp('1:2:3:4')).toBeNull();
  });
});

describe('cleanCueText', () => {
  it('strips inline tags, non-speech brackets and speaker marks', () => {
    expect(cleanCueText('<c>the sky</c> is clear')).toBe('the sky is clear');
    expect(cleanCueText('[Music] the sky is clear')).toBe('the sky is clear');
    expect(cleanCueText('>> the sky is clear')).toBe('the sky is clear');
    expect(cleanCueText('tea &amp; toast')).toBe('tea & toast');
  });
});

describe('detectFormat', () => {
  it('tells the timed formats apart', () => {
    expect(detectFormat('1\n00:00:01,000 --> 00:00:03,000\nthe sky is clear')).toBe('srt');
    expect(detectFormat('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nthe sky is clear')).toBe('vtt');
    expect(detectFormat('0:01 the sky is clear\n0:03 the wind is cold')).toBe(
      'youtube-transcript',
    );
    expect(detectFormat('the sky is clear. the wind is cold.')).toBe('plain-text');
  });
});

describe('parseSubtitles', () => {
  it('parses SRT blocks and drops the index lines', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'the sky is clear today.',
      '',
      '2',
      '00:00:04,000 --> 00:00:06,500',
      'the wind is cold.',
    ].join('\n');

    const result = parseSubtitles(srt);

    expect(result.format).toBe('srt');
    expect(result.timed).toBe(true);
    expect(result.cues).toEqual([
      { start: 1, end: 3, text: 'the sky is clear today.' },
      { start: 4, end: 6.5, text: 'the wind is cold.' },
    ]);
  });

  it('parses WebVTT, ignoring NOTE blocks and cue settings', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE this block is not a cue',
      '',
      '00:00:01.000 --> 00:00:03.000 align:start position:0%',
      'the sky is clear today.',
    ].join('\n');

    const result = parseSubtitles(vtt);

    expect(result.format).toBe('vtt');
    expect(result.cues).toEqual([{ start: 1, end: 3, text: 'the sky is clear today.' }]);
  });

  it('parses a transcript pasted with the text on the same line', () => {
    const result = parseSubtitles('0:01 the sky is clear\n0:04 the wind is cold');

    expect(result.cues[0]).toEqual({ start: 1, end: 4, text: 'the sky is clear' });
    expect(result.cues[1].start).toBe(4);
    // 最後の cue は終了時刻が無いので文字数から見積もる。
    expect(result.cues[1].end).toBeGreaterThan(4);
  });

  it('parses a transcript pasted with the timestamp on its own line', () => {
    const result = parseSubtitles('0:01\nthe sky is clear\n0:04\nthe wind is cold');

    expect(result.cues[0]).toEqual({ start: 1, end: 4, text: 'the sky is clear' });
    expect(result.cues[1].text).toBe('the wind is cold');
  });

  it('picks the transcript out of a whole page that was copied around it', () => {
    // 文字起こしパネルだけを選ぶのは手間なので、ページごと貼られることを想定する。
    const page = [
      'Transcript',
      'Search in video',
      '0:01 the sky is clear today.',
      '0:04 the wind is cold.',
      '0:07 we should take a coat.',
      '0:10 the train leaves at noon.',
      '0:13 we can walk to the station.',
      '0:16 it takes about ten minutes.',
      '0:19 the platform is on the left.',
      '0:22 we should buy the tickets first.',
      '0:25 the machine takes coins.',
      '0:28 there is a bakery inside.',
      'English (auto-generated)',
      'Some Channel',
      '12,345 views',
      'Subscribe to see more of this.',
    ].join('\n');

    const result = parseSubtitles(page);

    expect(result.format).toBe('youtube-transcript');
    expect(result.cues).toHaveLength(10);
    expect(result.cues[0]).toEqual({ start: 1, end: 4, text: 'the sky is clear today.' });
    // 前後の飾り文字は本文に混ざらない。
    expect(result.cues.at(-1)?.text).toBe('there is a bakery inside.');
  });

  it('ignores a timestamp that jumps backwards, such as a video length', () => {
    const result = parseSubtitles(
      ['0:01 the sky is clear today.', '0:04 the wind is cold.', '0:02 9:35'].join('\n'),
    );

    expect(result.cues.map((c) => c.text)).toEqual([
      'the sky is clear today.',
      'the wind is cold.',
    ]);
  });

  it('still joins text that follows a timestamp on its own line', () => {
    // こちらの形式では、時刻で始まらない行は本文なので捨ててはいけない。
    const result = parseSubtitles('0:01\nthe sky is clear\n0:04\nthe wind is cold');

    expect(result.cues.map((c) => c.text)).toEqual(['the sky is clear', 'the wind is cold']);
  });

  it('flags text without timestamps as untimed', () => {
    const result = parseSubtitles('the sky is clear. the wind is cold.');

    expect(result.timed).toBe(false);
    expect(result.cues).toHaveLength(1);
  });
});
