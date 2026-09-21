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

  // 練習中の進捗は保存するだけ。開いている教材を差し替えると練習が揺れるので触らない。
  const persist = useCallback((updated: Material) => void save(updated), [save]);

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
