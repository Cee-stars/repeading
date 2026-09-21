import { useState } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { PracticeView } from './components/PracticeView';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './lib/useTheme';
import type { Sentence } from './lib/types';

interface Material {
  videoId: string;
  sentences: Sentence[];
}

export default function App() {
  const [material, setMaterial] = useState<Material | null>(null);
  const theme = useTheme();

  return (
    <>
      <div className="topbar">
        <ThemeToggle {...theme} />
      </div>

      {material ? (
        <PracticeView
          videoId={material.videoId}
          sentences={material.sentences}
          onBack={() => setMaterial(null)}
        />
      ) : (
        <ImportPanel onStart={(videoId, sentences) => setMaterial({ videoId, sentences })} />
      )}
    </>
  );
}
