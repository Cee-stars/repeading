import { DEFAULT_SEGMENT_OPTIONS } from './types';
import type { Cue, ParseResult, SegmentOptions, Sentence } from './types';

/** 文末とみなす記号。 */
const SENTENCE_END = /[.!?。！？…]["'」』)\]]*$/;

/** 末尾のピリオドが文末ではなく略語である語。 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'mt', 'jr', 'sr',
  'vs', 'etc', 'inc', 'ltd', 'co', 'approx', 'eg', 'ie', 'cf', 'al',
]);

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
 * cue 列を 1 本の本文にまとめ、文字位置から時刻を引けるようにする。
 * 字幕の行は文の途中で改行されるので、行の境界ではなく本文の上で文を切るために要る。
 */
interface Stream {
  text: string;
  spans: { start: number; end: number; from: number; to: number }[];
}

function buildStream(cues: Cue[]): Stream {
  let text = '';
  const spans: Stream['spans'] = [];

  for (const cue of cues) {
    if (text) text += ' ';
    const from = text.length;
    text += cue.text;
    spans.push({ start: cue.start, end: cue.end, from, to: text.length });
  }

  return { text, spans };
}

/** 文字位置の時刻を、その位置を含む cue の中で文字数に比例して按分する。 */
export function timeAt(stream: Stream, offset: number): number {
  const { spans } = stream;
  if (!spans.length) return 0;
  if (offset <= spans[0].from) return spans[0].start;

  const last = spans[spans.length - 1];
  if (offset >= last.to) return last.end;

  for (const span of spans) {
    if (offset < span.from) return span.start; // cue と cue の隙間
    if (offset <= span.to) {
      const width = span.to - span.from;
      return width > 0 ? span.start + ((span.end - span.start) * (offset - span.from)) / width : span.start;
    }
  }

  return last.end;
}

/** 文末の記号の直後の位置を集める。小数点や略語では切らない。 */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const pattern = /[.!?。！？]+["'」』)\]]*/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const end = match.index + match[0].length;
    // 文の切れ目なら後ろは空白か終端。"3.5" の途中では切らない。
    if (end < text.length && !/\s/.test(text[end])) continue;
    // 略語の判定には直前の語だけ見れば足りる。
    if (!endsSentence(text.slice(Math.max(0, end - 40), end))) continue;
    ends.push(end);
  }

  return ends;
}

/**
 * 長すぎる文をさらに割る。1 回で真似られない長さは練習の単位にならない。
 * 読点を優先し、無ければ語の切れ目で、そのつど中央に近いところを選ぶ。
 */
function splitLong(text: string, offset: number, maxChars: number, out: number[]): void {
  if (text.length <= maxChars) return;

  const positions: number[] = [];
  const collect = (pattern: RegExp) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) positions.push(match.index + match[0].length);
  };

  collect(/[,、，]\s/g);
  if (!positions.length) collect(/\s+/g);

  const inner = positions.filter((p) => p > 0 && p < text.length);
  if (!inner.length) return;

  const middle = text.length / 2;
  const cut = inner.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));

  out.push(offset + cut);
  splitLong(text.slice(0, cut), offset, maxChars, out);
  splitLong(text.slice(cut), offset + cut, maxChars, out);
}

/**
 * 句読点のある字幕を文に割る。
 * 字幕の行は文の途中で改行されるため、行ではなく連結した本文の上で切る。
 */
function segmentByPunctuation(cues: Cue[], options: SegmentOptions): Sentence[] {
  const stream = buildStream(cues);
  const { text } = stream;

  const marks = sentenceEnds(text);

  // 文末で割ったうえで、まだ長い塊は読点などでほぐす。
  const extra: number[] = [];
  let previous = 0;
  for (const mark of [...marks, text.length]) {
    splitLong(text.slice(previous, mark), previous, options.maxChars, extra);
    previous = mark;
  }

  const cuts = [...new Set([...marks, ...extra])].sort((a, b) => a - b);

  const sentences: Sentence[] = [];
  let from = 0;

  for (const to of [...cuts, text.length]) {
    const piece = text.slice(from, to).trim();
    if (!piece) {
      from = to;
      continue;
    }

    const last = sentences[sentences.length - 1];
    // 短すぎる断片だけ取り残さず、前の文に付ける。
    if (piece.length < options.minChars && last) {
      last.text = `${last.text} ${piece}`;
      last.end = timeAt(stream, to);
    } else {
      sentences.push({
        id: sentences.length,
        start: timeAt(stream, from),
        end: timeAt(stream, to),
        text: piece,
      });
    }

    from = to;
  }

  return sentences;
}

/**
 * cue 列を練習用の文に組み直す。
 * 句読点があればそれを優先し、無い自動字幕では「無音ギャップ + 長さ上限」で切る。
 */
export function segmentCues(cues: Cue[], options: SegmentOptions = DEFAULT_SEGMENT_OPTIONS): Sentence[] {
  const clean = dedupeCues(cues);
  if (!clean.length) return [];

  const hasPunctuation = /[.!?。！？]/.test(clean.map((c) => c.text).join(' '));
  if (hasPunctuation) return segmentByPunctuation(clean, options);

  const minGap = options.gapThreshold;

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

    // ここに来るのは句読点が無い字幕だけ。頼れるのは無音と長さしかない。
    const shouldBreak =
      gap >= minGap || text.length >= options.maxChars || duration >= options.maxDuration;

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
