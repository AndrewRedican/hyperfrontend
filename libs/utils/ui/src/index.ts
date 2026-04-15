/**
 * UI utilities for audio, color, components, elements, events, selectors, and styling.
 *
 * @module @hyperfrontend/ui-utils
 */
export type { Rgb } from './color'
export type { StyleFn, CreateFn } from './component'
export type {
  HtmlTagName,
  ElementConfig,
  ElementMethods,
  ElementRefOrString,
  OnSuccess,
  OnFail,
  GetElementAsyncOptions,
  ElementResizeCallback,
} from './element'
export type { TMouseEvent, Callback } from './event'
export type { Style, StyleMap } from './style'
export { setupAudio } from './audio'
export { getColorVariation, hexToRgb, rgbToHex, rgbToString, rgbStringToHex } from './color'
export { component } from './component'
export {
  createElement,
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
  getElementAsync,
  syncElementDimensions,
  onElementResize,
} from './element'
export { clickAtPosition, createGestureListener } from './event'
export { simpleHash } from './misc'
export { isMobileDevice } from './mobile'
export {
  validateCssName,
  validateStringArgument,
  validateIdSelector,
  validateClassSelector,
  validateAttributeSelector,
  CssSelector,
  select,
  selectBy,
  selectByElement,
  selectAllElements,
  selectById,
  selectByClass,
  selectByAttribute,
  isValidCssSelector,
} from './selector'
export { createApplyStyle, createApplyStyles, cssObjectToString, cssRule, cssRules, addStylesheet, removeStylesheet } from './style'
export { pause, timestampToDateTime } from './time'
