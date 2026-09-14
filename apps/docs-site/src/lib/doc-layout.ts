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
 * that same width is what makes it unreadable. The measure separates the two,
 * and the blocks that are worth the width are exempted from it in
 * {@link file://../styles/globals.css} rather than each being asked to opt out.
 *
 * The cap only binds past {@link SHELL_MAX_BREAKPOINT}. Below it the column is
 * already the measure: the navigation, the document index and the padding take
 * the surplus as the viewport grows, so prose fills its column at every width
 * from a phone through a wide laptop, exactly as it always has. Past it the
 * shell stops growing, the column gains the whole remainder at once, and that
 * is the only place text has to be held back from it.
 *
 * @see {@link docLayout}
 */
export const DOC_MEASURE_CLASS = 'doc-measure'

/**
 * Class naming an element as the document column that code blocks measure
 * themselves against.
 *
 * A short code sample is drawn at half its column only when the column is
 * wide enough to be halved, and the column is the honest thing to measure:
 * the same viewport holds a wider column with the navigation collapsed and a
 * narrower one with the document index beside it. The class makes its element
 * a size query container, so the stylesheet asks the column rather than the
 * window. It goes on the shell's main column and on the document column
 * inside a document shell, and a block reads the nearest of the two above it.
 *
 * @see {@link docLayout}
 */
export const DOC_COLUMN_CLASS = 'doc-column'
