import type { Material } from './material';

const DB_NAME = 'repeading';
const DB_VERSION = 1;
const STORE = 'materials';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('failed to open IndexedDB'));
    // プライベートモードなどで権限を聞かれたまま固まることがある。
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });

  // 失敗を握ったままにせず、次回もう一度開けるようにする。
  dbPromise = pending;
  pending.catch(() => {
    dbPromise = null;
  });

  return pending;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** 新しく開いた順に教材を返す。 */
export async function listMaterials(): Promise<Material[]> {
  const all = await withStore('readonly', (store) => store.getAll() as IDBRequest<Material[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveMaterial(material: Material): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(material));
}

export function deleteMaterial(id: string): Promise<undefined> {
  return withStore('readwrite', (store) => store.delete(id));
}

/**
 * 保存領域を消さないようブラウザに頼む。
 * 許可されないと、Safari は一定期間サイトを開かないと保存を消す（ITP）。
 * 頼めるだけで確実ではないので、書き出しによる手元の控えも別に用意している。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
