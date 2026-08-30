import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Viewport width, in pixels, at or above which navigation is laid out in place:
 * the header lists its links inline and the docs sidebar stands beside the
 * page. Below it, the drawer carries both. Matches Tailwind's `lg` screen.
 */
export const NAV_BREAKPOINT = 1024

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
export const navVisibility = freeze(<const>{
  /** Header main links: listed inline from {@link NAV_BREAKPOINT} up. */
  headerLinks: 'hidden lg:flex',
  /** Header controls beside those links, revealed on the same range. */
  headerControls: 'hidden lg:block',
  /** Docs sidebar: stands beside the page from {@link NAV_BREAKPOINT} up. */
  sidebar: 'hidden lg:block',
  /** Drawer trigger and panel: shown below {@link NAV_BREAKPOINT}, exactly where the other two are absent. */
  drawer: 'lg:hidden',
})
