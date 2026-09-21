/** 字幕ファイル上の 1 行（cue）。start/end は動画先頭からの秒数。 */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** 文分割エンジンが出力する、練習の 1 単位。 */
export interface Sentence {
  id: number;
  start: number;
  end: number;
  text: string;
}

export type SubtitleFormat = 'srt' | 'vtt' | 'youtube-transcript' | 'plain-text';

export interface ParseResult {
  format: SubtitleFormat;
  cues: Cue[];
  /** タイムスタンプを持たない入力（ベタテキスト）は再生区間を作れない。 */
  timed: boolean;
}

export interface SegmentOptions {
  /** この秒数以上の無音があれば文の切れ目とみなす。 */
  gapThreshold: number;
  /** 1 文の最大文字数。超えたら切る。 */
  maxChars: number;
  /** 1 文の最大秒数。超えたら切る。 */
  maxDuration: number;
  /** これ未満の文は次の文と結合する。 */
  minChars: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  gapThreshold: 0.6,
  maxChars: 80,
  maxDuration: 8,
  minChars: 3,
};
