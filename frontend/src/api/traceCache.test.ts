/**
 * Plain `node --test` unit tests for `traceCache.ts` (Task G6).
 *
 * This frontend has no test runner configured (`package.json` has no `test` script and no
 * vitest/jest/jsdom dependency) — see the G6 report for the full note. `httpApi.ts` itself
 * can't be imported directly outside Vite (`client.ts`'s top-level `import.meta.env` access
 * throws under plain Node), so this file exercises the extracted, dependency-free cache
 * (`createKeyedPromiseCache`) that `httpApi.getRoutes` wraps around `startTrace`, using a
 * hand-rolled fetcher mock in place of the real HTTP client.
 *
 * Run with:
 *   cd frontend && node --test src/api/traceCache.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createKeyedPromiseCache } from './traceCache.ts'

test('two calls for the SAME key before the first resolves dedupe to one fetch', async () => {
  const cache = createKeyedPromiseCache<{ id: string }>()
  let calls = 0
  const fetcher = () => {
    calls += 1
    return new Promise<{ id: string }>((resolve) => setTimeout(() => resolve({ id: 'case-A' }), 10))
  }

  const p1 = cache.get('case-A', fetcher)
  const p2 = cache.get('case-A', fetcher) // fired before p1 resolves — must dedupe against the in-flight promise

  const [r1, r2] = await Promise.all([p1, p2])

  assert.equal(calls, 1, 'fetcher should only run once for two concurrent calls with the same key')
  assert.equal(r1, r2, 'both callers should receive the exact same resolved result')
  assert.deepEqual(r1, { id: 'case-A' })
})

test('a call for the same key AFTER the first resolves still reuses the cached promise', async () => {
  const cache = createKeyedPromiseCache<{ id: string }>()
  let calls = 0
  const fetcher = () => {
    calls += 1
    return Promise.resolve({ id: 'case-A' })
  }

  await cache.get('case-A', fetcher)
  await cache.get('case-A', fetcher)

  assert.equal(calls, 1, 'a second call for a case already traced this session should not re-fetch')
})

test('two DIFFERENT keys each make their own independent fetch — no cross-case caching', async () => {
  const cache = createKeyedPromiseCache<{ id: string }>()
  const seen: string[] = []
  const fetcher = (id: string) => {
    seen.push(id)
    return Promise.resolve({ id })
  }

  const [rA, rB] = await Promise.all([
    cache.get('case-A', () => fetcher('case-A')),
    cache.get('case-B', () => fetcher('case-B')),
  ])

  assert.deepEqual(seen.sort(), ['case-A', 'case-B'], 'both distinct case ids should trigger their own fetch')
  assert.deepEqual(rA, { id: 'case-A' })
  assert.deepEqual(rB, { id: 'case-B' })
})

test('a rejected fetch is evicted so a later retry for the same key fires a fresh request', async () => {
  const cache = createKeyedPromiseCache<{ id: string }>()
  let calls = 0
  const fetcher = () => {
    calls += 1
    if (calls === 1) return Promise.reject(new Error('network read failure'))
    return Promise.resolve({ id: 'case-A' })
  }

  await assert.rejects(cache.get('case-A', fetcher))
  // give the internal .catch() eviction a microtask turn to run
  await Promise.resolve()
  await Promise.resolve()

  const result = await cache.get('case-A', fetcher)

  assert.equal(calls, 2, 'the failed first attempt should not permanently poison the cache for this case')
  assert.deepEqual(result, { id: 'case-A' })
})
