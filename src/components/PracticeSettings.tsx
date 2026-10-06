import {
  PAUSE_RATIOS,
  RATES,
  REPEATS,
  REVEAL_ORDER,
  UNDERSTAND_RATIOS,
} from '../lib/useSettings';
import type { AppSettings, Reveal, SettingsApi } from '../lib/useSettings';

const REVEAL_LABELS: Record<Reveal, string> = {
  hidden: '隠す',
  hint: 'ヒント',
  shown: '表示',
};

interface Props {
  settings: AppSettings;
  update: SettingsApi['update'];
  /** その画面にだけあるつまみ（教材の「苦手な文だけ」など）。 */
  children?: React.ReactNode;
}

/** 練習のつまみ。動画の教材でもフレーズ集でも同じものを使う。 */
export function PracticeSettings({ settings, update, children }: Props) {
  return (
    <div className="settings">
      <div className="setting">
        <span className="setting-label">速度</span>
        <div className="segmented">
          {RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              className={settings.playbackRate === rate ? 'on' : ''}
              onClick={() => update('playbackRate', rate)}
            >
              {rate}×
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">繰り返し</span>
        <div className="segmented">
          {REPEATS.map((count) => (
            <button
              key={count}
              type="button"
              className={settings.repeatCount === count ? 'on' : ''}
              onClick={() => update('repeatCount', count)}
            >
              {count}回
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">理解する間</span>
        <div className="segmented">
          {UNDERSTAND_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={settings.understandRatio === ratio ? 'on' : ''}
              onClick={() => update('understandRatio', ratio)}
            >
              {ratio === 0 ? 'なし' : `${ratio}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">真似る間</span>
        <div className="segmented">
          {PAUSE_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={settings.pauseRatio === ratio ? 'on' : ''}
              onClick={() => update('pauseRatio', ratio)}
            >
              {ratio === 0 ? 'なし' : `${ratio}×`}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">字幕</span>
        <div className="segmented">
          {REVEAL_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              className={settings.reveal === mode ? 'on' : ''}
              onClick={() => update('reveal', mode)}
            >
              {REVEAL_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      <label className="setting checkbox">
        <input
          type="checkbox"
          checked={settings.autoAdvance}
          onChange={(e) => update('autoAdvance', e.target.checked)}
        />
        自動で次の文へ
      </label>

      {children}
    </div>
  );
}
