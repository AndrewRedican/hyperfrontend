import type { FetchText } from './fetch'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { apiUrl, createFetch, rawFileUrl, readRemoteFile, readRemoteJson } from './fetch'

/**
 * A fetcher answering from a table of URLs.
 *
 * @param answers - URL to status and body
 * @returns A fetcher answering from the table, 404 for anything else
 */
function fetcherOf(answers: Record<string, { status: number; text: string }>): FetchText {
  return async (url) => answers[url] ?? { status: 404, text: 'not found' }
}

describe('rawFileUrl and apiUrl', () => {
  it('build the raw content URL of a file at a commit', () => {
    expect(rawFileUrl('nrwl/nx', 'abc', 'packages/nx/src/a.ts')).toBe('https://raw.githubusercontent.com/nrwl/nx/abc/packages/nx/src/a.ts')
  })

  it('build a repository API URL', () => {
    expect(apiUrl('nrwl/nx', 'git/ref/tags/23.3.0')).toBe('https://api.github.com/repos/nrwl/nx/git/ref/tags/23.3.0')
  })
})

describe('readRemoteFile', () => {
  it('returns the text of a file that exists', async () => {
    const fetchText = fetcherOf({ [rawFileUrl('o/r', 'abc', 'a.ts')]: { status: 200, text: 'export type A = 1' } })
    expect(await readRemoteFile(fetchText, 'o/r', 'abc', 'a.ts')).toBe('export type A = 1')
  })

  it('returns null for a file the repository does not have', async () => {
    expect(await readRemoteFile(fetcherOf({}), 'o/r', 'abc', 'a.ts')).toBeNull()
  })

  it('throws on any other status', async () => {
    const fetchText = fetcherOf({ [rawFileUrl('o/r', 'abc', 'a.ts')]: { status: 500, text: 'boom' } })
    await expect(readRemoteFile(fetchText, 'o/r', 'abc', 'a.ts')).rejects.toThrow(
      'GET https://raw.githubusercontent.com/o/r/abc/a.ts answered 500'
    )
  })
})

describe('readRemoteJson', () => {
  it('parses a JSON answer', async () => {
    expect(await readRemoteJson(fetcherOf({ 'https://x': { status: 200, text: '{"a":1}' } }), 'https://x')).toEqual({ a: 1 })
  })

  it('returns null for a 404', async () => {
    expect(await readRemoteJson(fetcherOf({}), 'https://x')).toBeNull()
  })

  it('throws on any other status', async () => {
    await expect(readRemoteJson(fetcherOf({ 'https://x': { status: 403, text: 'rate limited' } }), 'https://x')).rejects.toThrow(
      'GET https://x answered 403'
    )
  })

  it('throws when the answer is not JSON', async () => {
    await expect(readRemoteJson(fetcherOf({ 'https://x': { status: 200, text: '<html>' } }), 'https://x')).rejects.toThrow(
      'GET https://x did not answer JSON'
    )
  })
})

describe('createFetch', () => {
  it('answers with the status and the body', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('body', { status: 200 }))
    try {
      expect(await createFetch('secret')('https://x')).toEqual({ status: 200, text: 'body' })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('identifies itself and sends the token when given', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('body', { status: 200 }))
    try {
      await createFetch('secret')('https://x')
      expect(fetchSpy).toHaveBeenCalledWith('https://x', {
        headers: { 'user-agent': 'hyperfrontend-types-extract', accept: 'application/vnd.github+json', authorization: 'Bearer secret' },
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('sends no authorization without a token', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    try {
      await createFetch(undefined)('https://x')
      expect(fetchSpy).toHaveBeenCalledWith('https://x', {
        headers: { 'user-agent': 'hyperfrontend-types-extract', accept: 'application/vnd.github+json' },
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
