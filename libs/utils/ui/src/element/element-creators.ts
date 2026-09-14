import type { ElementConfig, ElementMethods } from './create-element'
import type { HtmlTagName } from './html.model'
import { createElement } from './create-element'

/* node:coverage disable */

/**
 * Creates a span element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created span element and helper methods
 *
 * @example Creating span element
 * ```typescript
 * const badge = span({ className: 'badge' })
 * badge.ref.textContent = 'New'
 * ```
 */
export function span(config?: ElementConfig | undefined): ElementMethods<HTMLSpanElement> {
  return createElement<HTMLSpanElement>('span', config)
}

/**
 * Creates a div element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created div element and helper methods
 *
 * @example Creating div element
 * ```typescript
 * const container = div({ className: 'container' })
 * container.ref.id = 'main'
 * ```
 */
export function div(config?: ElementConfig | undefined): ElementMethods<HTMLDivElement> {
  return createElement<HTMLDivElement>('div', config)
}

/**
 * Creates a button element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created button element and helper methods
 *
 * @example Creating button element
 * ```typescript
 * const submitBtn = button({ className: 'btn-primary' })
 * submitBtn.ref.textContent = 'Submit'
 * ```
 */
export function button(config?: ElementConfig | undefined): ElementMethods<HTMLButtonElement> {
  return createElement<HTMLButtonElement>('button', config)
}

/**
 * Creates an anchor (link) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created anchor element and helper methods
 *
 * @example Creating anchor element
 * ```typescript
 * const link = anchor({ className: 'nav-link' })
 * link.ref.href = '/home'
 * ```
 */
export function anchor(config?: ElementConfig | undefined): ElementMethods<HTMLAnchorElement> {
  return createElement<HTMLAnchorElement>('a', config)
}

/**
 * Creates an input element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created input element and helper methods
 *
 * @example Creating input element
 * ```typescript
 * const email = input({ className: 'field' })
 * email.ref.type = 'email'
 * ```
 */
export function input(config?: ElementConfig | undefined): ElementMethods<HTMLInputElement> {
  return createElement<HTMLInputElement>('input', config)
}

/**
 * Creates an image element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created image element and helper methods
 *
 * @example Creating image element
 * ```typescript
 * const avatar = img({ className: 'avatar' })
 * avatar.ref.src = '/avatar.png'
 * ```
 */
export function img(config?: ElementConfig | undefined): ElementMethods<HTMLImageElement> {
  return createElement<HTMLImageElement>('img', config)
}

/**
 * Creates a paragraph element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created paragraph element and helper methods
 *
 * @example Creating paragraph element
 * ```typescript
 * const text = paragraph({ className: 'lede' })
 * text.ref.textContent = 'Hello, world!'
 * ```
 */
export function paragraph(config?: ElementConfig | undefined): ElementMethods<HTMLParagraphElement> {
  return createElement<HTMLParagraphElement>('p', config)
}

/**
 * Creates a heading element (h1-h6) with optional configuration.
 *
 * @param level - The heading level (1-6)
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created heading element and helper methods
 *
 * @example Creating heading element
 * ```typescript
 * const title = header(1, { className: 'page-title' })
 * title.ref.textContent = 'Page Title'
 * ```
 */
export function header(level: number, config?: ElementConfig | undefined): ElementMethods<HTMLHeadingElement> {
  return createElement<HTMLHeadingElement>(`h${level}` as HtmlTagName, config)
}

/**
 * Creates an unordered list (ul) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created unordered list element and helper methods
 *
 * @example Creating unordered list element
 * ```typescript
 * const menu = unorderedList({ className: 'nav-menu' })
 * menu.ref // => HTMLUListElement
 * ```
 */
export function unorderedList(config?: ElementConfig | undefined): ElementMethods<HTMLUListElement> {
  return createElement('ul', config)
}

/**
 * Creates an ordered list (ol) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created ordered list element and helper methods
 *
 * @example Creating ordered list element
 * ```typescript
 * const steps = orderedList({ className: 'instructions' })
 * steps.ref // => HTMLOListElement
 * ```
 */
export function orderedList(config?: ElementConfig | undefined): ElementMethods<HTMLOListElement> {
  return createElement('ol', config)
}

/**
 * Creates a list item (li) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created list item element and helper methods
 *
 * @example Creating list item element
 * ```typescript
 * const item = listItem({ className: 'nav-item' })
 * item.ref.textContent = 'First item'
 * ```
 */
