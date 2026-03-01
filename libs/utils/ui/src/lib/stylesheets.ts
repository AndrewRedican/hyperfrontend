import type { StyleMap } from './style.model'
import { getType } from '@hyperfrontend/data-utils'
import { cssRules } from './css-rules'

const stylesheets = new Set<HTMLStyleElement>()
const labels = new Set<string>()
const labeledStylesheets = new Map<string, HTMLStyleElement>()
const stylesheetLabels = new WeakMap<HTMLStyleElement, string>()

/**
 * Adds a new stylesheet to the document with optional label.
 *
 * @param css - The CSS rules to be added in the new stylesheet
 * @param label - Optional label for the new stylesheet
 * @returns A tuple where the first item is the created HTMLStyleElement, and the second item is a cleanup function
 * @throws {Error} When css is not a string or StyleMap, is empty, or a stylesheet with the same label already exists
 */
export function addStylesheet(css: string | StyleMap, label?: string): [HTMLStyleElement, () => void] {
  if (getType(css) === 'object') {
    css = cssRules(<StyleMap>css)
  }

  if (getType(css) !== 'string' || css.length === 0) {
    throw new Error(`A valid string or StyleMap must be provided to add in styleesheet.`)
  }

  if (label && labels.has(label)) {
    throw new Error(`Stylesheet with label "${label}" already exists`)
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
