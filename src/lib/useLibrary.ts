import { useCallback, useEffect, useState } from 'react';
import { deleteMaterial, listMaterials, saveMaterial } from './db';
import type { Material } from './material';

/** 保存が使えない環境（プライベートモードなど）では unavailable になる。練習自体は続けられる。 */
export type LibraryStatus = 'loading' | 'ready' | 'unavailable';

export interface LibraryApi {
  materials: Material[];
  status: LibraryStatus;
  save: (material: Material) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useLibrary(): LibraryApi {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');

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

  return { materials, status, save, remove };
}
