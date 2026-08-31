import type { ElementConfig, ElementMethods } from './create-element'
import type { HtmlTagName } from './html.model'
import { createElement } from './create-element'

/* istanbul ignore next */
/**
 * Creates a span element with optional configuration.
 *
 * @param config - Optional configuration for element attributes, styles, and content
 * @returns An ElementMethods object containing the created span element and helper methods
 *
 * @example Creating span element
 * ```typescript
 * const badge = span({ class: 'badge', textContent: 'New' })
 * badge.element // => HTMLSpanElement
 * ```
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
 *
 * @example Creating div element
 * ```typescript
 * const container = div({ class: 'container', id: 'main' })
 * container.element // => HTMLDivElement
 * ```
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
 *
 * @example Creating button element
 * ```typescript
 * const submitBtn = button({ class: 'btn-primary', textContent: 'Submit' })
 * submitBtn.element // => HTMLButtonElement
 * ```
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
 *
 * @example Creating anchor element
 * ```typescript
 * const link = anchor({ href: '/home', textContent: 'Home' })
 * link.element // => HTMLAnchorElement
 * ```
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
 *
 * @example Creating input element
 * ```typescript
 * const email = input({ type: 'email', placeholder: 'Enter email' })
 * email.element // => HTMLInputElement
 * ```
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
 *
 * @example Creating image element
 * ```typescript
 * const avatar = img({ src: '/avatar.png', alt: 'User avatar' })
 * avatar.element // => HTMLImageElement
 * ```
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
 *
 * @example Creating paragraph element
 * ```typescript
 * const text = paragraph({ textContent: 'Hello, world!' })
 * text.element // => HTMLParagraphElement
 * ```
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
 *
 * @example Creating heading element
 * ```typescript
 * const title = header(1, { textContent: 'Page Title' })
 * title.element // => HTMLHeadingElement (h1)
 * ```
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
 *
 * @example Creating unordered list element
 * ```typescript
 * const menu = unorderedList({ class: 'nav-menu' })
 * menu.element // => HTMLUListElement
 * ```
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
 *
 * @example Creating ordered list element
 * ```typescript
 * const steps = orderedList({ class: 'instructions' })
 * steps.element // => HTMLOListElement
 * ```
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
 *
 * @example Creating list item element
 * ```typescript
 * const item = listItem({ textContent: 'First item' })
 * item.element // => HTMLLIElement
 * ```
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
 *
 * @example Creating table element
 * ```typescript
 * const grid = tableHeader({ class: 'data-table' })
 * grid.element // => HTMLTableElement
 * ```
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
 *
 * @example Creating table head element
 * ```typescript
 * const head = tableHead({ class: 'sticky-header' })
 * head.element // => HTMLTableSectionElement
 * ```
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
 *
 * @example Creating table header cell
 * ```typescript
 * const header = tableHeaderCell({ textContent: 'Name', scope: 'col' })
 * header.element // => HTMLTableCellElement
 * ```
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
 *
 * @example Creating table body element
 * ```typescript
 * const body = tableBody({ id: 'data-rows' })
 * body.element // => HTMLTableSectionElement
 * ```
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
 *
 * @example Creating table row element
 * ```typescript
 * const row = tableRow({ class: 'data-row' })
 * row.element // => HTMLTableRowElement
 * ```
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
 *
 * @example Creating table cell element
 * ```typescript
 * const cell = tableCell({ textContent: 'John Doe' })
 * cell.element // => HTMLTableCellElement
 * ```
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
 *
 * @example Creating table footer element
 * ```typescript
 * const foot = tableFooter({ class: 'summary' })
 * foot.element // => HTMLTableSectionElement
 * ```
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
 *
 * @example Creating section element
 * ```typescript
 * const about = section({ id: 'about', class: 'page-section' })
 * about.element // => HTMLElement
 * ```
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
 *
 * @example Creating article element
 * ```typescript
 * const post = article({ class: 'blog-post' })
 * post.element // => HTMLElement
 * ```
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
 *
 * @example Creating aside element
 * ```typescript
 * const sidebar = aside({ class: 'sidebar' })
 * sidebar.element // => HTMLElement
 * ```
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
 *
 * @example Creating footer element
 * ```typescript
 * const pageFooter = footer({ class: 'site-footer' })
 * pageFooter.element // => HTMLElement
 * ```
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
 *
 * @example Creating label element
 * ```typescript
 * const emailLabel = label({ for: 'email', textContent: 'Email:' })
 * emailLabel.element // => HTMLLabelElement
 * ```
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
 *
 * @example Creating canvas element
 * ```typescript
 * const drawing = canvas({ width: '800', height: '600' })
 * drawing.element // => HTMLCanvasElement
 * ```
 */
export function canvas(config?: ElementConfig | undefined): ElementMethods<HTMLCanvasElement> {
  return createElement<HTMLCanvasElement>('canvas', config)
}
