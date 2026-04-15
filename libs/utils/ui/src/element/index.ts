/**
 * DOM element creation, retrieval, and dimension synchronization utilities.
 *
 * @module @hyperfrontend/ui-utils/element
 */
export type { ElementConfig, ElementMethods } from '../lib/create-element'
export type { ElementRefOrString, OnSuccess, OnFail, GetElementAsyncOptions } from '../lib/get-element-async'
export type { HtmlTagName } from '../lib/html.model'
export type { ElementResizeCallback } from '../lib/on-element-resize'
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
export { getElementAsync } from '../lib/get-element-async'
export { onElementResize } from '../lib/on-element-resize'
export { syncElementDimensions } from '../lib/sync-element-dimensions'
