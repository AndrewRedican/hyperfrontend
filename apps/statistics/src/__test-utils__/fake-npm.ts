import type { Day } from '../collector/dates'
import type { StatisticsDeps } from '../statistics'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { addDays, daysBetween } from '../collector/dates'

/** How the fake npm answers: as npm does, with a server error, or not at all until the request is aborted. */
export type FakeNpmMode = 'answering' | 'failing' | 'silent'

/** An npm that answers from a table a spec can change while a service runs against it. */
export interface FakeNpm {
  /** The transport to hand a service */
  readonly fetch: StatisticsDeps['fetch']
  /** The newest day it has counted; a spec moves it forward to simulate a new day */
  frontier: Day
  /** See {@link FakeNpmMode} */
  mode: FakeNpmMode
  /** Every URL it was asked for, in order */
  readonly urls: string[]
}

/**
 * A JSON response as npm sends one.
 *
 * @param body - The body, serialised here
 * @returns The response
 */
function json(body: unknown): Response {
  return new Response(stringify(body), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

/**
 * The package a URL of the fake npm ends in.
 *
 * @param url - The address the fake npm was asked for
 * @returns The package name, decoded
 */
function packageOf(url: string): string {
  return url.slice(url.lastIndexOf('@')).replace('%2F', '/')
}

/**
 * Build a fake npm in which every package was first published two days before the frontier it starts with.
 *
 * Each day's count is the day of the month, so an answer can be checked by eye.
 *
 * @param frontier - The newest day it has counted to begin with
 * @returns An npm that answers every tracked package through that day
 *
 * @example
 * ```typescript
 * const npm = createFakeNpm('2026-09-11')
 * npm.frontier = '2026-09-12'
 * ```
 */
export function createFakeNpm(frontier: Day): FakeNpm {
  const created = addDays(frontier, -2)
  const npm: FakeNpm = {
    frontier,
    mode: 'answering',
    urls: [],
    fetch: async (url, init) => {
      npm.urls.push(url)
      if (npm.mode === 'silent') {
        return createPromise<Response>((_resolve, reject) => {
          // why: a signal that has already aborted fires no event, and the real transport refuses such a request at once
          if (init.signal.aborted) reject(init.signal.reason)
          init.signal.addEventListener('abort', () => reject(init.signal.reason))
        })
      }
      if (npm.mode === 'failing') return new Response('down', { status: 503, headers: { 'content-type': 'text/plain' } })
      const packageName = packageOf(url)
      if (url.includes('/point/last-day/')) return json({ downloads: 1, start: npm.frontier, end: npm.frontier, package: packageName })
      if (url.includes('/range/')) {
        const [start, end] = url.slice(url.indexOf('/range/') + '/range/'.length, url.lastIndexOf('/')).split(':')
        return json({
          start,
          end,
          package: packageName,
          downloads: daysBetween(start, end).map((day) => ({ day, downloads: Number(day.slice(8, 10)) })),
        })
      }
      return json({ name: packageName, time: { created: `${created}T08:00:00.000Z` } })
    },
  }
  return npm
}
