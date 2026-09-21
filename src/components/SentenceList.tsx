import { useEffect, useRef } from 'react';
import { formatTimestamp } from '../lib/time';
import type { Sentence } from '../lib/types';

interface Props {
  sentences: Sentence[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function SentenceList({ sentences, activeIndex, onSelect }: Props) {
  const activeRef = useRef<HTMLLIElement>(null);

  // 自動で次の文へ進むので、現在行を常に視界に入れておく。
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <ol className="sentence-list">
      {sentences.map((sentence, i) => (
        <li
          key={sentence.id}
          ref={i === activeIndex ? activeRef : undefined}
          className={i === activeIndex ? 'active' : ''}
        >
          <button type="button" onClick={() => onSelect(i)}>
            <span className="time">{formatTimestamp(sentence.start)}</span>
            <span className="text">{sentence.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
