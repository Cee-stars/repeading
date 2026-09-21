import { useState } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { PracticeView } from './components/PracticeView';
import type { Sentence } from './lib/types';

interface Material {
  videoId: string;
  sentences: Sentence[];
}

export default function App() {
  const [material, setMaterial] = useState<Material | null>(null);

  if (!material) {
    return (
      <ImportPanel onStart={(videoId, sentences) => setMaterial({ videoId, sentences })} />
    );
  }

  return (
    <PracticeView
      videoId={material.videoId}
      sentences={material.sentences}
      onBack={() => setMaterial(null)}
    />
  );
}
