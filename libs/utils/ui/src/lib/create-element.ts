import type { Style } from '../style'
import type { HtmlTagName } from './html.model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { assign } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { nonEmptyStrings, uniqueStrings } from '@hyperfrontend/list-utils'

/**
 * Configuration options for creating an HTML element.
 */
export type ElementConfig = {
  /** Inline styles to apply to the element */
  inlineStyle?: Style
  /** Single class name to add */
  className?: string
  /** Multiple class names to add */
  classNames?: string[]
}

/**
 * Utility methods and properties for manipulating a created HTML element.
 */
export type ElementMethods<T extends HTMLElement> = {
  /** Appends a child element */
  addChild: (target: HTMLElement | ElementMethods<HTMLElement>) => void
  /** Attaches this element to a parent */
  attachTo: (target: HTMLElement | ElementMethods<HTMLElement>) => void
  /** Shows the element with optional animation duration */
  show: (duration?: number) => void
  /** Hides the element with optional animation duration */
  hide: (duration?: number) => void
  /** Removes a child element */
  removeChild: (child: HTMLElement | ElementMethods<HTMLElement>) => void
  /** Detaches this element from its parent */
  detachFromParent: () => void
  /** Reference to the underlying DOM element */
  ref: T
  /** Current visibility state */
  visible: boolean
}

/**
 * Creates an HTML element with configuration and provides utility methods for manipulation.
 * Supports inline styles, class names, and common DOM operations.
 *
 * @param tagName - The HTML tag name to create
 * @param config - Optional configuration for the element including styles and class names
 * @returns An ElementMethods object with helper methods and a reference to the created element
 *
 * @example Creating element with configuration
 * ```typescript
 * const card = createElement('div', {
 *   className: 'card',
 *   classNames: ['shadow', 'rounded'],
 *   inlineStyle: { padding: '16px', margin: '8px' }
 * })
 *
 * const title = createElement('h2')
 * title.ref.textContent = 'Card Title'
 *
 * card.addChild(title)
 * card.attachTo(document.body)
 * card.show(300) // Fade in over 300ms
 * ```
 */
export function createElement<T extends HTMLElement>(tagName: HtmlTagName, config?: ElementConfig): ElementMethods<T> {
  const element = document.createElement(tagName) as T
  if (config?.inlineStyle) {
    assign(element.style, config.inlineStyle)
  }
  const classList: string[] = []
  if (config?.classNames && isArray(config.classNames)) {
    classList.push(...config.classNames)
  }
  if (config?.className) {
    classList.push(config.className)
  }
  element.classList.add(...nonEmptyStrings(uniqueStrings(classList)))

  let isVisible = false

  const addChild = (child: HTMLElement | ElementMethods<HTMLElement>) => {
    if (!child) return
    /* istanbul ignore next */
    const childElement = 'ref' in child ? child.ref : child
    if (!element.contains(childElement)) {
      element.appendChild(childElement)
    }
  }

  const attachTo = (parent: HTMLElement | ElementMethods<HTMLElement>) => {
    if (!parent) return
    /* istanbul ignore next */
    const parentElement = 'ref' in parent ? parent.ref : parent
    if (!parentElement.contains(element)) {
      parentElement.appendChild(element)
    }
  }

  const getTransition = (duration?: number): string => {
    return duration ? `opacity ${(duration / 1000).toFixed(1)}s` : 'none'
  }

  const show = (duration?: number) => {
    element.style.transition = getTransition(duration)
    element.style.opacity = '1'
    isVisible = true
  }

  const hide = (duration?: number) => {
    element.style.transition = getTransition(duration)
    element.style.opacity = '0'
    isVisible = false
  }

  const removeChild = (child: HTMLElement | ElementMethods<HTMLElement>) => {
    if (!child) return
    /* istanbul ignore next */
    const childElement = 'ref' in child ? child.ref : child
    if (element.contains(childElement)) {
      element.removeChild(childElement)
    }
  }

  const detachFromParent = () => {
    const parent = element.parentElement
    if (parent) {
      parent.removeChild(element)
    }
  }

  return {
    get addChild() {
      return addChild
    },
    get attachTo() {
      return attachTo
    },
    get show() {
      return show
    },
    get hide() {
      return hide
    },
    get removeChild() {
      return removeChild
    },
    get detachFromParent() {
      return detachFromParent
    },
    get ref() {
      return element
    },
    get visible() {
      return isVisible
    },
  }
}
