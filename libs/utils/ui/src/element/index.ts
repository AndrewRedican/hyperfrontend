/**
 * DOM element creation, retrieval, and dimension synchronization utilities.
 *
 * @module @hyperfrontend/ui-utils/element
 */
export type { ElementConfig, ElementMethods } from './create-element'
export type { ElementRefOrString, OnSuccess, OnFail, GetElementAsyncOptions } from './get-element-async'
export type { HtmlTagName } from './html.model'
export type { ElementResizeCallback } from './on-element-resize'
export { createElement } from './create-element'
export {
  span,
  div,
  button,
  anchor,
  input,
  img,
  paragraph,
  header,
  unorderedList,
  orderedList,
  listItem,
  tableHeader,
  tableHead,
  tableHeaderCell,
  tableBody,
  tableRow,
  tableCell,
  tableFooter,
  section,
  article,
  aside,
  footer,
  label,
  canvas,
} from './element-creators'
export { getElementAsync } from './get-element-async'
export { onElementResize } from './on-element-resize'
export { syncElementDimensions } from './sync-element-dimensions'
