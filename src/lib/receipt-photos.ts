const NAME = "splitin-photos";
const STORE = "photos";
const KEEP = 30 * 24 * 60 * 60 * 1000;

type Saved = { blob: Blob; at: number };

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await open();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(request ? request.result : null);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function savePhoto(id: string, blob: Blob) {
  const now = Date.now();
  await run("readwrite", (store) => {
    store.put({ blob, at: now } satisfies Saved, id);
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) return;
      if (now - (row.value as Saved).at > KEEP) row.delete();
      row.continue();
    };
  });
}

export async function loadPhoto(id: string): Promise<Blob | null> {
  const saved = (await run("readonly", (store) => store.get(id))) as Saved | undefined | null;
  return saved?.blob ?? null;
}

export async function movePhoto(from: string, to: string) {
  if (from === to) return;
  await run("readwrite", (store) => {
    const request = store.get(from);
    request.onsuccess = () => {
      if (!request.result) return;
      store.put(request.result, to);
      store.delete(from);
    };
  });
}
