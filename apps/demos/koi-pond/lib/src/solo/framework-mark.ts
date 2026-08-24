/**
 * A drawn mark for each framework, for the page a koi shows when it is opened
 * on its own.
 *
 * These are simplified marks, not any project's official logo: enough
 * silhouette to recognise a framework at a glance, drawn in a single colour so
 * the page can tint each one with the very brand colour its koi wears. Where a
 * project's identity is a letterform rather than a shape, the letter is what is
 * drawn. Every mark shares one 24-unit box, so they line up whatever the page
 * scales them to, and the framework's name is always beside the mark: nothing
 * here has to be recognised to be understood.
 */
import type { KoiFramework } from '../model/types.js'

/** The box every mark is drawn in, so a page can scale them together. */
export const MARK_VIEW_BOX = '0 0 24 24'

/** A letterform mark, for the projects whose identity is their initials. */
// why: Drawn as text rather than as outlines so it stays legible at the size a page actually shows it, and so no letter has to be traced by hand into a path that will never be as good as the font's.
function letters(text: string, size: number): string {
  return (
    `<rect x="1.6" y="1.6" width="20.8" height="20.8" rx="4.6" fill="currentColor" opacity="0.16"/>` +
    `<rect x="1.6" y="1.6" width="20.8" height="20.8" rx="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/>` +
    `<text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="currentColor"` +
    ` font-family="ui-sans-serif, system-ui, sans-serif" font-size="${size}" font-weight="700">${text}</text>`
  )
}

/** What each framework's mark is made of, inside the shared box. */
const MARKS: Readonly<Record<KoiFramework, string>> = {
  // why: The koi with no framework is written in TypeScript against the DOM, and TypeScript's own site is what its card links out to, so its mark is that language's rather than a plain fish.
  vanilla: letters('TS', 9),
  react:
    `<circle cx="12" cy="12" r="2.1" fill="currentColor"/>` +
    `<g fill="none" stroke="currentColor" stroke-width="1.15">` +
    `<ellipse cx="12" cy="12" rx="10.6" ry="4.1"/>` +
    `<ellipse cx="12" cy="12" rx="10.6" ry="4.1" transform="rotate(60 12 12)"/>` +
    `<ellipse cx="12" cy="12" rx="10.6" ry="4.1" transform="rotate(120 12 12)"/>` +
    `</g>`,
  vue:
    `<path d="M1.4 3.2h4.3L12 13.6 18.3 3.2h4.3L12 20.9z" fill="currentColor" opacity="0.5"/>` +
    `<path d="M7.5 3.2h3.1L12 5.7l1.4-2.5h3.1L12 11z" fill="currentColor"/>`,
  svelte: letters('S', 12),
  solid:
    `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">` +
    `<path d="M2.6 7.4c3.4-2.6 8.6-3.1 12.4-1.4 2.3 1 4.2 2 6.4 1.3"/>` +
    `<path d="M2.6 12c3.4-2.6 8.6-3.1 12.4-1.4 2.3 1 4.2 2 6.4 1.3"/>` +
    `<path d="M2.6 16.6c3.4-2.6 8.6-3.1 12.4-1.4 2.3 1 4.2 2 6.4 1.3"/>` +
    `</g>`,
  preact:
    `<path d="M12 1.6 22 7.2v9.6L12 22.4 2 16.8V7.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<ellipse cx="12" cy="12" rx="7.4" ry="3.1" fill="none" stroke="currentColor" stroke-width="1.1" transform="rotate(-30 12 12)"/>` +
    `<circle cx="12" cy="12" r="1.7" fill="currentColor"/>`,
  lit:
    `<path d="M12 1.8 7.2 8.6v6.9L12 22.2l4.8-6.7V8.6z" fill="currentColor" opacity="0.22"/>` +
    `<path d="M12 1.8 7.2 8.6v6.9L12 22.2l4.8-6.7V8.6z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M12 8.4 9.6 12v3.3L12 18.4l2.4-3.1V12z" fill="currentColor"/>`,
  angular:
    `<path d="M12 1.7 21.5 5.1l-1.5 12.4L12 22.3 4 17.5 2.5 5.1z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>` +
    `<path d="M12 6.1 16.7 17.1h-1.9l-.95-2.4h-3.7l-.95 2.4H7.3zm0 3.4-1.25 3.1h2.5z" fill="currentColor"/>`,
}

/**
 * The mark one framework is recognised by on its koi's own page.
 *
 * @param framework - The framework slug.
 * @returns The mark's markup, for the inside of an `svg` element drawn in the shared box.
 *
 * @example Tinting a mark with the koi's own brand colour
 * ```typescript
 * mark.innerHTML = frameworkMark(profile.framework)
 * mark.style.color = profile.palette.accent
 * ```
 */
export function frameworkMark(framework: KoiFramework): string {
  return MARKS[framework]
}
