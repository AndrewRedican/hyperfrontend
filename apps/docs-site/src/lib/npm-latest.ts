import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { compareVersions, parseVersion } from './semver-range'

/** Where npm serves package metadata from, and answers browsers with the CORS header that lets a page ask. */
const REGISTRY_API = 'https://registry.npmjs.org'

/** The newest release npm currently serves for a package. */
export interface LatestPublication {
  /** The version behind the `latest` tag */
  version: string
  /** When it was published, as the ISO timestamp the registry records, or null when the registry does not say */
  publishedAt: string | null
}

/**
 * Read the latest publication out of a registry document.
 *
 * Only two fields are read, and both are checked: a page should say nothing
 * rather than something wrong when the registry's shape drifts.
 *
 * @param body - The parsed registry document
 * @returns The latest publication, or null when the document does not carry one
 *
 * @example
 * ```typescript
 * readLatestPublication({ 'dist-tags': { latest: '0.10.0' }, time: { '0.10.0': '2026-09-08T06:12:51.537Z' } })
 * // { version: '0.10.0', publishedAt: '2026-09-08T06:12:51.537Z' }
 * ```
 */
export function readLatestPublication(body: unknown): LatestPublication | null {
  if (typeof body !== 'object' || body === null || isArray(body)) return null
  const record = body as Record<string, unknown>
  const tags = record['dist-tags']
  if (typeof tags !== 'object' || tags === null || isArray(tags)) return null
  const version = (tags as Record<string, unknown>)['latest']
  if (typeof version !== 'string' || parseVersion(version) === null) return null
  const time = record['time']
  const publishedAt = typeof time === 'object' && time !== null && !isArray(time) ? (time as Record<string, unknown>)[version] : undefined
  return { version, publishedAt: typeof publishedAt === 'string' ? publishedAt : null }
}

/**
 * Whether npm has published a version newer than the newest one a changelog knows.
 *
 * The changelog is written late in the release flow, so a docs build can
 * carry a changelog one release behind the registry for a while. A version
 * on npm that is higher than the changelog's newest is that gap; anything
 * equal or lower, which includes a repository bumped ahead of a publication
 * that has not happened yet, is not.
 *
 * @param changelogNewest - The newest version in the changelog, or null for an empty changelog
 * @param latest - What npm serves as latest
 * @returns The newer publication, or null when the changelog is current
 *
 * @example
 * ```typescript
 * newerThanChangelog('0.9.0', { version: '0.10.0', publishedAt: null })?.version // '0.10.0'
 * newerThanChangelog('0.10.0', { version: '0.10.0', publishedAt: null }) // null
 * ```
 */
export function newerThanChangelog(changelogNewest: string | null, latest: LatestPublication): LatestPublication | null {
  const published = parseVersion(latest.version)
  if (published === null) return null
  if (changelogNewest === null) return latest
  const known = parseVersion(changelogNewest)
  if (known === null) return null
  return compareVersions(published, known) > 0 ? latest : null
}

/**
 * Ask npm what it currently serves as a package's latest release.
 *
 * One request, against a document the registry serves with a public cache
 * and a CORS header, compressed to a few kilobytes. Any failure, from a
 * network error to a document of an unexpected shape, resolves to null, so
 * a page that asks can only ever add a notice and never lose its content.
 *
 * @param packageName - Full npm package name
 * @param transport - The fetch to use; the global one unless a test says otherwise
 * @returns The latest publication, or null when it could not be learned
 *
 * @example
 * ```typescript
 * const latest = await fetchLatestPublication('@hyperfrontend/features')
 * ```
 */
export async function fetchLatestPublication(
  packageName: string,
  transport: (url: string) => Promise<Response> = (url) => fetch(url)
): Promise<LatestPublication | null> {
  try {
    const response = await transport(`${REGISTRY_API}/${packageName.replace('/', '%2F')}`)
    if (!response.ok) return null
    return readLatestPublication(await response.json())
  } catch {
    return null
  }
}
