/**
 * 辞書を引く先。英和を既定にする。
 * 英英にしたい場合はここだけ差し替える（例: https://dictionary.cambridge.org/dictionary/english/）。
 */
const DICTIONARY_URL = 'https://ejje.weblio.jp/content/';

/** 例文検索。辞書に項目が無い語の組み合わせは、語義より実例の方が当たる。 */
const EXAMPLES_URL = 'https://ejje.weblio.jp/sentence/content/';

/** 任意の並びを日本語にする。どの辞書にも載っていない言い回し用。 */
const TRANSLATE_URL = 'https://translate.google.com/?sl=en&tl=ja&op=translate&text=';

/**
 * 字幕中の語から、辞書を引ける形を取り出す。
 * 前後の記号は落とすが、`don't` のアポストロフィや `well-known` のハイフンは語の一部なので残す。
 * 数字や記号だけのものは引いても意味がないので null。
 */
export function normalizeWord(raw: string): string | null {
  const word = raw
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}'’‐-―-]+$/u, '');

  // 文字を含まないもの（"5"、"--" など）は辞書の対象にしない。
  return word && /\p{L}/u.test(word) ? word : null;
}

/** 語を引くための URL。引けない語は null。 */
export function dictionaryUrl(raw: string): string | null {
  const word = normalizeWord(raw);
  return word ? DICTIONARY_URL + encodeURIComponent(word) : null;
}

/** 選んだ範囲を 1 つの語句にまとめる。間の空白は 1 つに詰める。 */
export function joinWords(parts: string[]): string | null {
  return normalizeWord(parts.join(' ').replace(/\s+/g, ' ').trim());
}

/** 語句に含まれる語の数。1 語か、2 語以上かで行き先を変えるのに使う。 */
export function wordCount(phrase: string): number {
  return phrase.split(/\s+/).filter(Boolean).length;
}

export interface Lookup {
  key: string;
  label: string;
  url: string;
  /** 何が出るのか。どれを押すか迷わないように添える。 */
  hint: string;
}

/**
 * 語句の調べ先。すべて外部サイトへのリンクで、鍵もサーバーも要らない。
 *
 * 単語は辞書で引けるが、`put up with` のような組み合わせは辞書に項目が無いこともある。
 * そのときに欲しいのは語義ではなく「実際にどう使われるか」なので、例文を常に並べる。
 * どの辞書にも無い並びは翻訳に回すしかないので、2 語以上のときだけ足す。
 */
export function lookupsFor(raw: string): Lookup[] {
  const phrase = normalizeWord(raw);
  if (!phrase) return [];

  const query = encodeURIComponent(phrase);
  const lookups: Lookup[] = [
    {
      key: 'meaning',
      label: '意味',
      url: DICTIONARY_URL + query,
      hint: '英和辞典。単語と、辞書に載っている熟語。',
    },
    {
      key: 'examples',
      label: '例文',
      url: EXAMPLES_URL + query,
      hint: '実際に使われている文。辞書に項目が無い組み合わせはこちら。',
    },
  ];

  if (wordCount(phrase) > 1) {
    lookups.push({
      key: 'translation',
      label: '訳',
      url: TRANSLATE_URL + query,
      hint: '選んだ並びをそのまま訳す。どの辞書にも無い言い回し用。',
    });
  }

  return lookups;
}
