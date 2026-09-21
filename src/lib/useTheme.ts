import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'repeading:theme';

/** プライベートモードなどで localStorage が使えないことがあるので、失敗しても既定値で動かす。 */
function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface ThemeApi {
  theme: Theme;
  toggle: () => void;
}

/**
 * 配色を切り替える。初回は OS の設定に従い、以後 OS 側の変更にも追従する。
 * 一度でも手動で切り替えたら、その選択を保存して追従をやめる。
 */
export function useTheme(): ThemeApi {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? systemTheme());
  const [followSystem, setFollowSystem] = useState(() => readStoredTheme() === null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!followSystem) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(systemTheme());
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [followSystem]);

  const toggle = useCallback(() => {
    setFollowSystem(false);
    setTheme((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 保存できなくても切り替え自体は成立させる。
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
