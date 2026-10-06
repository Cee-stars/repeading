import { useCallback, useEffect, useRef, useState } from 'react';
import type { Material } from './material';
import {
  buildPayload,
  mergeWithRemote,
  normalizeEndpoint,
  signature,
  type SyncSettings,
} from './sync';
import { fetchRemote, pushRemote, SyncError } from './syncClient';
import type { WordEntry } from './words';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error';

const STORAGE_KEY = 'repeading:sync';

/** 変更のたびに押しに行かないための間引き。練習中は進捗が頻繁に変わる。 */
const PUSH_DEBOUNCE_MS = 4000;

export interface SyncApi {
  settings: SyncSettings | null;
  status: SyncStatus;
  message: string | null;
  lastSyncedAt: number | null;
  /** 置き場を設定する。受け付けられなければ理由を返す。 */
  configure: (endpoint: string, key: string) => string | null;
  disable: () => void;
  syncNow: () => void;
}

interface Input {
  materials: Material[];
  words: WordEntry[];
  /** 手元の読み込みが終わっているか。終わる前に押すと空で上書きしかねない。 */
  ready: boolean;
  applyMaterials: (materials: Material[]) => Promise<number>;
  applyWords: (words: WordEntry[]) => Promise<number>;
}

function read(): SyncSettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<SyncSettings>;
    const endpoint = typeof value.endpoint === 'string' ? normalizeEndpoint(value.endpoint) : null;
    if (!endpoint || typeof value.key !== 'string' || !value.key) return null;
    return { endpoint, key: value.key };
  } catch {
    return null;
  }
}

/**
 * 置き場と突き合わせて、端末をまたいで同じ状態にする。
 *
 * 流れは 引く → 混ぜる → 必要なら書き戻す / 押す。
 * 混ぜる判断は `mergeWithRemote`（教材は更新が新しい方、単語は回数の多い方）。
 */
export function useSync({ materials, words, ready, applyMaterials, applyWords }: Input): SyncApi {
  const [settings, setSettings] = useState<SyncSettings | null>(read);
  const [status, setStatus] = useState<SyncStatus>(() => (read() ? 'idle' : 'off'));
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // 走っている間に二重で走らせない。
  const running = useRef(false);
  // 最後に合わせ終えた時点の指紋。これと変わらない限り押しに行かない。
  const syncedSignature = useRef<string | null>(null);
  const latest = useRef({ materials, words, settings, applyMaterials, applyWords });
  latest.current = { materials, words, settings, applyMaterials, applyWords };

  const run = useCallback(async () => {
    const { settings: config, materials: local, words: localWords } = latest.current;
    if (!config || running.current) return;

    running.current = true;
    setStatus('syncing');
    setMessage(null);

    try {
      let remote = await fetchRemote(config);
      let merged = mergeWithRemote({ materials: local, words: localWords }, remote.payload);

      if (merged.shouldApply) {
        await latest.current.applyMaterials(merged.materials);
        await latest.current.applyWords(merged.words);
      }

      if (merged.shouldPush) {
        let result = await pushRemote(config, buildPayload(merged.materials, merged.words), remote.rev);

        // 別の端末が先に書いていた。返ってきた中身と混ぜ直して、もう一度だけ出す。
        if (!result.ok) {
          remote = result.remote;
          merged = mergeWithRemote(
            { materials: merged.materials, words: merged.words },
            remote.payload,
          );

          if (merged.shouldApply) {
            await latest.current.applyMaterials(merged.materials);
            await latest.current.applyWords(merged.words);
          }

          result = await pushRemote(
            config,
            buildPayload(merged.materials, merged.words),
            remote.rev,
          );

          if (!result.ok) {
            throw new SyncError('他の端末と書き込みがぶつかりました。少し後にもう一度試します。');
          }
        }
      }

      syncedSignature.current = signature(merged.materials, merged.words);
      setLastSyncedAt(Date.now());
      setStatus('ok');
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof SyncError ? error.message : '同期できませんでした。',
      );
    } finally {
      running.current = false;
    }
  }, []);

  const syncNow = useCallback(() => {
    void run();
  }, [run]);

  // 開いたとき、そして画面に戻ってきたとき。別の端末で進めた続きを拾う。
  useEffect(() => {
    if (!settings || !ready) return;

    void run();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [settings, ready, run]);

  // 手元が変わったら押しに行く。間引かないと、文を移るたびに通信してしまう。
  useEffect(() => {
    if (!settings || !ready) return;

    const current = signature(materials, words);
    if (current === syncedSignature.current) return;

    const timer = window.setTimeout(() => void run(), PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [materials, words, settings, ready, run]);

  const configure = useCallback((endpoint: string, key: string): string | null => {
    const url = normalizeEndpoint(endpoint);
    if (!url) return '置き場の URL が読み取れません（https で始まる必要があります）。';

    const trimmed = key.trim();
    if (trimmed.length < 20) return '同期キーが短すぎます。';

    const next = { endpoint: url, key: trimmed };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return 'この端末では設定を保存できませんでした。';
    }

    syncedSignature.current = null;
    setSettings(next);
    setStatus('idle');
    setMessage(null);
    return null;
  }, []);

  const disable = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 消せなくても、この画面では使わない状態にする。
    }
    syncedSignature.current = null;
    setSettings(null);
    setStatus('off');
    setMessage(null);
    setLastSyncedAt(null);
  }, []);

  return { settings, status, message, lastSyncedAt, configure, disable, syncNow };
}
