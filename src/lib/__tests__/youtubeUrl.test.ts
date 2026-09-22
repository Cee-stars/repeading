import { describe, expect, it } from 'vitest';
import { extractVideoId } from '../youtubeUrl';
import { formatPreciseTimestamp, formatTimestamp } from '../time';

describe('extractVideoId', () => {
  const id = 'abcdefghij1';

  it('reads the URL shapes YouTube hands out', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(extractVideoId(`https://www.youtube.com/watch?v=${id}&t=42s`)).toBe(id);
    expect(extractVideoId(`https://youtu.be/${id}?t=42`)).toBe(id);
    expect(extractVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(extractVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(extractVideoId(`https://www.youtube.com/live/${id}`)).toBe(id);
    expect(extractVideoId(`youtube.com/watch?v=${id}`)).toBe(id);
  });

  it('accepts a bare video id', () => {
    expect(extractVideoId(id)).toBe(id);
    expect(extractVideoId(`  ${id}  `)).toBe(id);
  });

  it('rejects anything else', () => {
    expect(extractVideoId('')).toBeNull();
    expect(extractVideoId('not a url')).toBeNull();
    expect(extractVideoId('https://example.com/watch?v=abcdefghij1')).toBeNull();
    expect(extractVideoId('https://www.youtube.com/watch?v=tooshort')).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('shows hours only when needed', () => {
    expect(formatTimestamp(9)).toBe('0:09');
    expect(formatTimestamp(123)).toBe('2:03');
    expect(formatTimestamp(3723)).toBe('1:02:03');
    expect(formatTimestamp(-1)).toBe('0:00');
  });
});

describe('formatPreciseTimestamp', () => {
  it('shows tenths so a nudge is visible', () => {
    expect(formatPreciseTimestamp(4.25)).toBe('0:04.2');
    expect(formatPreciseTimestamp(4.97)).toBe('0:04.9');
    expect(formatPreciseTimestamp(123)).toBe('2:03.0');
    expect(formatPreciseTimestamp(-1)).toBe('0:00.0');
  });
});
