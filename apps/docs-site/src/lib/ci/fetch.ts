import { TOKEN_STORAGE_KEY } from './sources'

/** The rate limit GitHub reported with a response, each part null when the response did not say. */
export interface RateLimit {
  /** The requests allowed in the hour */
  limit: number | null
  /** The requests left in the hour */
  remaining: number | null
  /** When the hour's requests renew, in epoch milliseconds */
  resetAt: number | null
}

/** The rate limit of a request that never got a response. */
export const NO_RATE: RateLimit = { limit: null, remaining: null, resetAt: null }

/** What a request answered, with the rate limit GitHub reported. */
export interface Fetched<Value> {
  /** The parsed body */
  value: Value
  /** The rate limit the response reported */
  rate: RateLimit
}

/** A request that did not succeed. */
export class FetchFailure extends Error {
  /** The status code, or 0 when the request never completed */
  readonly status: number
  /** The rate limit the response reported, such as none left when GitHub refused the request for it */
  readonly rate: RateLimit

  /**
   * A failure named after the request that failed.
   * @param status - The status code
   * @param url - The address asked
   * @param rate - The rate limit the response reported
   */
  constructor(status: number, url: string, rate: RateLimit = NO_RATE) {
    super(status === 0 ? `could not reach ${url}` : `${url} answered ${status}`)
    this.status = status
    this.rate = rate
  }
}

/**
 * The rate limit a response's headers report.
 *
 * @param response - What GitHub answered, successful or not
 * @returns The limit, the requests left and when they renew
 */
function rateOf(response: Response): RateLimit {
  const header = (name: string) => {
    const value = response.headers.get(name)
    return value === null ? null : Number(value)
  }
  const reset = header('x-ratelimit-reset')
  return { limit: header('x-ratelimit-limit'), remaining: header('x-ratelimit-remaining'), resetAt: reset === null ? null : reset * 1000 }
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
 * @returns The parsed body and the rate limit the response reported
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
  if (!response.ok) throw new FetchFailure(response.status, url, rateOf(response))
  return { value: (await response.json()) as Value, rate: rateOf(response) }
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
