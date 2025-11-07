type Entry<T> = { value: T; expiresAt: number };
 
const store = new Map<string, Entry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function getCache<T = unknown>(key: string): T | undefined {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCache<T = unknown>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const expiresAt = Date.now() + Math.max(0, ttlMs);
  store.set(key, { value, expiresAt });
}

export function delCache(key: string): void {
  store.delete(key);
}

export function clearCache(): void {
  store.clear();
}
