import type { HtmlTagName } from './html.model'

/**
 * Validates that a CSS name follows proper naming conventions.
 * CSS names must start with a letter and contain only alphanumeric characters, underscores, or hyphens.
 *
 * @param arg - The CSS name to validate
 * @param argName - The name of the argument (used in error messages)
 * @throws {Error} When the CSS name format is invalid
 */
export function validateCssName(arg: string, argName: string): void {
  const isValid = /^[a-zA-Z][\w-]*$/.test(arg)
  if (!isValid) {
    throw new Error(`Invalid ${argName} name format.`)
  }
}

/**
 * Validates that a string argument is not undefined, null, or empty.
 *
 * @param arg - The string to validate
 * @param argName - The name of the argument (used in error messages)
 * @throws {Error} When the string is undefined, null, or empty
 */
export function validateStringArgument(arg: string, argName: string): void {
  if ([undefined, null, ''].includes(arg) || !arg.trim()) {
    throw new Error(`${argName} cannot be undefined, null, or empty.`)
  }
}

/**
 * Validates that an ID selector follows CSS naming conventions.
 *
 * @param id - The ID to validate
 * @throws {Error} When the ID format is invalid or empty
 */
export function validateIdSelector(id: string): void {
  const label = 'Id'
  validateStringArgument(id, label)
  validateCssName(id, label)
}

/**
 * Validates that a class name follows CSS naming conventions.
 *
 * @param className - The class name to validate
 * @throws {Error} When the class name format is invalid or empty
 */
export function validateClassSelector(className: string): void {
  const label = 'Class'
  validateStringArgument(className, label)
  validateCssName(className, label)
}

/**
 * Validates that an attribute name is valid for CSS attribute selectors.
 * Attribute names cannot contain spaces, quotes, angle brackets, or equals signs.
 *
 * @param attribute - The attribute name to validate
 * @throws {Error} When the attribute name format is invalid or empty
 */
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

  /**
   * Converts the selector builder to its string representation.
   * This method returns the complete CSS selector that has been built.
   *
   * @returns The complete CSS selector string that can be used in querySelector or CSS stylesheets
   * @throws {Error} When the selector is empty or not defined
   */
  public readonly toString = (): string => {
    if (!this.selector) {
      throw new Error('CssSelector is empty.')
    }
    return this.selector
  }

  /**
   * Appends an ID selector to the current selector.
   *
   * @param id - The ID to append
   * @returns The CssSelector instance for method chaining
   * @throws {Error} When the ID format is invalid
   */
  public readonly id = (id: string): CssSelector => {
    validateIdSelector(id)
    this.selector += `#${id}`
    return this
  }

  /**
   * Appends a class selector to the current selector.
   *
   * @param className - The class name to append
   * @returns The CssSelector instance for method chaining
   * @throws {Error} When the class name format is invalid
   */
  public readonly class = (className: string): CssSelector => {
    validateClassSelector(className)
    this.selector += `.${className}`
    return this
  }

  /**
   * Appends an attribute selector to the current selector.
   *
   * @param attribute - The attribute name to select
   * @param value - Optional attribute value to match
   * @returns The CssSelector instance for method chaining
   * @throws {Error} When the attribute name format is invalid
   */
  public readonly attribute = (attribute: string, value?: string): CssSelector => {
    validateAttributeSelector(attribute)
    if (value) {
      this.selector += `[${attribute}="${value}"]`
    } else {
      this.selector += `[${attribute}]`
    }
    return this
  }

  /**
   * Creates a descendant selector (space combinator) with this selector as the parent.
   *
   * @param childSelector - The selector that will be a descendant of this selector
   * @returns The CssSelector instance for method chaining
   */
  public readonly parentOf = (childSelector: CssSelector): CssSelector => {
    this.selector += ` ${childSelector.toString()}`
    return this
  }

  /**
   * Creates a child selector (> combinator) with this selector as the child.
   *
   * @param parentSelector - The selector that will be the direct parent of this selector
   * @returns The CssSelector instance for method chaining
   */
  public readonly childOf = (parentSelector: CssSelector): CssSelector => {
    this.selector = `${parentSelector.toString()} > ${this.selector}`
    return this
  }

  /**
   * Appends the :first-child pseudo-class to the selector.
   *
   * @returns The CssSelector instance for method chaining
   */
  public readonly first = (): CssSelector => {
    this.selector += `:first-child`
    return this
  }

  /**
   * Appends the :last-child pseudo-class to the selector.
   *
   * @returns The CssSelector instance for method chaining
   */
  public readonly last = (): CssSelector => {
    this.selector += `:last-child`
    return this
  }

  /**
   * Appends the :nth-child() pseudo-class to the selector.
   *
   * @param n - The child index (1-based)
   * @returns The CssSelector instance for method chaining
   */
  public readonly nth = (n: number): CssSelector => {
    this.selector += `:nth-child(${n})`
    return this
  }

  /**
   * Appends the :hover pseudo-class to the selector.
   *
   * @returns The CssSelector instance for method chaining
   */
  public readonly hover = (): CssSelector => {
    this.selector += `:hover`
    return this
  }

  /**
   * Appends the :active pseudo-class to the selector.
   *
   * @returns The CssSelector instance for method chaining
   */
  public readonly active = (): CssSelector => {
    this.selector += `:active`
    return this
  }

  /**
   * Appends the :focus pseudo-class to the selector.
   *
   * @returns The CssSelector instance for method chaining
   */
  public readonly focus = (): CssSelector => {
    this.selector += `:focus`
    return this
  }

  /**
   * Creates an adjacent sibling selector (+ combinator).
   *
   * @param siblingSelector - The selector for the next sibling element
   * @returns The CssSelector instance for method chaining
   */
  public readonly nextSibling = (siblingSelector: CssSelector): CssSelector => {
    this.selector += ` + ${siblingSelector.toString()}`
    return this
  }

  /**
   * Creates a general sibling selector (~ combinator).
   *
   * @param siblingSelector - The selector for following sibling elements
   * @returns The CssSelector instance for method chaining
   */
  public readonly followingSiblings = (siblingSelector: CssSelector): CssSelector => {
    this.selector += ` ~ ${siblingSelector.toString()}`
    return this
  }

  /**
   * Appends a generic pseudo-class or pseudo-element to the selector.
   *
   * @param pseudo - The pseudo-class or pseudo-element (with or without leading colon)
   * @returns The CssSelector instance for method chaining
   */
  public readonly pseudo = (pseudo: string): CssSelector => {
    this.selector += pseudo.startsWith(':') ? pseudo : `:${pseudo}`
    return this
  }
}

