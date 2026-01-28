import type { HtmlTagName } from './html.model'

export function validateCssName(arg: string, argName: string): void {
  const isValid = /^[a-zA-Z][\w-]*$/.test(arg)
  if (!isValid) {
    throw new Error(`Invalid ${argName} name format.`)
  }
}

export function validateStringArgument(arg: string, argName: string): void {
  if ([undefined, null, ''].includes(arg) || !arg.trim()) {
    throw new Error(`${argName} cannot be undefined, null, or empty.`)
  }
}

export function validateIdSelector(id: string): void {
  const label = 'Id'
  validateStringArgument(id, label)
  validateCssName(id, label)
}

export function validateClassSelector(className: string): void {
  const label = 'Class'
  validateStringArgument(className, label)
  validateCssName(className, label)
}

export function validateAttributeSelector(attribute: string): void {
  const label = 'Attribute'
  validateStringArgument(attribute, label)
  const isValid = /^[^\s"'>/=]+$/.test(attribute)
  if (!isValid) {
    throw new Error(`Invalid ${label} name format.`)
  }
}

export class CssSelector {
  private selector: string

  constructor(selector: string) {
    this.selector = selector
  }

  /** Returns the current selector as a string. Throws an error if the selector is not defined. */
  public readonly toString = (): string => {
    if (!this.selector) {
      throw new Error('CssSelector is empty.')
    }
    return this.selector
  }

  /** Appends an id to the selector. */
  public readonly id = (id: string): CssSelector => {
    validateIdSelector(id)
    this.selector += `#${id}`
    return this
  }

  /** Appends a class to the selector. */
  public readonly class = (className: string): CssSelector => {
    validateClassSelector(className)
    this.selector += `.${className}`
    return this
  }

  /** Appends an attribute selector. */
  public readonly attribute = (attribute: string, value?: string): CssSelector => {
    validateAttributeSelector(attribute)
    if (value) {
      this.selector += `[${attribute}="${value}"]`
    } else {
      this.selector += `[${attribute}]`
    }
    return this
  }

  public readonly parentOf = (childSelector: CssSelector): CssSelector => {
    this.selector += ` ${childSelector.toString()}`
    return this
  }

  public readonly childOf = (parentSelector: CssSelector): CssSelector => {
    this.selector = `${parentSelector.toString()} > ${this.selector}`
    return this
  }

  public readonly first = (): CssSelector => {
    this.selector += `:first-child`
    return this
  }

  public readonly last = (): CssSelector => {
    this.selector += `:last-child`
    return this
  }

  public readonly nth = (n: number): CssSelector => {
    this.selector += `:nth-child(${n})`
    return this
  }

  public readonly hover = (): CssSelector => {
    this.selector += `:hover`
    return this
  }

  public readonly active = (): CssSelector => {
    this.selector += `:active`
    return this
  }

  public readonly focus = (): CssSelector => {
    this.selector += `:focus`
    return this
  }

  public readonly nextSibling = (siblingSelector: CssSelector): CssSelector => {
    this.selector += ` + ${siblingSelector.toString()}`
    return this
  }

  public readonly followingSiblings = (siblingSelector: CssSelector): CssSelector => {
    this.selector += ` ~ ${siblingSelector.toString()}`
    return this
  }

  /** Appends a generic pseudo-class or pseudo-element to the selector. */
  public readonly pseudo = (pseudo: string): CssSelector => {
    this.selector += pseudo.startsWith(':') ? pseudo : `:${pseudo}`
    return this
  }
}

export function select(): CssSelector {
  return new CssSelector('')
}

export function selectBy(selector: string): CssSelector {
  return new CssSelector(selector)
}

export function selectByElement(tagName: HtmlTagName): CssSelector {
  return selectBy(tagName)
}

export function selectAllElements(): CssSelector {
  return selectBy('*')
}

export function selectById(id: string): CssSelector {
  return selectBy('').id(id)
}

export function selectByClass(className: string): CssSelector {
  return selectBy('').class(className)
}

export function selectByAttribute(attribute: string, value?: string): CssSelector {
  return selectBy('').attribute(attribute, value)
}
