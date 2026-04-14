/**
 * DOM element creation, retrieval, and dimension synchronization utilities.
 *
 * @module @hyperfrontend/ui-utils/element
 */
export type { HtmlTagName } from '../lib/html.model'
export type { ElementConfig, ElementMethods } from '../lib/create-element'
export { createElement } from '../lib/create-element'
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
} from '../lib/element-creators'
export type { ElementRefOrString, OnSuccess, OnFail, GetElementAsyncOptions } from '../lib/get-element-async'
export { getElementAsync } from '../lib/get-element-async'
export { syncElementDimensions } from '../lib/sync-element-dimensions'
export type { ElementResizeCallback } from '../lib/on-element-resize'
export { onElementResize } from '../lib/on-element-resize'
