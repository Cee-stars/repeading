import { useCallback, useMemo, useState } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { Library } from './components/Library';
import { PhrasePractice } from './components/PhrasePractice';
import { PhraseSet } from './components/PhraseSet';
import { PracticeView } from './components/PracticeView';
import { SyncPanel } from './components/SyncPanel';
import { ThemeToggle } from './components/ThemeToggle';
import { WordList } from './components/WordList';
import { collectPhrases } from './lib/phrases';
import { useLibrary } from './lib/useLibrary';
import { useTheme } from './lib/useTheme';
import { reloadFresh, useUpdateCheck } from './lib/useUpdateCheck';
import { useSync } from './lib/useSync';
import { useWords } from './lib/useWords';
import type { Material } from './lib/material';

export default function App() {
  const [material, setMaterial] = useState<Material | null>(null);
  const [inPhraseSet, setInPhraseSet] = useState(false);
  const theme = useTheme();
  const library = useLibrary();
  const words = useWords();
  const stale = useUpdateCheck();

  // 字幕側は語ごとに引くので、毎回配列を探さずに済む形で渡す。
  const lookedUp = useMemo(
    () => new Set(words.words.map((entry) => entry.word.toLowerCase())),
    [words.words],
  );

  // つまずいた文を全教材から集めたもの。教材を開かなくても練習できる。
  const phrases = useMemo(
    () => collectPhrases(library.materials, words.words),
    [library.materials, words.words],
  );

  // 置き場と突き合わせて、端末をまたいで同じ状態にする。
  // 手元の読み込みが終わる前に走らせると、空の状態で押しかねないので ready を見る。
  const sync = useSync({
    materials: library.materials,
    words: words.words,
    ready: library.status === 'ready',
    applyMaterials: library.importMaterials,
    applyWords: words.importWords,
  });

  const { save } = library;

  const open = useCallback(
    (opened: Material) => {
      void save(opened);
      setMaterial(opened);
    },
    [save],
  );

  // 進捗の保存も、文の編集も同じ経路を通す。
  // 文を編集していないときは sentences の参照が変わらないので、練習の状態は揺れない。
  const persist = useCallback(
    (updated: Material) => {
      // 画面を離れるときにも保存が走る。いま開いている教材でなければ差し替えない。
      // そうしないと、閉じた直後の保存が教材を復活させて練習画面に戻ってしまう。
      setMaterial((current) => (current?.id === updated.id ? updated : current));
      void save(updated);
    },
    [save],
  );

  return (
    <>
      {stale && (
        <div className="update-banner">
          <span>新しい版が公開されています。</span>
          <button type="button" className="primary" onClick={reloadFresh}>
            読み込み直す
          </button>
        </div>
      )}

      <div className="topbar">
        <ThemeToggle {...theme} />
      </div>

      {inPhraseSet ? (
        <PhrasePractice
          phrases={phrases}
          onBack={() => setInPhraseSet(false)}
          lookedUp={lookedUp}
          onLookup={words.record}
        />
      ) : material ? (
        <PracticeView
          key={material.id}
          material={material}
          onBack={() => setMaterial(null)}
          onChange={persist}
          lookedUp={lookedUp}
          onLookup={words.record}
        />
      ) : (
        <ImportPanel onStart={open}>
          <Library
            materials={library.materials}
            status={library.status}
            persisted={library.persisted}
            remove={library.remove}
            onOpen={open}
            onImport={library.importMaterials}
            onImportWords={words.importWords}
            words={words.words}
          />
          <PhraseSet phrases={phrases} onStart={() => setInPhraseSet(true)} />
          <WordList
            words={words.words}
            available={words.available}
            remove={words.remove}
            clear={words.clear}
          />
          <SyncPanel {...sync} />
        </ImportPanel>
      )}
    </>
  );
}
