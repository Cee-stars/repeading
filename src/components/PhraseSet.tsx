import { longPhrases, LONG_PHRASE_WORDS, videoSwitches, type Phrase } from '../lib/phrases';

interface Props {
  phrases: Phrase[];
  onStart: () => void;
}

/**
 * フレーズ集の入り口。
 * 自分が苦手マークを付けた文と、語句を調べた文を、全教材から集めたもの。
 */
export function PhraseSet({ phrases, onStart }: Props) {
  const long = longPhrases(phrases);
  const sources = new Set(phrases.map((phrase) => phrase.materialId)).size;

  return (
    <section className="phrase-set">
      <h2>
        フレーズ集
        {phrases.length > 0 && <span className="words-count">{phrases.length}</span>}
      </h2>

      {phrases.length === 0 ? (
        <p className="hint">
          練習中に <strong>★ 苦手</strong> を付けた文と、語句を調べた文が、
          教材をまたいでここに集まります。つまずいた文だけなので、
          自分のレベルにちょうど合った練習材料になります。
        </p>
      ) : (
        <>
          <p className="hint">
            {sources} 件の教材から集めました（長めのものは {long.length} 件）。
            どの文も元の動画から再生するので、本物の音声のまま練習できます。
          </p>

          <div className="row">
            <button type="button" className="ghost" onClick={onStart}>
              フレーズ集を練習する
            </button>
          </div>

          <p className="hint">
            練習画面で「長めのフレーズだけ」に絞ると、{LONG_PHRASE_WORDS} 語以上のものだけを流せます。
            {videoSwitches(phrases) > 0 &&
              ` 動画の切り替わりは ${videoSwitches(phrases)} 回で、そこだけ読み込みを待ちます。`}
          </p>
        </>
      )}
    </section>
  );
}
