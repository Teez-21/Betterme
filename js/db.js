// ============================================
// BetterME — Data layer (IndexedDB)
// Offline-first storage. No cloud services.
// ============================================

const DB_NAME = 'betterme_db';
const DB_VERSION = 2;

const STORES = [
  'habits', 'habitLogs', 'challenges',
  'calendarItems', // events, birthdays, others, projects (with nested phases/tasks)
  'accounts', 'transactions', 'categories', 'savingGoals',
  'budgets', 'debts', 'receivables', 'frequentExpenses', 'wishlist',
  'settings'
];

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DB = {
  uuid,

  async getAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async get(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async put(store, obj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async bulkPut(store, arr) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      arr.forEach(obj => os.put(obj));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async delete(store, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async clearAll() {
    for (const s of STORES) await this.clear(s);
  },

  async exportAll() {
    const data = {};
    for (const s of STORES) data[s] = await this.getAll(s);
    return { exportedAt: new Date().toISOString(), app: 'BetterME', version: DB_VERSION, data };
  },

  async importAll(payload) {
    if (!payload || !payload.data) throw new Error('Archivo inválido');
    for (const s of STORES) {
      if (payload.data[s]) {
        await this.clear(s);
        await this.bulkPut(s, payload.data[s]);
      }
    }
  }
};

// Settings helpers (single-row stores keyed by fixed id)
DB.getSetting = async (key, fallback = null) => {
  const row = await DB.get('settings', key);
  return row ? row.value : fallback;
};
DB.setSetting = async (key, value) => {
  await DB.put('settings', { id: key, value });
};
