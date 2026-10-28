import type { FetchInit, FetchResponse } from './siblings'
import { execFileSync } from 'node:child_process'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { firstParents, githubPlanned, plannedBase, resolvePlannedBase } from './planned-base'

/** The environment of a run that can read the check runs. */
const ENV = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }

/**
 * A response with a JSON body.
 *
 * @param status - What the API answered with
 * @param body - What the response carries, serialised as JSON
 * @returns The response
 */
function respond(status: number, body: unknown): FetchResponse {
  return { ok: status < 300, status, text: async () => stringify(body) }
}

/**
 * A check-run page holding one plan check run.
 *
 * @param conclusion - How the check run concluded
 * @param text - What its output text holds
 * @returns The body of the list endpoint
 */
function page(conclusion: string | null, text?: string | null): unknown {
  return { check_runs: [{ conclusion, ...(text === undefined ? {} : { output: { text } }) }] }
}

describe('plannedBase', () => {
  it('answers the newest planned ancestor', async () => {
    const found = await plannedBase({ listFirstParents: () => ['c', 'b', 'a'], isPlanned: async (sha) => sha !== 'c', depth: 50 })
    expect(found).toBe('b')
  })

  it('answers null when no ancestor was planned', async () => {
    expect(await plannedBase({ listFirstParents: () => ['b', 'a'], isPlanned: async () => false, depth: 50 })).toBeNull()
  })

  it('asks the history for no more ancestors than the bound', async () => {
    const asked: number[] = []
    await plannedBase({ listFirstParents: (depth) => (asked.push(depth), []), isPlanned: async () => true, depth: 7 })
    expect(asked).toEqual([7])
  })

  it('asks about no more ancestors than the bound when the history answers more', async () => {
    const seen: string[] = []
    const isPlanned = async (sha: string): Promise<boolean> => (seen.push(sha), false)
    await plannedBase({ listFirstParents: () => ['c', 'b', 'a'], isPlanned, depth: 2 })
    expect(seen).toEqual(['c', 'b'])
  })
})

describe('githubPlanned', () => {
  it('answers null without the token or the repository', () => {
    expect(githubPlanned({ GITHUB_TOKEN: 't' }, async () => respond(200, {}))).toBeNull()
  })

  it('asks for the completed plan check runs of the commit', async () => {
    const seen: [string, FetchInit][] = []
    const isPlanned = githubPlanned({ ...ENV, GITHUB_API_URL: 'https://api.example' }, async (url: string, init: FetchInit) => {
      seen.push([url, init])
      return respond(200, { check_runs: [] })
    })
    await isPlanned?.('abc')
    expect(seen[0]?.[0]).toBe('https://api.example/repos/o/r/commits/abc/check-runs?check_name=pipeline%20plan&status=completed')
  })

  it('counts a successful main plan', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('success', stringify({ main: true }))))
    expect(await isPlanned?.('abc')).toBe(true)
  })

  it('leaves out a plan a pull request published', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('success', stringify({ main: false }))))
    expect(await isPlanned?.('abc')).toBe(false)
  })

  it('leaves out a plan that did not succeed', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('failure', stringify({ main: true }))))
    expect(await isPlanned?.('abc')).toBe(false)
  })

  it('leaves out a plan whose text is not JSON', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('success', 'truncated')))
    expect(await isPlanned?.('abc')).toBe(false)
  })

  it('leaves out a plan without output text', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('success', null)))
    expect(await isPlanned?.('abc')).toBe(false)
  })

  it('leaves out a plan without output', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(200, page('success')))
    expect(await isPlanned?.('abc')).toBe(false)
  })

  it('rejects when the API refuses', async () => {
    const isPlanned = githubPlanned(ENV, async () => respond(403, {}))
    await expect(isPlanned?.('abc')).rejects.toThrow('answered 403')
  })
})

/**
 * Makes an empty commit in a repository.
 *
 * @param root - The repository root
 * @param message - What the commit says
 * @returns The new head's sha
 */
function commit(root: string, message: string): string {
  const git = (args: readonly string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' }).trim()
  git(['commit', '-q', '--allow-empty', '-m', message])
  return git(['rev-parse', 'HEAD'])
}

describe('firstParents', () => {
  const directory = useTempDir({ prefix: 'planned-base-' })

  it('lists the ancestors of the head, newest first, the head left out', () => {
    execFileSync('git', ['init', '-q'], { cwd: directory.path })
    const first = commit(directory.path, 'one')
    const second = commit(directory.path, 'two')
    commit(directory.path, 'three')
    expect(firstParents(directory.path, 50)).toEqual([second, first])
  })

  it('lists nothing when the head has no parent', () => {
    execFileSync('git', ['init', '-q'], { cwd: directory.path })
    commit(directory.path, 'one')
    expect(firstParents(directory.path, 50)).toEqual([])
  })
})

describe('resolvePlannedBase', () => {
  const directory = useTempDir({ prefix: 'planned-base-' })

  /**
   * A repository of two commits.
   *
   * @returns The parent of the head
   */
  function history(): string {
    execFileSync('git', ['init', '-q'], { cwd: directory.path })
    const parent = commit(directory.path, 'one')
    commit(directory.path, 'two')
    return parent
  }

  it('plans everything without the token', async () => {
    const lines: string[] = []
    const base = await resolvePlannedBase({
      root: directory.path,
      env: {},
      request: async () => respond(200, {}),
      report: (line) => lines.push(line),
    })
    expect({ base, lines }).toEqual({
      base: null,
      lines: ['no GitHub token or repository to find the planned base with: planning everything'],
    })
  })

  it('takes the planned parent of the head', async () => {
    const parent = history()
    const base = await resolvePlannedBase({
      root: directory.path,
      env: ENV,
      request: async () => respond(200, page('success', stringify({ main: true }))),
      report: () => undefined,
    })
    expect(base).toBe(parent)
  })

  it('reports the base it took', async () => {
    const parent = history()
    const lines: string[] = []
    await resolvePlannedBase({
      root: directory.path,
      env: ENV,
      request: async () => respond(200, page('success', stringify({ main: true }))),
      report: (line) => lines.push(line),
    })
    expect(lines).toEqual([`planning from ${parent}, the newest first parent a run planned`])
  })

  it('plans everything when no parent was planned', async () => {
    history()
    const lines: string[] = []
    const base = await resolvePlannedBase({
      root: directory.path,
      env: ENV,
      request: async () => respond(200, { check_runs: [] }),
      report: (line) => lines.push(line),
    })
    expect({ base, lines }).toEqual({ base: null, lines: ['none of the 50 first parents before HEAD was planned: planning everything'] })
  })

  it('plans everything when the API refuses', async () => {
    history()
    const lines: string[] = []
    await resolvePlannedBase({ root: directory.path, env: ENV, request: async () => respond(500, {}), report: (line) => lines.push(line) })
    expect(lines[0]).toContain('answered 500): planning everything')
  })

  it('plans everything when the request fails with something other than an error', async () => {
    history()
    const lines: string[] = []
    await resolvePlannedBase({
      root: directory.path,
      env: ENV,
      request: () => Promise.reject('offline'),
      report: (line) => lines.push(line),
    })
    expect(lines).toEqual(['::notice::the planned base is unknown (offline): planning everything'])
  })
})
