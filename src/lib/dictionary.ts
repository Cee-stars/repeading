/**
 * 辞書を引く先。英和を既定にする。
 * 英英にしたい場合はここだけ差し替える（例: https://dictionary.cambridge.org/dictionary/english/）。
 */
const DICTIONARY_URL = 'https://ejje.weblio.jp/content/';

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
