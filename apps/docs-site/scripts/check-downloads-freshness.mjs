#!/usr/bin/env node
/**
 * Decide whether the published Downloads page is behind npm.
 *
 * Two requests and a comparison: the day the published site says its
 * history is counted through, read from the JSON the site serves beside the
 * downloads page, and the newest day npm has finished counting, read from
 * the same endpoint the collector probes. The site is stale when npm's day
 * is later, and only then is a production build worth triggering, because a
 * production build is what fetches the missing days.
 *
 * Written as plain JavaScript with no dependencies so the scheduled workflow
 * can run it on a bare runner without installing the site. Prints one line
 * saying which of the two states it found, and when run inside GitHub
 * Actions also writes `served`, `counted` and `stale` to the step's outputs.
 * Exits non-zero only when the comparison could not be made at all, so an
 * unreachable site or registry is a failed run rather than a silent no-op.
 */
import { appendFileSync } from 'node:fs'

/** Where the published site states the day its history is counted through. */
const SNAPSHOT_URL = process.env.DOWNLOADS_SNAPSHOT_URL ?? 'https://www.hyperfrontend.dev/docs/downloads/snapshot.json'

/** Any published package; npm's newest counted day is the same for all of them. */
const PROBE_PACKAGE = '@hyperfrontend/features'

/** The endpoint the collector reads the frontier from. */
const LAST_DAY_URL = `https://api.npmjs.org/downloads/point/last-day/${PROBE_PACKAGE}`

/** The shape every day in the comparison must have. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** How long either request may take before the run gives up. */
const TIMEOUT_MS = 30_000

/**
 * Fetch a JSON document, failing on anything but a successful answer.
 *
 * @param {string} url - What to fetch
 * @returns {Promise<unknown>} The parsed body
 */
async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

/**
 * Read a calendar day out of a response, refusing anything else.
 *
 * @param {unknown} value - The field that should hold the day
 * @param {string} source - Who answered, for the error
 * @returns {string} The day, as `YYYY-MM-DD`
 */
function readDay(value, source) {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) {
    throw new Error(`${source} did not answer with a calendar day: ${JSON.stringify(value)}`)
  }
  return value
}

/**
 * Hand the comparison to the workflow step that runs next, when there is one.
 *
 * @param {Record<string, string>} outputs - Step outputs by name
 */
function writeStepOutputs(outputs) {
  const file = process.env.GITHUB_OUTPUT
  if (file === undefined || file === '') return
  appendFileSync(
    file,
    Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join('')
  )
}

/**
 * Compare the published frontier with npm's and say which state was found.
 */
async function main() {
  const snapshot = await fetchJson(SNAPSHOT_URL)
  const served = readDay(snapshot.frontier, 'the published site')
  const lastDay = await fetchJson(LAST_DAY_URL)
  const counted = readDay(lastDay.end, 'npm')
  // why: days are ISO strings, so lexical order is chronological order and a plain comparison is exact
  const stale = counted > served
  console.log(
    stale
      ? `stale: npm has counted through ${counted}, the site is counted through ${served}`
      : `current: the site is counted through ${served}, npm has counted through ${counted}`
  )
  writeStepOutputs({ served, counted, stale: stale ? 'true' : 'false' })
}

main().catch((error) => {
  console.error(`could not compare the published history with npm: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
