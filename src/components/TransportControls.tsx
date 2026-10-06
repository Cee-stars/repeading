import type { PracticeApi } from '../lib/usePractice';

interface Props {
  practice: PracticeApi;
  /** 流すものが無いときは再生を押させない。 */
  disabled?: boolean;
}

/** 再生まわりの操作。動画の教材でもフレーズ集でも同じものを使う。 */
export function TransportControls({ practice, disabled = false }: Props) {
  return (
    <div className="controls">
      <button type="button" className="ghost" onClick={practice.prev} title="← 前の文">
        ◀︎
      </button>
      <button type="button" className="primary wide" onClick={practice.toggle} disabled={disabled}>
        {practice.phase === 'listening'
          ? '停止'
          : practice.phase === 'understanding'
            ? '真似る'
            : practice.phase === 'mimicking'
              ? '次へ進む'
              : '再生'}
      </button>
      <button type="button" className="ghost" onClick={practice.replay} title="R もう一度">
        ↻
      </button>
      <button type="button" className="ghost" onClick={practice.next} title="→ 次の文">
        ▶︎
      </button>
    </div>
  );
}
