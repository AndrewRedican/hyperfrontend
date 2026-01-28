import type { HtmlTagName } from './html.model'
import type { Style } from '../style'
import { nonEmptyStrings, uniqueStrings } from '@hyperfrontend/list-utils'

export type ElementConfig = {
  inlineStyle?: Style
  className?: string
  classNames?: string[]
}

export type ElementMethods<T extends HTMLElement> = {
  addChild: (target: HTMLElement | ElementMethods<HTMLElement>) => void
  attachTo: (target: HTMLElement | ElementMethods<HTMLElement>) => void
  show: (duration?: number) => void
  hide: (duration?: number) => void
  removeChild: (child: HTMLElement | ElementMethods<HTMLElement>) => void
  detachFromParent: () => void
  ref: T
  visible: boolean
}

export function createElement<T extends HTMLElement>(tagName: HtmlTagName, config?: ElementConfig): ElementMethods<T> {
  const element = document.createElement(tagName) as T
  if (config?.inlineStyle) {
    Object.assign(element.style, config.inlineStyle)
  }
  const classList: string[] = []
  if (config?.classNames && Array.isArray(config.classNames)) {
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
