/**
 * Reads files and API answers from GitHub over the global `fetch`, behind a boundary a test can
 * replace: the engine never touches the network itself.
 *
 * @module types-extract/fetch
 */

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** What a fetch answered. */
export interface FetchResponse {
  /** The HTTP status. */
  readonly status: number
  /** The body as text. */
  readonly text: string
}

/** Fetches one URL and returns its status and body. */
export type FetchText = (url: string) => Promise<FetchResponse>

/**
 * A fetcher over the global `fetch`, identifying itself to GitHub and authenticating when a token
 * is given so the API rate limit is the authenticated one.
 *
 * @param token - A GitHub token, or undefined for anonymous requests
 * @returns The fetcher
 */
export function createFetch(token: string | undefined): FetchText {
  const headers: Record<string, string> = { 'user-agent': 'hyperfrontend-types-extract', accept: 'application/vnd.github+json' }
  if (token !== undefined && token !== '') headers['authorization'] = `Bearer ${token}`
  return async (url) => {
    const response = await fetch(url, { headers })
    return { status: response.status, text: await response.text() }
  }
}

/**
 * The URL of a file's raw content at a commit.
 *
 * @param repo - The repository, as `owner/name`
 * @param sha - The commit
 * @param path - The file's path within the repository
 * @returns The raw-content URL
 */
export function rawFileUrl(repo: string, sha: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${sha}/${path}`
}

/**
 * The URL of a repository API resource.
 *
 * @param repo - The repository, as `owner/name`
 * @param resource - The resource under the repository, such as `git/ref/tags/1.0.0`
 * @returns The address of the resource on GitHub's REST interface
 */
export function apiUrl(repo: string, resource: string): string {
  return `https://api.github.com/repos/${repo}/${resource}`
}

/**
 * Reads a file at a commit.
 *
 * @param fetchText - The fetcher
 * @param repo - The repository, as `owner/name`
 * @param sha - The commit
 * @param path - The file's path within the repository
 * @returns The file's text, or null when the repository has no such file at that commit
 * @throws {Error} When the answer is neither the file nor a 404
 */
export async function readRemoteFile(fetchText: FetchText, repo: string, sha: string, path: string): Promise<string | null> {
  const url = rawFileUrl(repo, sha, path)
  const response = await fetchText(url)
  if (response.status === 404) return null
  if (response.status !== 200) throw createError(`GET ${url} answered ${response.status}`)
  return response.text
}

/**
 * Reads a JSON API resource.
 *
 * @param fetchText - The fetcher
 * @param url - The resource's URL
 * @returns The parsed answer, or null for a 404
 * @throws {Error} When the answer is neither JSON nor a 404
 */
export async function readRemoteJson(fetchText: FetchText, url: string): Promise<unknown> {
  const response = await fetchText(url)
  if (response.status === 404) return null
  if (response.status !== 200) throw createError(`GET ${url} answered ${response.status}`)
  try {
    return parse(response.text)
  } catch {
    throw createError(`GET ${url} did not answer JSON`)
  }
}
