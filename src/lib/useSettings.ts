import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from './usePractice';
import type { PracticeSettings } from './usePractice';

/** 字幕の見せ方。隠す → 1 文字目だけ → 全文。 */
export type Reveal = 'hidden' | 'hint' | 'shown';

export interface AppSettings extends PracticeSettings {
  reveal: Reveal;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { ...DEFAULT_SETTINGS, reveal: 'hidden' };

export const RATES = [0.5, 0.75, 1];
export const REPEATS = [1, 2, 3];
export const PAUSE_RATIOS = [0, 0.5, 1, 1.5, 2];
export const REVEAL_ORDER: Reveal[] = ['hidden', 'hint', 'shown'];

const STORAGE_KEY = 'repeading:settings';

function pick<T>(allowed: T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** 保存値は書き換えられている可能性があるので、取りうる値に丸めてから使う。 */
function sanitize(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_APP_SETTINGS;
  const value = raw as Partial<AppSettings>;
  return {
    playbackRate: pick(RATES, value.playbackRate, DEFAULT_APP_SETTINGS.playbackRate),
    repeatCount: pick(REPEATS, value.repeatCount, DEFAULT_APP_SETTINGS.repeatCount),
    pauseRatio: pick(PAUSE_RATIOS, value.pauseRatio, DEFAULT_APP_SETTINGS.pauseRatio),
    reveal: pick(REVEAL_ORDER, value.reveal, DEFAULT_APP_SETTINGS.reveal),
    autoAdvance:
      typeof value.autoAdvance === 'boolean' ? value.autoAdvance : DEFAULT_APP_SETTINGS.autoAdvance,
  };
}

function read(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? sanitize(JSON.parse(stored)) : DEFAULT_APP_SETTINGS;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export interface SettingsApi {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

/** 練習設定を localStorage に覚えておく。毎回つまみを合わせ直さなくて済むように。 */
export function useSettings(): SettingsApi {
  const [settings, setSettings] = useState<AppSettings>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // 保存できなくてもその場の操作は成立させる。
    }
  }, [settings]);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((previous) => ({ ...previous, [key]: value })),
    [],
  );

  return { settings, update };
}
