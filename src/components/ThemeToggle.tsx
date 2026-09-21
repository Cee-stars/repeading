import type { ThemeApi } from '../lib/useTheme';

export function ThemeToggle({ theme, toggle }: ThemeApi) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="ghost theme-toggle"
      onClick={toggle}
      title={isDark ? 'ライトに切り替え' : 'ダークに切り替え'}
      aria-label={isDark ? 'ライトに切り替え' : 'ダークに切り替え'}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {isDark ? (
          // 月: ダーク表示中は「ライトに戻せる」ことを示す。
          <path
            d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
          </g>
        )}
      </svg>
      <span>{isDark ? 'ダーク' : 'ライト'}</span>
    </button>
  );
}
