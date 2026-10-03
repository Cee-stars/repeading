import type { Material } from './material';
import type { WordEntry } from './words';

const DB_NAME = 'repeading';
/** 2 で「調べた単語」の置き場を足した。既に使っている人の教材はそのまま残る。 */
const DB_VERSION = 2;
const MATERIALS = 'materials';
const WORDS = 'words';

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
      // 版を上げたときは、足りない置き場だけを作る。既存の中身は触らない。
      if (!db.objectStoreNames.contains(MATERIALS)) {
        db.createObjectStore(MATERIALS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WORDS)) {
        db.createObjectStore(WORDS, { keyPath: 'word' });
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
  name: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const request = run(transaction.objectStore(name));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** 新しく開いた順に教材を返す。 */
export async function listMaterials(): Promise<Material[]> {
  const all = await withStore(MATERIALS, 'readonly', (s) => s.getAll() as IDBRequest<Material[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveMaterial(material: Material): Promise<IDBValidKey> {
  return withStore(MATERIALS, 'readwrite', (store) => store.put(material));
}

export function deleteMaterial(id: string): Promise<undefined> {
  return withStore(MATERIALS, 'readwrite', (store) => store.delete(id));
}

/** 最後に調べた順に、調べた単語を返す。 */
export async function listWords(): Promise<WordEntry[]> {
  const all = await withStore(WORDS, 'readonly', (s) => s.getAll() as IDBRequest<WordEntry[]>);
  return all.sort((a, b) => b.lastAt - a.lastAt);
}

export function saveWord(entry: WordEntry): Promise<IDBValidKey> {
  return withStore(WORDS, 'readwrite', (store) => store.put(entry));
}

export function deleteWord(word: string): Promise<undefined> {
  return withStore(WORDS, 'readwrite', (store) => store.delete(word));
}

export function clearWords(): Promise<undefined> {
  return withStore(WORDS, 'readwrite', (store) => store.clear());
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
