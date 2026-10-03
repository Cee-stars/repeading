/** 調べた単語 1 件。`word` を鍵にして貯める。 */
export interface WordEntry {
  word: string;
  /** 調べた回数。繰り返し引く語ほど、覚えられていない語。 */
  count: number;
  firstAt: number;
  lastAt: number;
  /** 最後に調べたときに出てきた文。語だけより思い出しやすい。 */
  context: string;
  /** どの教材で出てきたか。 */
  from: string;
}

/**
 * 調べた語を記録する。同じ語は数えるだけにして、一覧が同じ語で埋まらないようにする。
 * 文と出どころは新しいほうで上書きする（直近に出会った文のほうが思い出しやすい）。
 */
export function recordLookup(
  entries: WordEntry[],
  word: string,
  context: string,
  from: string,
  now = Date.now(),
): WordEntry[] {
  const key = word.toLowerCase();
  const current = entries.find((entry) => entry.word.toLowerCase() === key);

  const updated: WordEntry = current
    ? { ...current, count: current.count + 1, lastAt: now, context, from }
    : { word, count: 1, firstAt: now, lastAt: now, context, from };

  return [updated, ...entries.filter((entry) => entry.word.toLowerCase() !== key)];
}

/** 新しく調べた順。履歴として見るときの並び。 */
export function byRecent(entries: WordEntry[]): WordEntry[] {
  return [...entries].sort((a, b) => b.lastAt - a.lastAt);
}

/** よく引く順。覚えられていない語を先に出す。 */
export function byFrequency(entries: WordEntry[]): WordEntry[] {
  return [...entries].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}

/** 取り込んだ記録を突き合わせる。同じ語は多いほうの回数を残し、二重に数えない。 */
export function mergeWords(existing: WordEntry[], incoming: WordEntry[]): WordEntry[] {
  const byWord = new Map(existing.map((entry) => [entry.word.toLowerCase(), entry]));

  for (const entry of incoming) {
    const key = entry.word.toLowerCase();
    const current = byWord.get(key);

    if (!current) {
      byWord.set(key, entry);
      continue;
    }

    // 同じファイルを二度読み込んでも増えないよう、足さずに大きいほうを採る。
    const newer = entry.lastAt > current.lastAt ? entry : current;
    byWord.set(key, {
      ...newer,
      count: Math.max(current.count, entry.count),
      firstAt: Math.min(current.firstAt, entry.firstAt),
      lastAt: Math.max(current.lastAt, entry.lastAt),
    });
  }

  return byRecent([...byWord.values()]);
}

/** 書き出したファイルから読むので、形を確かめてから受け入れる。 */
export function isWordEntry(value: unknown): value is WordEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WordEntry>;
  return (
    typeof entry.word === 'string' &&
    entry.word !== '' &&
    typeof entry.count === 'number' &&
    typeof entry.firstAt === 'number' &&
    typeof entry.lastAt === 'number' &&
    typeof entry.context === 'string' &&
    typeof entry.from === 'string'
  );
}
