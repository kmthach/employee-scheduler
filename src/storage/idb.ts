const DB_NAME = "employee-scheduler"
const STORE = "kv"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("IndexedDB open blocked"))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      // Resolve only once the transaction is durable, not when the request succeeds.
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export function getItem(key: string): Promise<unknown> {
  return withStore("readonly", (s) => s.get(key))
}

export function setItem(key: string, value: unknown): Promise<IDBValidKey> {
  return withStore("readwrite", (s) => s.put(value, key))
}

export function removeItem(key: string): Promise<undefined> {
  return withStore("readwrite", (s) => s.delete(key))
}

export function clearAll(): Promise<undefined> {
  return withStore("readwrite", (s) => s.clear())
}
