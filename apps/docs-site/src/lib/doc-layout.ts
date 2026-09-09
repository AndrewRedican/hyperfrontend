import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Viewport width, in pixels, at or above which the documentation shell stops
 * growing. Matches the `ultra` screen in the Tailwind config.
 *
 * Past this width a page gains nothing from spreading further: the reading
 * measure is already set, and a code block or a table wider than this is
 * harder to scan rather than easier. The remaining width becomes margin.
 */
export const SHELL_MAX_BREAKPOINT = 1920

/**
 * Tailwind classes for the width every documentation surface is laid out in.
 *
 * The header bar, the footer bar and the page shell all read from here because
 * they have to agree: the moment one of them caps at a different width the
 * chrome stops lining up with the content underneath it, and the misalignment
 * is visible on exactly the wide screens this ladder exists to serve.
 *
 * The ladder only ever loosens a cap that has already stopped binding. Below
 * `xl` the viewport is narrower than `max-w-7xl` anyway, so every width from a
 * phone through a small laptop is laid out by the padding alone and is left
 * untouched by anything here. The first step is deliberately keyed to `rail`,
 * the width at which the document index appears: before this the shell holds a
 * navigation column and a document, and after it a third column arrives, so
 * that is the width at which more room is genuinely needed rather than merely
 * available.
 *
 * The strings are spelled out in full because Tailwind scans source text for
 * complete class names; a composed `max-w-${size}` never reaches the
 * stylesheet.
 */
export const docLayout = freeze({
  /**
   * The shell every documentation page is centred in, and the chrome above and
   * below it. Grows once the document index joins the row, and stops at
   * {@link SHELL_MAX_BREAKPOINT}.
   */
  shell: 'mx-auto w-full max-w-7xl rail:max-w-[96rem] ultra:max-w-[108rem]',
  /**
   * The width the header and footer bars hold on every other page.
   *
   * The chrome is not part of the root layout: each page renders its own
   * header and footer, so the bar can be as wide as the page under it and no
   * wider. The landing page sets its own widths and is not on this ladder, so
   * widening its bar to the documentation shell would push the logo a long way
   * left of the headline it sits above.
   */
  bar: 'mx-auto w-full max-w-7xl',
  /**
   * The horizontal padding that shell carries. Held separately because the
   * footer and the header apply it to their own inner bars.
   */
  gutter: 'px-4 sm:px-6 lg:px-8',
} as const)

/**
 * Class applied to a document's own column to give its prose a measure.
 *
 * A document column that grows with the viewport is what lets a diagram, a
 * code block or a table use the room a wide screen has; running paragraphs to
 * that same width is what makes it unreadable. The measure separates the two:
 * text is capped at a line length the eye can track back from, and the blocks
 * that are worth the width are exempted from the cap in
 * {@link file://../styles/globals.css} rather than each being asked to opt out.
 *
 * @see {@link docLayout}
 */
export const DOC_MEASURE_CLASS = 'doc-measure'
