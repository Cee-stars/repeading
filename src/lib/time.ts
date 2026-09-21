/**
 * 字幕のタイムスタンプを秒に変換する。
 * `01:02:03,456` `01:02:03.456` `02:03.456` `2:03` `123` のいずれも受け付ける。
 * 解釈できなければ null。
 */
export function parseTimestamp(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d{1,3}(:\d{1,2}){0,2}(\.\d{1,3})?$/.test(s)) return null;

  const parts = s.split(':');
  if (parts.length > 3) return null;

  // 末尾から 秒・分・時 の順に積む（`2:03` は 2分3秒）。
  const weights = [1, 60, 3600];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const value = Number(parts[parts.length - 1 - i]);
    if (!Number.isFinite(value)) return null;
    total += value * weights[i];
  }
  return total;
}

/** 秒を `M:SS` / `H:MM:SS` に整形する。 */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
