/** 質問文に載せる 1 件。回数は「まだ身に付いていない」の目印として渡す。 */
export interface AskItem {
  word: string;
  context: string;
  count?: number;
}

/**
 * 一度に貼る上限。多すぎると貼る側が読み切れないし、
 * 一回のやり取りで扱える量も超える。
 */
export const ASK_LIMIT = 40;

/**
 * 調べた語句を、そのまま貼れる質問文にする。
 *
 * アプリから直接モデルを呼ぶと API キーの置き場所が要る。ブラウザだけで動く作りでは
 * キーを隠せないので、呼ぶのはアプリではなく利用者にしてある。費用も増えない。
 *
 * 文法が分からない場面が多いと聞いているので、意味だけでなく組み立ても尋ねる。
 */
export function buildAskPrompt(items: AskItem[]): string {
  const listed = items.slice(0, ASK_LIMIT);
  if (!listed.length) return '';

  const single = listed.length === 1;

  const head = single
    ? '次の英語表現について、日本語で説明してください。'
    : `次の ${listed.length} 個の英語表現について、日本語で説明してください。`;

  const body = listed
    .map((item, index) => {
      const number = single ? '' : `${index + 1}. `;
      const times = item.count && item.count > 1 ? `（${item.count} 回調べました）` : '';
      const context = item.context.trim();

      return [
        `${number}${item.word}${times}`,
        context ? `   出てきた文: ${context}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    head,
    '',
    '知りたいこと:',
    '- 意味',
    '- 文法的にどう組み立てられているか',
    '- 似た表現との使い分け',
    '',
    body,
    '',
    'YouTube の字幕でリピーティング練習をしていて、分からなかったものです。',
  ].join('\n');
}
