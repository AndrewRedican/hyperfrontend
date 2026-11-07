import type { FetchText } from './fetch'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isCommitSha, resolveRef } from './resolve-ref'

const SHA = 'a'.repeat(40)
const TAG_SHA = 'b'.repeat(40)

/**
 * A fetcher answering from a table of URLs.
 *
 * @param answers - URL to JSON body; absent URLs answer 404
 * @returns A fetcher answering from the table
 */
function fetcherOf(answers: Record<string, unknown>): FetchText {
  return async (url) => (url in answers ? { status: 200, text: JSON.stringify(answers[url]) } : { status: 404, text: '' })
}

describe('isCommitSha', () => {
  it.each([
    [SHA, true],
    ['23.3.0', false],
    ['A'.repeat(40), false],
    ['abc', false],
  ])('classifies %s', (ref, expected) => {
    expect(isCommitSha(ref)).toBe(expected)
  })
})

describe('resolveRef', () => {
  it('returns a commit sha as is without fetching', async () => {
    expect(await resolveRef(fetcherOf({}), 'o/r', SHA)).toBe(SHA)
  })

  it('resolves a lightweight tag to its commit', async () => {
    const fetchText = fetcherOf({ 'https://api.github.com/repos/o/r/git/ref/tags/v1': { object: { sha: SHA, type: 'commit' } } })
    expect(await resolveRef(fetchText, 'o/r', 'v1')).toBe(SHA)
  })

  it('follows an annotated tag to the commit it points at', async () => {
    const fetchText = fetcherOf({
      'https://api.github.com/repos/o/r/git/ref/tags/v1': { object: { sha: TAG_SHA, type: 'tag' } },
      [`https://api.github.com/repos/o/r/git/tags/${TAG_SHA}`]: { object: { sha: SHA, type: 'commit' } },
    })
    expect(await resolveRef(fetchText, 'o/r', 'v1')).toBe(SHA)
  })

  it('throws when an annotated tag points at nothing', async () => {
    const fetchText = fetcherOf({ 'https://api.github.com/repos/o/r/git/ref/tags/v1': { object: { sha: TAG_SHA, type: 'tag' } } })
    await expect(resolveRef(fetchText, 'o/r', 'v1')).rejects.toThrow('o/r: annotated tag v1 does not point at an object')
  })

  it('falls back to a branch head', async () => {
    const fetchText = fetcherOf({ 'https://api.github.com/repos/o/r/git/ref/heads/main': { object: { sha: SHA, type: 'commit' } } })
    expect(await resolveRef(fetchText, 'o/r', 'main')).toBe(SHA)
  })

  it('throws when neither a tag nor a branch has the name', async () => {
    await expect(resolveRef(fetcherOf({}), 'o/r', 'nope')).rejects.toThrow('o/r: nope is neither a tag nor a branch')
  })

  it('ignores an answer without an object', async () => {
    const fetchText = fetcherOf({ 'https://api.github.com/repos/o/r/git/ref/tags/v1': { message: 'odd' } })
    await expect(resolveRef(fetchText, 'o/r', 'v1')).rejects.toThrow('neither a tag nor a branch')
  })
})
