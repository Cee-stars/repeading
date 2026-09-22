import { useCallback, useState } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { Library } from './components/Library';
import { PracticeView } from './components/PracticeView';
import { ThemeToggle } from './components/ThemeToggle';
import { useLibrary } from './lib/useLibrary';
import { useTheme } from './lib/useTheme';
import type { Material } from './lib/material';

export default function App() {
  const [material, setMaterial] = useState<Material | null>(null);
  const theme = useTheme();
  const library = useLibrary();

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
      setMaterial(updated);
      void save(updated);
    },
    [save],
  );

  return (
    <>
      <div className="topbar">
        <ThemeToggle {...theme} />
      </div>

      {material ? (
        <PracticeView
          key={material.id}
          material={material}
          onBack={() => setMaterial(null)}
          onChange={persist}
        />
      ) : (
        <ImportPanel onStart={open}>
          <Library
            materials={library.materials}
            status={library.status}
            remove={library.remove}
            onOpen={open}
          />
        </ImportPanel>
      )}
    </>
  );
}
