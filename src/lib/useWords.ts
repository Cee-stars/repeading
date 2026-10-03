import { useCallback, useEffect, useRef, useState } from 'react';
import { clearWords, deleteWord, listWords, saveWord } from './db';
import { mergeWords, recordLookup, type WordEntry } from './words';

export interface WordsApi {
  words: WordEntry[];
  /** 保存が使えない環境では false。練習も辞書を引くことも続けられる。 */
  available: boolean;
  /** 辞書を開いた語を記録する。 */
  record: (word: string, context: string, from: string) => void;
  remove: (word: string) => Promise<void>;
  clear: () => Promise<void>;
  /** 控えから取り込む。取り込んだあとの総数を返す。 */
  importWords: (incoming: WordEntry[]) => Promise<number>;
}

export function useWords(): WordsApi {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [available, setAvailable] = useState(true);

  // record は辞書を開く操作のついでに走る。最新の一覧を依存配列に出さずに読むため。
  const latest = useRef<WordEntry[]>([]);
  latest.current = words;

  useEffect(() => {
    listWords()
      .then(setWords)
      .catch(() => setAvailable(false));
  }, []);

  const record = useCallback((word: string, context: string, from: string) => {
    const next = recordLookup(latest.current, word, context, from);
    // 画面はすぐ更新する。書き込みを待たせると、辞書を開く動きが引っかかる。
    setWords(next);
    // 変わったのは 1 件だけなので、その 1 件だけ書く。
    saveWord(next[0]).catch(() => setAvailable(false));
  }, []);

  const remove = useCallback(async (word: string) => {
    try {
      await deleteWord(word);
    } catch {
      setAvailable(false);
      return;
    }
    setWords((previous) => previous.filter((entry) => entry.word !== word));
  }, []);

  const clear = useCallback(async () => {
    try {
      await clearWords();
    } catch {
      setAvailable(false);
      return;
    }
    setWords([]);
  }, []);

  const importWords = useCallback(async (incoming: WordEntry[]) => {
    const merged = mergeWords(latest.current, incoming);
    try {
      for (const entry of merged) await saveWord(entry);
    } catch {
      setAvailable(false);
      return 0;
    }
    setWords(merged);
    return merged.length;
  }, []);

  return { words, available, record, remove, clear, importWords };
}
