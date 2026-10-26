import { TOKEN_STORAGE_KEY } from './sources'

/** What a request answered, with the rate limit GitHub reported. */
export interface Fetched<Value> {
  /** The parsed body */
  value: Value
  /** The requests left in the hour, or null when the response did not say */
  remaining: number | null
}

/** A request that did not succeed. */
export class FetchFailure extends Error {
  /** The status code, or 0 when the request never completed */
  readonly status: number

  /**
   * A failure named after the request that failed.
   * @param status - The status code
   * @param url - The address asked
   */
  constructor(status: number, url: string) {
    super(status === 0 ? `could not reach ${url}` : `${url} answered ${status}`)
    this.status = status
  }
}

/**
 * The headers of a GitHub request: JSON, the API version, and the reader's token when they gave one.
 *
 * @param token - The token, or null
 * @returns The accept, version and, with a token, authorization headers
 */
function headers(token: string | null): Record<string, string> {
  const base: Record<string, string> = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' }
  return token === null ? base : { ...base, authorization: `Bearer ${token}` }
}

/** How a request is made. */
export interface FetchOptions {
  /** The reader's token, or null */
  token?: string | null
  /** Aborts the request */
  signal?: AbortSignal
}

/**
 * Fetches JSON.
 *
 * @param url - The address asked
 * @param options - The reader's token and an abort signal
 * @returns The parsed body and the rate limit left
 * @throws {FetchFailure} When the response is not 2xx or the request fails
 */
export async function fetchJson<Value>(url: string, options: FetchOptions = {}): Promise<Fetched<Value>> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: url.startsWith('https://api.github.com/') ? headers(options.token ?? null) : {},
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new FetchFailure(0, url)
  }
  if (!response.ok) throw new FetchFailure(response.status, url)
  const remaining = response.headers.get('x-ratelimit-remaining')
  return { value: (await response.json()) as Value, remaining: remaining === null ? null : Number(remaining) }
}

/**
 * The reader's GitHub token, from their browser's storage.
 *
 * @returns The token, or null when none is kept or storage is unavailable
 */
export function readToken(): string | null {
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return token === null || token.trim() === '' ? null : token.trim()
  } catch {
    return null
  }
}

/**
 * Keeps or forgets the reader's GitHub token, in their browser alone.
 *
 * @param token - The token, or null to forget it
 */
export function writeToken(token: string | null): void {
  try {
    if (token === null || token.trim() === '') window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    else window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim())
  } catch {
    // why: storage can be blocked; the token then lives for the page alone
  }
}
