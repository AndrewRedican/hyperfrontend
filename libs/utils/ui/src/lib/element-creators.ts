import type { ElementConfig, ElementMethods } from './create-element'
import { createElement } from './create-element'
import { HtmlTagName } from './html.model'

/* istanbul ignore next */
export function span(config?: ElementConfig | undefined): ElementMethods<HTMLSpanElement> {
  return createElement<HTMLSpanElement>('span', config)
}

/* istanbul ignore next */
export function div(config?: ElementConfig | undefined): ElementMethods<HTMLDivElement> {
  return createElement<HTMLDivElement>('div', config)
}

/* istanbul ignore next */
export function button(config?: ElementConfig | undefined): ElementMethods<HTMLButtonElement> {
  return createElement<HTMLButtonElement>('button', config)
}

/* istanbul ignore next */
export function anchor(config?: ElementConfig | undefined): ElementMethods<HTMLAnchorElement> {
  return createElement<HTMLAnchorElement>('a', config)
}

/* istanbul ignore next */
export function input(config?: ElementConfig | undefined): ElementMethods<HTMLInputElement> {
  return createElement<HTMLInputElement>('input', config)
}

/* istanbul ignore next */
export function img(config?: ElementConfig | undefined): ElementMethods<HTMLImageElement> {
  return createElement<HTMLImageElement>('img', config)
}

/* istanbul ignore next */
export function paragraph(config?: ElementConfig | undefined): ElementMethods<HTMLParagraphElement> {
  return createElement<HTMLParagraphElement>('p', config)
}

/* istanbul ignore next */
export function header(level: number, config?: ElementConfig | undefined): ElementMethods<HTMLHeadingElement> {
  return createElement<HTMLHeadingElement>(`h${level}` as HtmlTagName, config)
}

/* istanbul ignore next */
export function unorderedList(config?: ElementConfig | undefined): ElementMethods<HTMLUListElement> {
  return createElement('ul', config)
}

/* istanbul ignore next */
export function orderedList(config?: ElementConfig | undefined): ElementMethods<HTMLOListElement> {
  return createElement('ol', config)
}

/* istanbul ignore next */
export function listItem(config?: ElementConfig | undefined): ElementMethods<HTMLLIElement> {
  return createElement<HTMLLIElement>('li', config)
}

/* istanbul ignore next */
export function tableHeader(config?: ElementConfig | undefined): ElementMethods<HTMLTableElement> {
  return createElement<HTMLTableElement>('table', config)
}

/* istanbul ignore next */
export function tableHead(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('thead', config)
}

/* istanbul ignore next */
export function tableHeaderCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('th', config)
}

/* istanbul ignore next */
export function tableBody(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tbody', config)
}

/* istanbul ignore next */
export function tableRow(config?: ElementConfig | undefined): ElementMethods<HTMLTableRowElement> {
  return createElement<HTMLTableRowElement>('tr', config)
}

/* istanbul ignore next */
export function tableCell(config?: ElementConfig | undefined): ElementMethods<HTMLTableCellElement> {
  return createElement<HTMLTableCellElement>('td', config)
}

/* istanbul ignore next */
export function tableFooter(config?: ElementConfig | undefined): ElementMethods<HTMLTableSectionElement> {
  return createElement<HTMLTableSectionElement>('tfoot', config)
}

/* istanbul ignore next */
export function section(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('section', config)
}

/* istanbul ignore next */
export function article(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('article', config)
}

/* istanbul ignore next */
export function aside(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('aside', config)
}

/* istanbul ignore next */
export function footer(config?: ElementConfig | undefined): ElementMethods<HTMLElement> {
  return createElement<HTMLElement>('footer', config)
}

/* istanbul ignore next */
export function label(config?: ElementConfig | undefined): ElementMethods<HTMLLabelElement> {
  return createElement<HTMLLabelElement>('label', config)
}

/* istanbul ignore next */
export function canvas(config?: ElementConfig | undefined): ElementMethods<HTMLCanvasElement> {
  return createElement<HTMLCanvasElement>('canvas', config)
}
