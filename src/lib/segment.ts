import { DEFAULT_SEGMENT_OPTIONS } from './types';
import type { Cue, ParseResult, SegmentOptions, Sentence } from './types';

/** 文末とみなす記号。 */
const SENTENCE_END = /[.!?。！？…]["'」』)\]]*$/;

/** 末尾のピリオドが文末ではなく略語である語。 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'mt', 'jr', 'sr',
  'vs', 'etc', 'inc', 'ltd', 'co', 'approx', 'eg', 'ie', 'cf', 'al',
]);

/** 句読点付き字幕では、文中の間で切らないようギャップ判定を緩める。 */
const PUNCTUATED_MIN_GAP = 1.5;
/** ローリング字幕の重複を探す範囲（語数）。 */
const OVERLAP_WINDOW = 20;

/** その cue が文の終わりで終わっているか。略語のピリオドは文末としない。 */
export function endsSentence(text: string): boolean {
  if (!SENTENCE_END.test(text)) return false;
  const lastWord = text.replace(/["'」』)\]]*$/, '').split(/\s+/).pop() ?? '';
  if (!lastWord.endsWith('.')) return true;

  const bare = lastWord.slice(0, -1).replace(/\./g, '').toLowerCase();
  // 略語（Mr.）と頭文字（J.）は文末扱いしない。
  return !ABBREVIATIONS.has(bare) && bare.length > 1;
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function sameWord(a: string, b: string): boolean {
  const normalize = (w: string) => w.toLowerCase().replace(/[.,!?;:"']/g, '');
  return normalize(a) === normalize(b);
}

/**
 * 直前までの語列 `tail` と cue の語列 `current` の重なり語数を返す。
 * YouTube の自動字幕は前の行を丸ごと繰り返しながら流れるため、この重複を落とさないと
 * 同じ語が何度も練習文に混ざる。
 */
export function overlapLength(tail: string[], current: string[]): number {
  const max = Math.min(tail.length, current.length, OVERLAP_WINDOW);
  for (let k = max; k >= 1; k--) {
    let matched = true;
    for (let i = 0; i < k; i++) {
      if (!sameWord(tail[tail.length - k + i], current[i])) {
        matched = false;
        break;
      }
    }
    // 1 語だけの一致は "very very" のような正当な繰り返しと区別できないので、
    // cue 全体が重複している場合に限って認める。
    if (matched && (k >= 2 || k === current.length)) return k;
  }
  return 0;
}

/** ローリング字幕の重複を取り除いた cue 列を返す。落とした語の分だけ開始時刻を進める。 */
export function dedupeCues(cues: Cue[]): Cue[] {
  const result: Cue[] = [];
  const emitted: string[] = [];

  for (const cue of cues) {
    const current = words(cue.text);
    if (!current.length) continue;

    const overlap = overlapLength(emitted.slice(-OVERLAP_WINDOW), current);
    const remaining = current.slice(overlap);
    if (!remaining.length) continue;

    // 語ごとの時刻は持っていないので、落とした語数の比率で開始時刻を按分する。
    const ratio = overlap / current.length;
    const start = cue.start + (cue.end - cue.start) * ratio;

    result.push({ start, end: cue.end, text: remaining.join(' ') });
    emitted.push(...remaining);
  }

  return result;
}

/**
 * cue 列を練習用の文に組み直す。
 * 句読点があればそれを優先し、無い自動字幕では「無音ギャップ + 長さ上限」で切る。
 */
export function segmentCues(cues: Cue[], options: SegmentOptions = DEFAULT_SEGMENT_OPTIONS): Sentence[] {
  const clean = dedupeCues(cues);
  if (!clean.length) return [];

  const hasPunctuation = /[.!?。！？]/.test(clean.map((c) => c.text).join(' '));
  const minGap = hasPunctuation
    ? Math.max(options.gapThreshold, PUNCTUATED_MIN_GAP)
    : options.gapThreshold;

  const sentences: Sentence[] = [];
  let buffer: Cue[] = [];

  const flush = () => {
    if (!buffer.length) return;
    sentences.push({
      id: sentences.length,
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      text: buffer.map((c) => c.text).join(' '),
    });
    buffer = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const cue = clean[i];
    buffer.push(cue);

    const isLast = i === clean.length - 1;
    if (isLast) {
      flush();
      break;
    }

    const text = buffer.map((c) => c.text).join(' ');
    const duration = cue.end - buffer[0].start;
    const gap = clean[i + 1].start - cue.end;

    const shouldBreak =
      (hasPunctuation && endsSentence(cue.text)) ||
      gap >= minGap ||
      text.length >= options.maxChars ||
      duration >= options.maxDuration;

    // 短すぎる断片（相槌や切れ端）は次の cue と繋いで 1 文にする。
    if (shouldBreak && text.length >= options.minChars) flush();
  }

  return sentences;
}

/**
 * タイムスタンプの無いベタテキストを、句読点だけで文に割る（再生区間は持たない）。
 *
 * 後読み `(?<=…)` は使わない。Safari 16.4 未満では構文エラーになり、
 * バンドル全体が読めずに真っ白な画面になるため。
 * 代わりに区切り記号を捕捉し、直前の文の末尾に付け直して同じ結果を得る。
 */
export function segmentPlainText(text: string): Sentence[] {
  const parts = text.split(/([.!?。！？]+)\s+/);
  const sentences: Sentence[] = [];

  // split の結果は [本文, 区切り, 本文, 区切り, …, 末尾] と交互に並ぶ。
  for (let i = 0; i < parts.length; i += 2) {
    const body = `${parts[i] ?? ''}${parts[i + 1] ?? ''}`.trim();
    if (body) sentences.push({ id: sentences.length, start: 0, end: 0, text: body });
  }

  return sentences;
}

/** 解析結果から練習文の一覧を作る。 */
export function buildSentences(
  parsed: ParseResult,
  options: SegmentOptions = DEFAULT_SEGMENT_OPTIONS,
): Sentence[] {
  if (!parsed.timed) {
    return segmentPlainText(parsed.cues.map((c) => c.text).join(' '));
  }
  return segmentCues(parsed.cues, options);
}
