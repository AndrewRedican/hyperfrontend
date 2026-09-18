import { SUPPORT_EMAIL, SUPPORT_MAIL_SUBJECT } from './site'

/**
 * Site-relative route of the support page, with the trailing slash the site
 * serves every route under.
 */
export const SUPPORT_ROUTE = '/support/'

/**
 * The `mailto:` link the support page opens the reader's own mail client
 * with.
 *
 * Only the subject is prefilled. A body written for the reader is a body
 * the reader has to delete first, and the address and the subject are
 * enough for a message to arrive identifiable. Plain `mailto:`, so the
 * link works with scripting off and hands the composing over to whatever
 * mail client the reader has configured.
 *
 * @returns The mailto URL, subject encoded
 * @example
 * ```typescript
 * buildSupportMailto()
 * // 'mailto:support@hyperfrontend.dev?subject=HyperFrontend%20question'
 * ```
 */
export function buildSupportMailto(): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_MAIL_SUBJECT)}`
}
