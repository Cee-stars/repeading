import { difficultyAdvice, type Difficulty } from '../lib/difficulty';

interface Props {
  difficulty: Difficulty;
}

/**
 * 教材の手応えを出す。動画を外から見て当てるのは難しいが、
 * 字幕を貼った時点で材料は揃っているので、始める前に示せる。
 */
export function DifficultyMeter({ difficulty }: Props) {
  const advice = difficultyAdvice(difficulty);

  return (
    <div className="difficulty">
      <div className="difficulty-head">
        <span className="difficulty-label">{difficulty.label}</span>
        <span
          className="difficulty-dots"
          role="img"
          aria-label={`手応え 5 段階中 ${difficulty.level}`}
        >
          {[1, 2, 3, 4, 5].map((step) => (
            <span key={step} className={step <= difficulty.level ? 'dot on' : 'dot'} />
          ))}
        </span>
      </div>

      <dl className="difficulty-stats">
        <div>
          <dt>話す速さ</dt>
          <dd>
            {difficulty.wordsPerMinute} <span className="unit">語/分</span>
          </dd>
        </div>
        <div>
          <dt>1 文の長さ</dt>
          <dd>
            {difficulty.wordsPerSentence} <span className="unit">語</span>
          </dd>
        </div>
        <div>
          <dt>読みやすさ</dt>
          <dd>
            {difficulty.readingEase} <span className="unit">/ 100</span>
          </dd>
        </div>
      </dl>

      {advice && <p className="hint">{advice}</p>}
    </div>
  );
}
