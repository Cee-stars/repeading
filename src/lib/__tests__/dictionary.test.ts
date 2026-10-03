import { describe, expect, it } from 'vitest';
import { dictionaryUrl, joinWords, lookupsFor, normalizeWord, wordCount } from '../dictionary';

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

describe('joinWords', () => {
  it('joins a selected span into one phrase', () => {
    expect(joinWords(['look', 'forward', 'to'])).toBe('look forward to');
  });

  it('trims the punctuation at the ends but keeps what is inside', () => {
    // 文中から切り出すと端に記号が付く。中のコンマは選んだとおりに残す。
    expect(joinWords(['"Well,', 'I', 'reckon."'])).toBe('Well, I reckon');
  });

  it('collapses the whitespace that came with the tokens', () => {
    expect(joinWords(['get ', ' along', 'with'])).toBe('get along with');
  });

  it('gives nothing when the span holds no letters', () => {
    expect(joinWords(['5', '--'])).toBeNull();
    expect(joinWords([])).toBeNull();
  });
});

describe('wordCount', () => {
  it('counts the words in a phrase', () => {
    expect(wordCount('reckon')).toBe(1);
    expect(wordCount('look forward to')).toBe(3);
  });
});

describe('lookupsFor', () => {
  it('offers the dictionary and real examples for a single word', () => {
    const lookups = lookupsFor('reckon');

    expect(lookups.map((l) => l.label)).toEqual(['意味', '例文']);
    expect(lookups[0].url).toBe('https://ejje.weblio.jp/content/reckon');
    expect(lookups[1].url).toBe('https://ejje.weblio.jp/sentence/content/reckon');
  });

  it('adds a translation once more than one word is selected', () => {
    // 辞書に項目が無い並びは訳すしかない。1 語では出さない。
    const lookups = lookupsFor('the weather will hold');

    expect(lookups.map((l) => l.label)).toEqual(['意味', '例文', '訳']);
    expect(lookups[2].url).toContain('tl=ja');
    expect(lookups[2].url).toContain('the%20weather%20will%20hold');
  });

  it('escapes the phrase in every destination', () => {
    for (const lookup of lookupsFor('look forward to')) {
      expect(lookup.url).not.toContain('look forward to');
      expect(lookup.url).toContain('look%20forward%20to');
    }
  });

  it('gives nothing to press when the span cannot be looked up', () => {
    expect(lookupsFor('5')).toEqual([]);
    expect(lookupsFor('')).toEqual([]);
  });
});