export function listItem(config?: ElementConfig | undefined): ElementMethods<HTMLLIElement> {
  return createElement<HTMLLIElement>('li', config)
}

/**
 * Creates a table element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created table element and helper methods
 *
 * @example Creating table element
 * ```typescript
 * const grid = tableHeader({ className: 'data-table' })
 * grid.ref // => HTMLTableElement
 * ```
 */
export function tableHeader(config?: ElementConfig | undefined): ElementMethods<HTMLTableElement> {
  return createElement<HTMLTableElement>('table', config)
}

/**
 * Creates a table head (thead) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created thead element and helper methods
 *
 * @example Creating table head element
 * ```typescript
 * const head = tableHead({ className: 'sticky-header' })
 * head.ref // => HTMLTableSectionElement
 * ```
 */
export function tableHead(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('thead', config)
}

/**
 * Creates a table header cell (th) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created th element and helper methods
 *
 * @example Creating table header cell
 * ```typescript
 * const nameHeader = tableHeaderCell({ className: 'col-name' })
 * nameHeader.ref.textContent = 'Name'
 * ```
 */
export function tableHeaderCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('th', config)
}

/**
 * Creates a table body (tbody) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created tbody element and helper methods
 *
 * @example Creating table body element
 * ```typescript
 * const body = tableBody({ className: 'data-rows' })
 * body.ref // => HTMLTableSectionElement
 * ```
 */
export function tableBody(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tbody', config)
}

/**
 * Creates a table row (tr) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created tr element and helper methods
 *
 * @example Creating table row element
 * ```typescript
 * const row = tableRow({ className: 'data-row' })
 * row.ref // => HTMLTableRowElement
 * ```
 */
export function tableRow(config?: ElementConfig | undefined): ElementMethods<HTMLTableRowElement> {
  return createElement<HTMLTableRowElement>('tr', config)
}

/**
 * Creates a table data cell (td) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created td element and helper methods
 *
 * @example Creating table cell element
 * ```typescript
 * const cell = tableCell({ className: 'name-cell' })
 * cell.ref.textContent = 'John Doe'
 * ```
 */
export function tableCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('td', config)
}

/**
 * Creates a table footer (tfoot) element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created tfoot element and helper methods
 *
 * @example Creating table footer element
 * ```typescript
 * const foot = tableFooter({ className: 'summary' })
 * foot.ref // => HTMLTableSectionElement
 * ```
 */
export function tableFooter(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tfoot', config)
}

/**
 * Creates a section element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created section element and helper methods
 *
 * @example Creating section element
 * ```typescript
 * const about = section({ className: 'page-section' })
 * about.ref.id = 'about'
 * ```
 */
export function section(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('section', config)
}

/**
 * Creates an article element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created article element and helper methods
 *
 * @example Creating article element
 * ```typescript
 * const post = article({ className: 'blog-post' })
 * post.ref // => HTMLElement
 * ```
 */
export function article(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('article', config)
}

/**
 * Creates an aside element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created aside element and helper methods
 *
 * @example Creating aside element
 * ```typescript
 * const sidebar = aside({ className: 'sidebar' })
 * sidebar.ref // => HTMLElement
 * ```
 */
export function aside(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('aside', config)
}

/**
 * Creates a footer element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created footer element and helper methods
 *
 * @example Creating footer element
 * ```typescript
 * const pageFooter = footer({ className: 'site-footer' })
 * pageFooter.ref // => HTMLElement
 * ```
 */
export function footer(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('footer', config)
}

/**
 * Creates a label element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created label element and helper methods
 *
 * @example Creating label element
 * ```typescript
 * const emailLabel = label({ className: 'field-label' })
 * emailLabel.ref.htmlFor = 'email'
 * ```
 */
export function label(config?: ElementConfig | undefined): ElementMethods<HTMLLabelElement> {
  return createElement<HTMLLabelElement>('label', config)
}

/**
 * Creates a canvas element with optional configuration.
 *
 * @param config - Optional inline styles and class names to apply to the element
 * @returns An ElementMethods object containing the created canvas element and helper methods
 *
 * @example Creating canvas element
 * ```typescript
 * const drawing = canvas({ className: 'stage' })
 * drawing.ref.width = 800
 * ```
 */
export function canvas(config?: ElementConfig | undefined): ElementMethods<HTMLCanvasElement> {
  return createElement<HTMLCanvasElement>('canvas', config)
}

/* node:coverage enable */
