import { useCallback, useEffect, useState } from 'react';

/**
 * 配信されているビルドが、いま動いているものより新しいかを見る。
 *
 * ブラウザが index.html を抱え込むと、直したはずの不具合がいつまでも残る。
 * 利用者には古い版を掴んでいることが分からないので、こちらから気づいて知らせる。
 * build.json は毎回クエリを変えて取りに行き、キャッシュを避ける。
 */
export function useUpdateCheck(): boolean {
  const [stale, setStale] = useState(false);

  const check = useCallback(async () => {
    try {
      const response = await fetch(`./build.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const { builtAt } = (await response.json()) as { builtAt?: unknown };
      if (typeof builtAt === 'string' && builtAt !== __BUILD_TIME__) setStale(true);
    } catch {
      // 開発中や通信できないときは何も言わない。
    }
  }, []);

  useEffect(() => {
    void check();

    // 開きっぱなしのタブに戻ってきたときにも見る。
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  return stale;
}

/** キャッシュを跨いで確実に読み直す。 */
export function reloadFresh(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}
