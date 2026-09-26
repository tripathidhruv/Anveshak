/**
 * Per-key in-flight/most-recent Promise cache.
 *
 * Used by `httpApi.getRoutes` (Task G6) to stop the 4 screens that each independently call
 * `api.getRoutes(caseId)` (Route Choice, Evidence, Case Closed, Reports — see
 * `.superpowers/sdd/task-G6-report.md` for how this differs from the task brief's screen list)
 * from each re-running the entire live backend trace from scratch for the same case.
 *
 * Deliberately generic/pure (no dependency on `client.ts`/`import.meta.env`) so it can be unit
 * tested with plain `node --test` — this frontend has no test runner configured yet.
 */
export function createKeyedPromiseCache<T>() {
  const cache = new Map<string, Promise<T>>()

  return {
    /**
     * Returns the cached promise for `key` if one is already pending or resolved; otherwise
     * calls `fetcher()`, caches the resulting promise (not its resolved value, so concurrent
     * callers for the same key during the same tick dedupe against the in-flight request too),
     * and returns it.
     *
     * A rejected fetch is evicted from the cache so a later retry for the same key can fire a
     * fresh request instead of being stuck replaying a failure for the rest of the session.
     */
    get(key: string, fetcher: () => Promise<T>): Promise<T> {
      const existing = cache.get(key)
      if (existing) return existing

      const promise = fetcher()
      cache.set(key, promise)
      promise.catch(() => {
        if (cache.get(key) === promise) cache.delete(key)
      })
      return promise
    },

    /** Exposed for tests / a possible future explicit-invalidation hook — not called from app code. */
    clear(): void {
      cache.clear()
    },
  }
}