/**
 * Creates a new empty CSS selector builder.
 *
 * @returns A new CssSelector instance
 */
export function select(): CssSelector {
  return new CssSelector('')
}

/**
 * Creates a CSS selector builder initialized with the given selector string.
 *
 * @param selector - The initial CSS selector string
 * @returns A new CssSelector instance
 */
export function selectBy(selector: string): CssSelector {
  return new CssSelector(selector)
}

/**
 * Creates a CSS selector builder for a specific HTML element tag name.
 *
 * @param tagName - The HTML tag name to select
 * @returns A new CssSelector instance
 */
export function selectByElement(tagName: HtmlTagName): CssSelector {
  return selectBy(tagName)
}

/**
 * Creates a CSS selector builder for the universal selector (*).
 *
 * @returns A new CssSelector instance that matches all elements
 */
export function selectAllElements(): CssSelector {
  return selectBy('*')
}

/**
 * Creates a CSS selector builder for an element with a specific ID.
 *
 * @param id - The ID to select
 * @returns A new CssSelector instance
 * @throws {Error} When the ID format is invalid
 */
export function selectById(id: string): CssSelector {
  return selectBy('').id(id)
}

/**
 * Creates a CSS selector builder for elements with a specific class name.
 *
 * @param className - The class name to select
 * @returns A new CssSelector instance
 * @throws {Error} When the class name format is invalid
 */
export function selectByClass(className: string): CssSelector {
  return selectBy('').class(className)
}

/**
 * Creates a CSS selector builder for elements with a specific attribute.
 *
 * @param attribute - The attribute name to select
 * @param value - Optional attribute value to match
 * @returns A new CssSelector instance
 * @throws {Error} When the attribute name format is invalid
 */
export function selectByAttribute(attribute: string, value?: string): CssSelector {
  return selectBy('').attribute(attribute, value)
}
