import { SITE_URL } from './site'

/**
 * The one-line positioning statement used in composed share text, site-wide.
 * Kept here, once, so share copy never drifts per page.
 */
export const SITE_ONE_LINER = 'HyperFrontend: compose your existing apps together securely, like Lego bricks.'

/**
 * Everything a share surface needs to describe one page.
 */
export interface ShareDescriptor {
  /** Canonical absolute URL of the page */
  url: string
  /** Text composed for platforms that accept a message: positioning line, page line, URL */
  text: string
  /** Page title, for the native share sheet */
  title: string
}

/**
 * Build the share descriptor for a page.
 *
 * @param path - Site-relative route (e.g. '/docs/guides/first-cross-window-connection/')
 * @param title - Page title
 * @param pageLine - One page-specific line; defaults to the title
 * @returns Canonical URL and composed share text
 */
export function buildShareDescriptor(path: string, title: string, pageLine?: string): ShareDescriptor {
  const withSlash = path.endsWith('/') ? path : `${path}/`
  const url = `${SITE_URL}${withSlash}`
  return {
    url,
    title,
    text: `${SITE_ONE_LINER}\n${pageLine ?? title}\n${url}`,
  }
}

/**
 * One external share destination.
 */
export interface ShareTarget {
  /** Stable identifier, used for analytics */
  id: 'linkedin' | 'x' | 'whatsapp'
  /** Display label */
  label: string
  /** Prefilled share URL */
  href: string
}

/**
 * Build the external share destination URLs for a page.
 *
 * LinkedIn accepts only the URL; X and WhatsApp receive the composed text
 * (which already ends with the URL).
 *
 * @param descriptor - The page's share descriptor
 * @returns Share targets in display order
 */
export function buildShareTargets(descriptor: ShareDescriptor): ShareTarget[] {
  const encodedUrl = encodeURIComponent(descriptor.url)
  const encodedText = encodeURIComponent(descriptor.text)
  return [
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { id: 'x', label: 'X', href: `https://x.com/intent/post?text=${encodedText}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodedText}` },
  ]
}
