import type { Mark } from '../models/banner'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMark } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'

/**
 * The stylesheet the API chips are drawn with.
 *
 * A showcase names at most a couple of functions, and a reader has to be able
 * to tell at a glance which of them belong to the package and which belong to
 * the platform it is being compared against. The package's own names are set
 * as chips: the package mark, then the name, in the accent, on a faint band.
 * Everything else is set plainly in the muted colour, with no mark. One
 * device, used the same way in every scene, is what makes it legible without
 * a legend.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @param fontPx - Font size of the chip's name.
 * @returns CSS for `.api-chip` and `.api-foreign`.
 * @example A stage's stylesheet including the chips at its label size
 * ```ts
 * return `${apiChipStyles(theme, 12)} .my-stage { ... }`
 * ```
 */
export function apiChipStyles(theme: MediaTheme, fontPx: number): string {
  const markPx = round(fontPx * 1.15)
  return `
.api-chip {
  display: inline-flex;
  align-items: center;
  gap: ${round(fontPx * 0.45)}px;
  padding: ${round(fontPx * 0.28)}px ${round(fontPx * 0.7)}px ${round(fontPx * 0.28)}px ${round(fontPx * 0.5)}px;
  border-radius: 999px;
  border: 1px solid ${theme.accentSoft};
  background: ${theme.accentSoft};
  font-family: ${theme.fonts.mono};
  font-size: ${fontPx}px;
  line-height: 1;
  font-weight: 600;
  color: ${theme.tones.accent};
  white-space: nowrap;
}
.api-chip__mark { width: ${markPx}px; height: ${markPx}px; flex: none; color: ${theme.accent}; }
.api-chip__mark svg { width: 100%; height: 100%; display: block; }
.api-foreign {
  display: inline-flex;
  align-items: center;
  padding: ${round(fontPx * 0.28)}px ${round(fontPx * 0.5)}px;
  font-family: ${theme.fonts.mono};
  font-size: ${fontPx}px;
  line-height: 1;
  color: ${theme.text.muted};
  white-space: nowrap;
}
`
}

/**
 * Draw the name of something the package exports.
 *
 * @param name - The function, factory or subpath as a reader would import it.
 * @param mark - The package's mark, from the identity file.
 * @param extra - Further class names, for a stage that positions the chip.
 * @returns Markup for the chip.
 * @example Naming the package's timer beside the platform's
 * ```ts
 * `${renderApiChip('createTimer', mark)} ${renderForeignLabel('setTimeout')}`
 * ```
 */
export function renderApiChip(name: string, mark: Mark, extra = ''): string {
  const classes = extra === '' ? 'api-chip' : `api-chip ${extra}`
  return `<span class="${classes}"><span class="api-chip__mark">${renderMark(mark, 'api-chip__svg')}</span><span>${escapeHtml(name)}</span></span>`
}

/**
 * Draw the name of something that is not the package's: a platform built-in,
 * a variable of the example, another library.
 *
 * @param name - The name as a reader would write it.
 * @param extra - Further class names, for a stage that positions the label.
 * @returns Markup for the label.
 */
export function renderForeignLabel(name: string, extra = ''): string {
  const classes = extra === '' ? 'api-foreign' : `api-foreign ${extra}`
  return `<span class="${classes}">${escapeHtml(name)}</span>`
}
