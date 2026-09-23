import { useCallback, useEffect, useState } from 'react';
import { mergeMaterials } from './backup';
import { deleteMaterial, listMaterials, requestPersistentStorage, saveMaterial } from './db';
import type { Material } from './material';

/** 保存が使えない環境（プライベートモードなど）では unavailable になる。練習自体は続けられる。 */
export type LibraryStatus = 'loading' | 'ready' | 'unavailable';

export interface LibraryApi {
  materials: Material[];
  status: LibraryStatus;
  /** ブラウザが保存領域を消さないと約束したか。 */
  persisted: boolean;
  save: (material: Material) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** 書き出したファイルから取り込む。取り込んだ件数を返す。 */
  importMaterials: (incoming: Material[]) => Promise<number>;
}

export function useLibrary(): LibraryApi {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [persisted, setPersisted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMaterials(await listMaterials());
      setStatus('ready');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void refresh();
    // 保存を消されないよう、開いた時点で頼んでおく。
    void requestPersistentStorage().then(setPersisted);
  }, [refresh]);

  const save = useCallback(
    async (material: Material) => {
      try {
        await saveMaterial(material);
      } catch {
        setStatus('unavailable');
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteMaterial(id);
      } catch {
        setStatus('unavailable');
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const importMaterials = useCallback(
    async (incoming: Material[]) => {
      // 同じ id は更新が新しい方を残すので、取り込みで進捗が巻き戻らない。
      const merged = mergeMaterials(await listMaterials(), incoming);
      for (const material of merged) await saveMaterial(material);
      await refresh();
      return incoming.length;
    },
    [refresh],
  );

  return { materials, status, persisted, save, remove, importMaterials };
}
