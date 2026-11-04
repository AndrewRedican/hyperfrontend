import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCache, peekCached, rateLimit, readCached, subscribeRate } from './cache'

const URL_ONE = 'https://api.github.com/repos/x/y/actions/runs?per_page=1'

/**
 * A response with a JSON body and GitHub's headers.
 * @param body - What the body parses to
 * @param status - The status code answered
 * @param headers - Extra headers
 * @returns The response
 */
function reply(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '41', 'x-ratelimit-reset': '1700000000', etag: 'W/"one"', ...headers },
  })
}

describe('readCached', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCache()
    window.localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches a cold address once', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 }))
    expect(await readCached(URL_ONE, { maxAgeMs: 1000 })).toEqual(expect.objectContaining({ value: { ok: 1 }, etag: 'W/"one"' }))
  })

  it('shares one request between readers asking at once', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 }))
    await Promise.all([readCached(URL_ONE, { maxAgeMs: 1000 }), readCached(URL_ONE, { maxAgeMs: 1000 })])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers from the held copy while it is young', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 }))
    await readCached(URL_ONE, { maxAgeMs: 60_000 })
    await readCached(URL_ONE, { maxAgeMs: 60_000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends the held entity tag once the copy is old', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 })).mockResolvedValueOnce(reply(null, 304))
    await readCached(URL_ONE, { maxAgeMs: 0 })
    await readCached(URL_ONE, { maxAgeMs: 0 })
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('if-none-match')).toBe('W/"one"')
  })

  it('keeps the held copy when GitHub says it has not changed', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 })).mockResolvedValueOnce(reply(null, 304))
    await readCached(URL_ONE, { maxAgeMs: 0 })
    expect((await readCached(URL_ONE, { maxAgeMs: 0 })).value).toEqual({ ok: 1 })
  })

  it('keeps the held copy when a later request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ ok: 1 }))
      .mockResolvedValueOnce(reply({ message: 'rate limited' }, 403, { 'x-ratelimit-remaining': '0' }))
    await readCached(URL_ONE, { maxAgeMs: 0 })
    expect((await readCached(URL_ONE, { maxAgeMs: 0 })).value).toEqual({ ok: 1 })
  })

  it('throws when the first request fails', async () => {
    fetchMock.mockResolvedValueOnce(reply({ message: 'no' }, 500))
    await expect(readCached(URL_ONE, { maxAgeMs: 0 })).rejects.toThrow('answered 500')
  })

  it('notes the rate limit of every response, refusals included', async () => {
    const seen: (number | null)[] = []
    const unsubscribe = subscribeRate(() => seen.push(rateLimit().remaining))
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 })).mockResolvedValueOnce(reply({ message: 'no' }, 403, { 'x-ratelimit-remaining': '0' }))
    await readCached(URL_ONE, { maxAgeMs: 0 })
    await readCached(URL_ONE, { maxAgeMs: 0 })
    unsubscribe()
    expect(seen).toEqual([41, 0])
  })

  it('persists a copy for the next visit when asked', async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: 1 }))
    await readCached(URL_ONE, { maxAgeMs: 0, persist: true })
    clearCache()
    expect(peekCached(URL_ONE)).toEqual(expect.objectContaining({ value: { ok: 1 } }))
  })

  it('holds nothing for an address never read', () => {
    expect(peekCached('https://example.test/none')).toBeNull()
  })
})
