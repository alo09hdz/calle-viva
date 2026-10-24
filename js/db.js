// Capa de persistencia asíncrona con IndexedDB
const DB_NAME = 'callevivaDB', STORE = 'reportes';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      s.createIndex('fecha', 'fecha');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run(mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(req.result); };
    t.onerror = t.onabort = () => rej(t.error);
  });
}

export const addReporte = (r) => run('readwrite', s => s.add(r));
export const getReportes = async () => (await run('readonly', s => s.getAll())).sort((a, b) => b.fecha - a.fecha);
export const deleteReporte = (id) => run('readwrite', s => s.delete(id));
