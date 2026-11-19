/**
 * The storage table the adapter needs: DSH `storageDomain` `KvTable` (dsh-storage-domain 0.2.2-rc.2
 * `domain.d.ts:37-95`: `get` is synchronous there; awaiting it works either way). `keys` and `deleteMany` are used
 * for the 14-day retention when present.
 */
export interface KvLike {
  get(key: string): unknown;
  put(key: string, value: unknown): Promise<void>;
  delete?(key: string): Promise<unknown>;
  keys?(): Iterable<string>;
  deleteMany?(keys: readonly string[]): Promise<unknown>;
}

/** An in-memory table (tests, and when the host has no storage). */
export function memoryKv(): KvLike & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: (k) => (data.has(k) ? structuredClone(data.get(k)) : undefined),
    put: async (k, v) => { data.set(k, structuredClone(v)); },
    delete: async (k) => data.delete(k),
    keys: () => [...data.keys()],
    deleteMany: async (ks) => { let n = 0; for (const k of ks) if (data.delete(k)) n++; return n; },
  };
}
