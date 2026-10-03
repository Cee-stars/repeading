import { describe, expect, it } from 'vitest';
import { PLAYER_ERROR, playerErrorMessage } from '../playerError';

describe('playerErrorMessage', () => {
  it('names the cause when the video cannot be embedded', () => {
    // 所有者が埋め込みを止めている場合。別の動画を選ぶしかない。
    expect(playerErrorMessage(PLAYER_ERROR.EMBED_DISABLED)).toContain('埋め込み');
    expect(playerErrorMessage(PLAYER_ERROR.EMBED_DISABLED_ALT)).toContain('埋め込み');
  });

  it('distinguishes a missing video from a bad id', () => {
    expect(playerErrorMessage(PLAYER_ERROR.NOT_FOUND)).toContain('見つかりません');
    expect(playerErrorMessage(PLAYER_ERROR.INVALID_PARAMETER)).toContain('動画 ID');
  });

  it('still says something useful for a code it does not know', () => {
    const message = playerErrorMessage(999);

    expect(message).toContain('再生できませんでした');
    // 番号を残しておけば、こちらで原因を追える。
    expect(message).toContain('999');
  });
});
