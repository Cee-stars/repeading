import { describe, expect, it } from 'vitest';
import { ASK_LIMIT, buildAskPrompt } from '../askPrompt';

describe('buildAskPrompt', () => {
  it('asks about one expression without numbering it', () => {
    const prompt = buildAskPrompt([
      { word: 'put up with', context: 'He could not put up with the noise.' },
    ]);

    expect(prompt).toContain('次の英語表現について');
    expect(prompt).toContain('put up with');
    expect(prompt).toContain('出てきた文: He could not put up with the noise.');
    // 1 件のときに「1.」と振ると、続きがあるように見える。
    expect(prompt).not.toContain('1. put up with');
  });

  it('asks about the grammar, not just the meaning', () => {
    // 分からないのは単語より文法だと聞いているので、そこを必ず尋ねる。
    const prompt = buildAskPrompt([{ word: 'reckon', context: 'I reckon so.' }]);

    expect(prompt).toContain('意味');
    expect(prompt).toContain('文法的にどう組み立てられているか');
  });

  it('numbers the list and says how many there are', () => {
    const prompt = buildAskPrompt([
      { word: 'reckon', context: 'I reckon so.' },
      { word: 'glance', context: 'She glanced away.' },
    ]);

    expect(prompt).toContain('次の 2 個の英語表現');
    expect(prompt).toContain('1. reckon');
    expect(prompt).toContain('2. glance');
  });

  it('passes on how often a word was looked up', () => {
    // 何度も引いた語は身に付いていない語なので、その印を渡す。
    const prompt = buildAskPrompt([
      { word: 'reckon', context: 'I reckon so.', count: 4 },
      { word: 'glance', context: 'She glanced away.', count: 1 },
    ]);

    expect(prompt).toContain('reckon（4 回調べました）');
    // 1 回のものに回数は要らない。
    expect(prompt).toContain('2. glance\n');
    expect(prompt).not.toContain('glance（1 回');
  });

  it('leaves out the sentence line when there is no sentence', () => {
    const prompt = buildAskPrompt([{ word: 'reckon', context: '   ' }]);

    expect(prompt).toContain('reckon');
    expect(prompt).not.toContain('出てきた文:');
  });

  it('caps how much goes in one paste', () => {
    const many = Array.from({ length: ASK_LIMIT + 10 }, (_, i) => ({
      word: `word${i}`,
      context: `sentence ${i}`,
    }));
    const prompt = buildAskPrompt(many);

    expect(prompt).toContain(`次の ${ASK_LIMIT} 個`);
    expect(prompt).toContain(`${ASK_LIMIT}. word${ASK_LIMIT - 1}`);
    expect(prompt).not.toContain(`word${ASK_LIMIT}`);
  });

  it('gives nothing when there is nothing to ask', () => {
    expect(buildAskPrompt([])).toBe('');
  });
});
