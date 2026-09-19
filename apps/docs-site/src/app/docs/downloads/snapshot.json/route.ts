import { getDownloadsFreshness } from '@/lib/downloads'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

export const dynamic = 'force-static'

/**
 * Serve the freshness of the download history this build was made from.
 *
 * The scheduled freshness check reads this to learn which day the published
 * site is counted through, compares it with the newest day npm has counted,
 * and triggers a production build only when npm is ahead. Reading it from
 * the site rather than from the repository is what lets the check see the
 * days a production build fetched at build time, which are never committed.
 *
 * @returns The JSON response, generated at build time
 */
export function GET(): Response {
  return new Response(`${stringify(getDownloadsFreshness(), null, 2)}\n`, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
