import { describe, expect, it } from 'vitest';
import { dictionaryUrl, normalizeWord } from '../dictionary';

describe('normalizeWord', () => {
  it('strips the punctuation that sits around a word in a sentence', () => {
    expect(normalizeWord('cold.')).toBe('cold');
    expect(normalizeWord('"sky,')).toBe('sky');
    expect(normalizeWord('(today)')).toBe('today');
    expect(normalizeWord('wind?!')).toBe('wind');
  });

  it('keeps the marks that belong to the word itself', () => {
    expect(normalizeWord("don't")).toBe("don't");
    expect(normalizeWord('well-known')).toBe('well-known');
    // 文末の記号だけ落として、語中のアポストロフィは残す。
    expect(normalizeWord("don't.")).toBe("don't");
  });

  it('leaves a plain word alone', () => {
    expect(normalizeWord('morning')).toBe('morning');
  });

  it('refuses what a dictionary cannot help with', () => {
    expect(normalizeWord('5')).toBeNull();
    expect(normalizeWord('3.5')).toBeNull();
    expect(normalizeWord('--')).toBeNull();
    expect(normalizeWord('')).toBeNull();
    expect(normalizeWord('   ')).toBeNull();
  });
});

describe('dictionaryUrl', () => {
  it('builds a link for a word', () => {
    expect(dictionaryUrl('cold.')).toBe('https://ejje.weblio.jp/content/cold');
  });

  it('escapes what would otherwise break the URL', () => {
    // アポストロフィは URL の経路にそのまま書けるので変換されない。
    expect(dictionaryUrl("don't")).toBe("https://ejje.weblio.jp/content/don't");
    // 非 ASCII は変換する。
    expect(dictionaryUrl('café')).toBe('https://ejje.weblio.jp/content/caf%C3%A9');
  });

  it('gives nothing for a non-word', () => {
    expect(dictionaryUrl('5')).toBeNull();
  });
});
