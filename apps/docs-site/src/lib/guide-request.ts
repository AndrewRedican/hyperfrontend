import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { REPO_URL } from './site'

/**
 * The repository issue form that collects guide requests. Prefilling works by
 * field id, which is GitHub's own mechanism, so no credentials, API calls, or
 * client-side integration are involved: the reader lands on a normal new-issue
 * page with the context already typed in, and reviews and submits it there.
 */
const GUIDE_REQUEST_TEMPLATE = 'guide_request.yml'

/**
 * Build the URL that opens a prefilled guide request on GitHub.
 *
 * The package is prefilled only when the reader arrived from a package-scoped
 * view, so a request made from the unfiltered index does not claim a package
 * the reader never named.
 *
 * @param packageName - npm package the reader was looking at, when there was one
 * @returns Absolute GitHub new-issue URL targeting the guide request form
 *
 * @example Offer a request from a package's empty guides view
 * ```ts
 * buildGuideRequestUrl('@hyperfrontend/nexus')
 * // 'https://github.com/…/issues/new?template=guide_request.yml&title=%5BGUIDE%5D+%40hyperfrontend%2Fnexus%3A+&package=%40hyperfrontend%2Fnexus'
 * ```
 */
export function buildGuideRequestUrl(packageName?: string): string {
  const params = createURLSearchParams({ template: GUIDE_REQUEST_TEMPLATE })
  params.set('title', packageName ? `[GUIDE] ${packageName}: ` : '[GUIDE] ')
  if (packageName) {
    params.set('package', packageName)
  }
  return `${REPO_URL}/issues/new?${params.toString()}`
}
