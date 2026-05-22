/**
 * Generic IndexedDB layer for QPaper Gen.
 * Stores papers (store: 'papers') and sources (store: 'sources').
 * Provides a one-time migration from localStorage on first run.
 * All public helpers are async; callers maintain their own in-memory
 * caches so UI reads stay synchronous.
 */

const DB_NAME    = 'qpg';
const DB_VERSION = 1;
const STORES     = ['papers', 'sources'] as const;

let _db: IDBDatabase | null = null;

// ── Open (or reuse) the database ──────────────────────────────────────────
function open(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror   = () => reject(req.error);
  });
}

// ── Primitive operations ───────────────────────────────────────────────────
export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function dbPut<T>(store: string, value: T): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function dbDelete(store: string, key: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── One-time migration from localStorage ──────────────────────────────────
async function migrateFromLocalStorage(): Promise<void> {
  const migrations = [
    { lsKey: 'questionPapers', store: 'papers'  },
    { lsKey: 'qpg_sources',    store: 'sources' },
  ];

  for (const { lsKey, store } of migrations) {
    const raw = localStorage.getItem(lsKey);
    if (!raw) continue;
    try {
      const items = JSON.parse(raw) as any[];
      for (const item of items) await dbPut(store, item);
      localStorage.removeItem(lsKey);
      console.log(`[DB] Migrated ${items.length} ${store} from localStorage → IndexedDB`);
    } catch (e) {
      console.warn(`[DB] Migration failed for ${store}:`, e);
    }
  }
}

// ── Initialise: open DB, migrate, return seed data for caches ─────────────
export async function initDB(): Promise<{ papers: any[]; sources: any[] }> {
  await open();
  await migrateFromLocalStorage();
  const [papers, sources] = await Promise.all([
    dbGetAll<any>('papers'),
    dbGetAll<any>('sources'),
  ]);
  console.log(`[DB] Loaded ${papers.length} papers, ${sources.length} sources from IndexedDB`);
  return { papers, sources };
}
