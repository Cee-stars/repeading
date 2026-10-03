import { useEffect, useMemo, useRef, useState } from 'react';
import { joinWords, lookupsFor, normalizeWord, wordCount } from '../lib/dictionary';

/** なぞって範囲を伸ばせるよう、選択はトークンの位置で持つ。 */
interface Range {
  from: number;
  to: number;
}

interface Props {
  text: string;
  /** これまでに調べた語句（小文字）。字幕に印を付けるのに使う。 */
  lookedUp: Set<string>;
  onLookup: (phrase: string, context: string) => void;
}

/**
 * 字幕を、語句を選んで調べられるようにして描く。
 *
 * 1 語ずつしか押せないと `put up with` のような固まりに手が出ない。構成する語はどれも
 * 簡単なのに、一つずつ引いても意味にたどり着かないのが、ちょうど一番困るところだった。
 * なぞれば複数語を選べる。1 語だけ押すのは、長さ 0 のなぞりとして同じ経路を通る。
 */
export function CaptionWords({ text, lookedUp, onLookup }: Props) {
  // 空白も残して分けるので、つなぎ直せば元の見た目に戻る。
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const [range, setRange] = useState<Range | null>(null);
  const dragging = useRef(false);

  // 文が変われば前の文の選択は意味を持たない。
  useEffect(() => setRange(null), [text]);

  // 指を字幕の外で離しても、なぞりは終わらせる。
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  const span = range
    ? { lo: Math.min(range.from, range.to), hi: Math.max(range.from, range.to) }
    : null;
  const phrase = span ? joinWords(tokens.slice(span.lo, span.hi + 1)) : null;
  const lookups = phrase ? lookupsFor(phrase) : [];

  /**
   * その座標にある語の位置。
   * タッチでは最初に触れた要素に以降のイベントが寄るので、target ではなく座標で引き直す。
   */
  const tokenAt = (x: number, y: number): number | null => {
    const element = document.elementFromPoint(x, y);
    const word = element instanceof HTMLElement ? element.closest<HTMLElement>('[data-token]') : null;
    const index = word?.dataset.token;
    return index === undefined ? null : Number(index);
  };

  const extendTo = (x: number, y: number) => {
    const index = tokenAt(x, y);
    if (index === null) return;
    setRange((current) => (current && current.to !== index ? { ...current, to: index } : current));
  };

  return (
    <>
      <p
        className="caption-text reveal-shown"
        onPointerDown={(event) => {
          const index = tokenAt(event.clientX, event.clientY);
          if (index === null) return;
          // ブラウザ既定の文字選択と競合させない。
          event.preventDefault();
          dragging.current = true;
          setRange({ from: index, to: index });
        }}
        onPointerMove={(event) => {
          if (dragging.current) extendTo(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {tokens.map((token, index) => {
          const inSpan = span !== null && index >= span.lo && index <= span.hi;

          if (!token.trim()) {
            // 語と語の間も、範囲の内側なら continuous に見えるよう塗る。
            return (
              <span key={index} className={inSpan ? 'word-gap on' : 'word-gap'}>
                {token}
              </span>
            );
          }

          const word = normalizeWord(token);
          if (!word) return <span key={index}>{token}</span>;

          const classes = [
            'word',
            inSpan ? 'selected' : '',
            // 範囲の両端だけ角を丸める。途中の語を丸めると塗りが切れて見える。
            inSpan && index === span.lo ? 'span-start' : '',
            inSpan && index === span.hi ? 'span-end' : '',
            lookedUp.has(word.toLowerCase()) ? 'looked-up' : '',
          ];

          // button ではなく span。button の背景は行の高さいっぱいに塗られるので、
          // 間の空白（素の span）と高さが揃わず、選択範囲に白い切れ目が出る。
          // 選択自体は入れ物側の pointer イベントで取るため、button である必要もない。
          return (
            <span
              key={index}
              role="button"
              tabIndex={0}
              data-token={index}
              className={classes.join(' ')}
              // なぞれないキーボード操作でも、1 語だけは選べるようにしておく。
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                setRange({ from: index, to: index });
              }}
            >
              {token}
            </span>
          );
        })}
      </p>

      {!(phrase && lookups.length > 0) && (
        <p className="hint caption-note">
          単語を押すと調べられます。となりの語までなぞれば、まとめて調べられます。
        </p>
      )}

      {phrase && lookups.length > 0 && (
        <div className="lookup">
          <div className="lookup-head">
            <span className="lookup-phrase">{phrase}</span>
            <button
              type="button"
              className="ghost lookup-close"
              aria-label="選択をやめる"
              onClick={() => setRange(null)}
            >
              ×
            </button>
          </div>

          <div className="lookup-links">
            {lookups.map((lookup) => (
              <a
                key={lookup.key}
                className="lookup-link"
                href={lookup.url}
                target="_blank"
                rel="noopener noreferrer"
                title={lookup.hint}
                // 開くついでに記録する。覚えるための操作は増やさない。
                onClick={() => onLookup(phrase, text)}
              >
                {lookup.label}
              </a>
            ))}
          </div>

          <p className="hint lookup-hint">
            {wordCount(phrase) > 1
              ? '辞書に項目が無い言い回しは「例文」か「訳」が当たります。'
              : 'となりの語までなぞると、まとめて調べられます。'}
          </p>
        </div>
      )}
    </>
  );
}
