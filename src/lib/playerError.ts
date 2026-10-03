/**
 * プレーヤーが動かないときの原因を、利用者が次の手を打てる言葉にする。
 * 「準備中」のまま黙っていると、待てばいいのか諦めるのかが分からない。
 */

/** YouTube IFrame Player API が返すエラー番号。 */
export const PLAYER_ERROR = {
  INVALID_PARAMETER: 2,
  HTML5_ERROR: 5,
  NOT_FOUND: 100,
  EMBED_DISABLED: 101,
  EMBED_DISABLED_ALT: 150,
} as const;

export function playerErrorMessage(code: number): string {
  switch (code) {
    case PLAYER_ERROR.INVALID_PARAMETER:
      return '動画 ID が正しくないようです。URL を確認してください。';
    case PLAYER_ERROR.HTML5_ERROR:
      return 'この動画をプレーヤーで再生できませんでした。';
    case PLAYER_ERROR.NOT_FOUND:
      return '動画が見つかりません。削除されたか、非公開になった可能性があります。';
    case PLAYER_ERROR.EMBED_DISABLED:
    case PLAYER_ERROR.EMBED_DISABLED_ALT:
      return 'この動画は、埋め込みでの再生が許可されていません。別の動画で試してください。';
    default:
      return `動画を再生できませんでした（エラー ${code}）。`;
  }
}

/** API そのものが読めなかったとき。原因が利用者側にあることが多い。 */
export const API_LOAD_FAILED =
  'YouTube のプレーヤーを読み込めませんでした。通信状況を確かめるか、広告ブロッカーを使っている場合はこのサイトで無効にしてみてください。';

/** 読み込みは済んだのに、いつまでも使える状態にならないとき。 */
export const PLAYER_TIMEOUT = 'プレーヤーの準備が終わりませんでした。もう一度お試しください。';
