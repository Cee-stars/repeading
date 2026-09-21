import { useCallback, useEffect, useRef, useState } from 'react';

/** IFrame Player API のうち、このアプリが使う部分だけ型を置く。 */
interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (el: HTMLElement, options: unknown) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** 区間終端の判定間隔。YouTube API に「ここまで再生」は無いのでポーリングする。 */
const POLL_INTERVAL_MS = 50;
/** 頭切れを防ぐため、開始を少し手前にずらす。 */
const LEAD_IN = 0.08;
/** 語尾が切れないよう、終端を少し後ろにずらす。 */
const TAIL_OUT = 0.12;
/** シーク完了前の古い再生位置で誤判定しないための許容幅。 */
const ARM_TOLERANCE = 0.3;

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });

  return apiPromise;
}

interface RangeWatch {
  start: number;
  end: number;
  /** シーク完了を確認したか。確認前は終端判定を行わない。 */
  armed: boolean;
  onComplete: () => void;
}

export interface YouTubePlayerApi {
  containerRef: React.RefObject<HTMLDivElement>;
  ready: boolean;
  playing: boolean;
  /** start〜end だけ再生し、終端で自動停止して onComplete を呼ぶ。 */
  playRange: (start: number, end: number, onComplete: () => void) => void;
  /** 区間再生を中断してその場で停止する。 */
  stop: () => void;
  setPlaybackRate: (rate: number) => void;
}

export function useYouTubePlayer(videoId: string | null): YouTubePlayerApi {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const watchRef = useRef<RangeWatch | null>(null);
  const timerRef = useRef<number | null>(null);
  const rateRef = useRef(1);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    watchRef.current = null;
    clearTimer();
    playerRef.current?.pauseVideo();
  }, [clearTimer]);

  const tick = useCallback(() => {
    const watch = watchRef.current;
    const player = playerRef.current;
    if (!watch || !player) return;

    const now = player.getCurrentTime();

    if (!watch.armed) {
      // シークが届くまでは古い位置が返るので、区間内に入るまで待つ。
      if (now < watch.start - ARM_TOLERANCE || now > watch.end + 1) return;
      watch.armed = true;
    }

    if (now >= watch.end) {
      watchRef.current = null;
      clearTimer();
      player.pauseVideo();
      watch.onComplete();
    }
  }, [clearTimer]);

  const playRange = useCallback(
    (start: number, end: number, onComplete: () => void) => {
      const player = playerRef.current;
      if (!player) return;

      clearTimer();
      watchRef.current = {
        start: Math.max(0, start - LEAD_IN),
        end: end + TAIL_OUT,
        armed: false,
        onComplete,
      };

      player.seekTo(Math.max(0, start - LEAD_IN), true);
      player.setPlaybackRate(rateRef.current);
      player.playVideo();
      timerRef.current = window.setInterval(tick, POLL_INTERVAL_MS);
    },
    [clearTimer, tick],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    rateRef.current = rate;
    playerRef.current?.setPlaybackRate(rate);
  }, []);

  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let cancelled = false;
    const host = document.createElement('div');
    containerRef.current.appendChild(host);

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      playerRef.current = new YT.Player(host, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            setPlaying(event.data === YT.PlayerState.PLAYING);
            // ユーザーが YouTube 側の操作で止めたら区間監視も解除する。
            if (event.data === YT.PlayerState.ENDED) {
              watchRef.current = null;
              clearTimer();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearTimer();
      watchRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      host.remove();
      setReady(false);
      setPlaying(false);
    };
  }, [videoId, clearTimer]);

  return { containerRef, ready, playing, playRange, stop, setPlaybackRate };
}
