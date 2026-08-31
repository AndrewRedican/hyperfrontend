import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Viewport width, in pixels, at or above which navigation is laid out in place:
 * the header lists its links inline and the docs sidebar stands beside the
 * page. Below it, the drawer carries both. Matches Tailwind's `lg` screen.
 */
export const NAV_BREAKPOINT = 1024

/**
 * Viewport width, in pixels, at or above which a document's index stands beside
 * it as a third column. Matches the `rail` screen in the Tailwind config.
 *
 * The docs shell is capped at `max-w-7xl`, so a third column is taken out of
 * the document's own width rather than added beside it. Below this width the
 * sidebar, a readable measure, and an index do not all fit, and the index
 * folds into a disclosure above the document instead. Above it the document
 * still reads at roughly the width the typography is set for.
 */
export const DOC_INDEX_BREAKPOINT = 1400

/**
 * Tailwind visibility classes for every navigation surface.
 *
 * They live together because they describe one switch rather than three
 * independent ones: whichever width hides the header links and the sidebar has
 * to reveal the drawer, or a band of widths is left with no way to navigate.
 * Splitting these strings across the components that render them let exactly
 * that happen between the sidebar's `lg` and the drawer's `md`.
 *
 * The strings are spelled out in full on purpose. Tailwind scans source text for
 * complete class names, so a composed `${screen}:block` never reaches the
 * stylesheet.
 */
export const navVisibility = freeze({
  /** Header main links: listed inline from {@link NAV_BREAKPOINT} up. */
  headerLinks: 'hidden lg:flex',
  /** Header controls beside those links, revealed on the same range. */
  headerControls: 'hidden lg:block',
  /** Docs sidebar: stands beside the page from {@link NAV_BREAKPOINT} up. */
  sidebar: 'hidden lg:block',
  /** Drawer trigger and panel: shown below {@link NAV_BREAKPOINT}, exactly where the other two are absent. */
  drawer: 'lg:hidden',
  /** Document index rail: stands beside the document from {@link DOC_INDEX_BREAKPOINT} up. */
  documentRail: 'hidden rail:block',
  /** Document toolbar above the document: shown below {@link DOC_INDEX_BREAKPOINT}, exactly where the rail is absent. */
  documentToolbar: 'rail:hidden',
} as const)
