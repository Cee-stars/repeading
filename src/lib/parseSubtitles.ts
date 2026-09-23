import { parseTimestamp } from './time';
import type { Cue, ParseResult, SubtitleFormat } from './types';

const CUE_ARROW = /-->/;
/** `0:12` `1:02:03` で始まる行 = YouTube 文字起こしパネルの形式。 */
const YT_LINE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * 字幕本文を表示用に整える。
 * VTT のインラインタグ、ASS の位置指定、話者記号、[Music] などの非発話表記を落とす。
 */
export function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .replace(/^\s*>>+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 入力がどの形式かを推定する。 */
export function detectFormat(raw: string): SubtitleFormat {
  const text = raw.trim();
  if (!text) return 'plain-text';

  if (CUE_ARROW.test(text)) {
    if (/^WEBVTT/i.test(text)) return 'vtt';
    // SRT のタイムコードはミリ秒がカンマ区切り。
    return /\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(text) ? 'srt' : 'vtt';
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const stamped = lines.filter((l) => YT_LINE.test(l.trim())).length;

  /*
   * 文字起こしパネルだけを選ぶのは手間なので、ページ全体をコピーして貼られることを想定する。
   * その場合まわりの文章に埋もれて割合では判定できないので、`0:12` 形式の行が
   * まとまった数あれば文字起こしとみなす。ふつうの文章にこれだけ並ぶことはない。
   */
  const MANY_STAMPS = 10;
  if (stamped >= MANY_STAMPS) return 'youtube-transcript';

  // 貼り付けが文字起こしだけなら、行の 1/4 以上が時刻で始まる。
  return stamped >= 2 && stamped * 4 >= lines.length ? 'youtube-transcript' : 'plain-text';
}

/** `00:00:01,000 --> 00:00:04,000 align:start` 形式のタイムコード行を読む。 */
function parseCueTiming(line: string): { start: number; end: number } | null {
  const match = line.match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
  if (!match) return null;
  const start = parseTimestamp(match[1]);
  const end = parseTimestamp(match[2]);
  if (start === null || end === null || end < start) return null;
  return { start, end };
}

/** SRT / WebVTT を読む。どちらも「空行区切りのブロック」構造なので同じ経路で処理する。 */
function parseCueBased(raw: string): Cue[] {
  const cues: Cue[] = [];

  for (const block of raw.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((l) => CUE_ARROW.test(l));
    if (timingIndex === -1) continue; // NOTE / STYLE / 連番のみのブロック

    const timing = parseCueTiming(lines[timingIndex]);
    if (!timing) continue;

    const text = cleanCueText(lines.slice(timingIndex + 1).join(' '));
    if (text) cues.push({ ...timing, text });
  }

  return cues;
}

/** 1 文字あたりの想定発話速度（秒）。末尾 cue の終了時刻を推定するのに使う。 */
const SECONDS_PER_CHAR = 1 / 14;

/** 時刻と本文が同じ行に並ぶ形式が主かどうか。 */
function hasInlineText(lines: string[]): boolean {
  const stamped = lines.filter((line) => YT_LINE.test(line));
  const inline = stamped.filter((line) => (line.match(YT_LINE)?.[2] ?? '') !== '').length;
  return stamped.length > 0 && inline * 2 >= stamped.length;
}

/** YouTube の「文字起こしを表示」からコピーしたテキストを読む。 */
function parseYouTubeTranscript(raw: string): Cue[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  /*
   * 「0:12 本文」のように 1 行で完結しているなら、時刻で始まらない行は
   * ページの他の部分とみなして捨てる。ページ全体をコピーして貼っても取り込めるようにするため。
   * 「0:12」の次の行に本文が来る形式のときだけ、後続行を本文として拾う。
   */
  const inlineOnly = hasInlineText(lines);

  const partials: { start: number; parts: string[] }[] = [];
  let lastStart = -1;

  for (const line of lines) {
    const match = line.match(YT_LINE);
    if (match) {
      const start = parseTimestamp(match[1]);
      // 文字起こしの時刻は前に戻らない。戻る行は動画の長さなど別物なので捨てる。
      if (start === null || start < lastStart) continue;
      lastStart = start;
      partials.push({ start, parts: match[2] ? [match[2]] : [] });
    } else if (!inlineOnly && partials.length) {
      partials[partials.length - 1].parts.push(line);
    }
  }

  return partials.flatMap((partial, i) => {
    const text = cleanCueText(partial.parts.join(' '));
    if (!text) return [];
    const next = partials[i + 1];
    const end = next
      ? next.start
      : partial.start + Math.max(2, text.length * SECONDS_PER_CHAR);
    return [{ start: partial.start, end, text }];
  });
}

/**
 * 形式を自動判定して cue 列に変換する。
 * タイムスタンプを持たないベタテキストは `timed: false` で返り、再生区間は作れない。
 */
export function parseSubtitles(raw: string): ParseResult {
  const format = detectFormat(raw);

  if (format === 'srt' || format === 'vtt') {
    return { format, cues: parseCueBased(raw), timed: true };
  }

  if (format === 'youtube-transcript') {
    return { format, cues: parseYouTubeTranscript(raw), timed: true };
  }

  const text = cleanCueText(raw.replace(/\r?\n/g, ' '));
  return {
    format: 'plain-text',
    cues: text ? [{ start: 0, end: 0, text }] : [],
    timed: false,
  };
}
