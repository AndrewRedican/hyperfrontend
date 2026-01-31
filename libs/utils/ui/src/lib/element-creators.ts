import type { ElementConfig, ElementMethods } from './create-element'
import { createElement } from './create-element'
import { HtmlTagName } from './html.model'

/* istanbul ignore next */
/**
 * Creates a span element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created span element and helper methods
 */
export function span(config?: ElementConfig | undefined): ElementMethods<HTMLSpanElement> {
  return createElement<HTMLSpanElement>('span', config)
}

/* istanbul ignore next */
/**
 * Creates a div element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created div element and helper methods
 */
export function div(config?: ElementConfig | undefined): ElementMethods<HTMLDivElement> {
  return createElement<HTMLDivElement>('div', config)
}

/* istanbul ignore next */
/**
 * Creates a button element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created button element and helper methods
 */
export function button(config?: ElementConfig | undefined): ElementMethods<HTMLButtonElement> {
  return createElement<HTMLButtonElement>('button', config)
}

/* istanbul ignore next */
/**
 * Creates an anchor (link) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created anchor element and helper methods
 */
export function anchor(config?: ElementConfig | undefined): ElementMethods<HTMLAnchorElement> {
  return createElement<HTMLAnchorElement>('a', config)
}

/* istanbul ignore next */
/**
 * Creates an input element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created input element and helper methods
 */
export function input(config?: ElementConfig | undefined): ElementMethods<HTMLInputElement> {
  return createElement<HTMLInputElement>('input', config)
}

/* istanbul ignore next */
/**
 * Creates an image element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created image element and helper methods
 */
export function img(config?: ElementConfig | undefined): ElementMethods<HTMLImageElement> {
  return createElement<HTMLImageElement>('img', config)
}

/* istanbul ignore next */
/**
 * Creates a paragraph element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created paragraph element and helper methods
 */
export function paragraph(config?: ElementConfig | undefined): ElementMethods<HTMLParagraphElement> {
  return createElement<HTMLParagraphElement>('p', config)
}

/* istanbul ignore next */
/**
 * Creates a heading element (h1-h6) with optional configuration.
 *
 * @param level - The heading level (1-6)
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created heading element and helper methods
 */
export function header(level: number, config?: ElementConfig | undefined): ElementMethods<HTMLHeadingElement> {
  return createElement<HTMLHeadingElement>(`h${level}` as HtmlTagName, config)
}

/* istanbul ignore next */
/**
 * Creates an unordered list (ul) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created unordered list element and helper methods
 */
export function unorderedList(config?: ElementConfig | undefined): ElementMethods<HTMLUListElement> {
  return createElement('ul', config)
}

/* istanbul ignore next */
/**
 * Creates an ordered list (ol) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created ordered list element and helper methods
 */
export function orderedList(config?: ElementConfig | undefined): ElementMethods<HTMLOListElement> {
  return createElement('ol', config)
}

/* istanbul ignore next */
/**
 * Creates a list item (li) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created list item element and helper methods
 */
export function listItem(config?: ElementConfig | undefined): ElementMethods<HTMLLIElement> {
  return createElement<HTMLLIElement>('li', config)
}

/* istanbul ignore next */
/**
 * Creates a table element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created table element and helper methods
 */
export function tableHeader(config?: ElementConfig | undefined): ElementMethods<HTMLTableElement> {
  return createElement<HTMLTableElement>('table', config)
}

/* istanbul ignore next */
/**
 * Creates a table head (thead) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created thead element and helper methods
 */
export function tableHead(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('thead', config)
}

/* istanbul ignore next */
/**
 * Creates a table header cell (th) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created th element and helper methods
 */
export function tableHeaderCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('th', config)
}

/* istanbul ignore next */
/**
 * Creates a table body (tbody) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created tbody element and helper methods
 */
export function tableBody(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tbody', config)
}

/* istanbul ignore next */
/**
 * Creates a table row (tr) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created tr element and helper methods
 */
export function tableRow(config?: ElementConfig | undefined): ElementMethods<HTMLTableRowElement> {
  return createElement<HTMLTableRowElement>('tr', config)
}

/* istanbul ignore next */
/**
 * Creates a table data cell (td) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created td element and helper methods
 */
export function tableCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('td', config)
}

/* istanbul ignore next */
/**
 * Creates a table footer (tfoot) element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created tfoot element and helper methods
 */
export function tableFooter(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tfoot', config)
}

/* istanbul ignore next */
/**
 * Creates a section element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created section element and helper methods
 */
export function section(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('section', config)
}

/* istanbul ignore next */
/**
 * Creates an article element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created article element and helper methods
 */
export function article(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('article', config)
}

/* istanbul ignore next */
/**
 * Creates an aside element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created aside element and helper methods
 */
export function aside(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('aside', config)
}

/* istanbul ignore next */
/**
 * Creates a footer element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created footer element and helper methods
 */
export function footer(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('footer', config)
}

/* istanbul ignore next */
/**
 * Creates a label element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created label element and helper methods
 */
export function label(config?: ElementConfig | undefined): ElementMethods<HTMLLabelElement> {
  return createElement<HTMLLabelElement>('label', config)
}

/* istanbul ignore next */
/**
 * Creates a canvas element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created canvas element and helper methods
 */
export function canvas(config?: ElementConfig | undefined): ElementMethods<HTMLCanvasElement> {
  return createElement<HTMLCanvasElement>('canvas', config)
}
