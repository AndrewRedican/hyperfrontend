import type { StyleMap } from './style.model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { cssRules } from './css-rules'

const stylesheets = createSet<HTMLStyleElement>()
const labels = createSet<string>()
const labeledStylesheets = createMap<string, HTMLStyleElement>()
const stylesheetLabels = createWeakMap<HTMLStyleElement, string>()

/**
 * Adds a new stylesheet to the document with optional label.
 *
 * @param css - The CSS rules to be added in the new stylesheet
 * @param label - Optional label for the new stylesheet
 * @returns A tuple where the first item is the created HTMLStyleElement, and the second item is a cleanup function
 * @throws {Error} When css is not a string or StyleMap, is empty, or a stylesheet with the same label already exists
 *
 * @example CSS string
 * ```typescript
 * const [styleElement, removeStyles] = addStylesheet(`
 *   .modal { display: flex; align-items: center; }
 *   .modal-overlay { background: rgba(0, 0, 0, 0.5); }
 * `, 'modal-styles')
 *
 * // Remove when done
 * removeStyles()
 * ```
 *
 * @example StyleMap object
 * ```typescript
 * const [styleElement, removeStyles] = addStylesheet({
 *   '.button': { backgroundColor: '#3498db', padding: '10px 20px' },
 *   '.button:hover': { backgroundColor: '#2980b9' },
 * })
 * ```
 */
export function addStylesheet(css: string | StyleMap, label?: string): [HTMLStyleElement, () => void] {
  if (getType(css) === 'object') {
    css = cssRules(<StyleMap>css)
  }

  if (getType(css) !== 'string' || css.length === 0) {
    throw createError(`A valid string or StyleMap must be provided to add in styleesheet.`)
  }

  if (label && labels.has(label)) {
    throw createError(`Stylesheet with label "${label}" already exists`)
  }

  const style: HTMLStyleElement = document.createElement('style')
  style.textContent = <string>css
  document.head.appendChild(style)

  stylesheets.add(style)

  if (label) {
    labels.add(label)
    labeledStylesheets.set(label, style)
    stylesheetLabels.set(style, label)
  }

  const removeCallback: () => void = () => removeStylesheet(style)

  return [style, removeCallback]
}

/**
 * Removes a stylesheet from the document.
 *
 * @param {string | HTMLStyleElement} ref - The label or the HTMLStyleElement of the stylesheet to be removed.
 *
 * @example By label
 * ```typescript
 * addStylesheet('.theme { color: red; }', 'theme-styles')
 * removeStylesheet('theme-styles')
 * ```
 *
 * @example By element reference
 * ```typescript
 * const [styleElement] = addStylesheet('.custom { margin: 0; }')
 * removeStylesheet(styleElement)
 * ```
 */
export function removeStylesheet(ref: string | HTMLStyleElement): void {
  const isLabel = getType(ref) === 'string'
  let style: HTMLStyleElement
  let label: string
  if (isLabel) {
    label = <string>ref
    style = <HTMLStyleElement>labeledStylesheets.get(label)
  } else {
    style = <HTMLStyleElement>ref
    label = <string>stylesheetLabels.get(style)
  }
  try {
    document.head.removeChild(style)
    stylesheets.delete(style)
  } catch {
    /** Swallow any errors */
  }
  try {
    labels.delete(label)
    labeledStylesheets.delete(label)
    stylesheetLabels.delete(style)
  } catch {
    /** Swallow any errors */
  }
}
