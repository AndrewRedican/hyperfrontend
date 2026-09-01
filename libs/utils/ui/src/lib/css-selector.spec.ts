import { describe, expect, it } from '@hyperfrontend/testing'
import {
  CssSelector,
  selectByElement,
  selectAllElements,
  selectById,
  selectByClass,
  selectByAttribute,
  selectBy,
  select,
} from './css-selector'

describe('CssSelector', () => {
  describe('id', () => {
    it('appends an ID to the selector', () => {
      const cssSelector = new CssSelector('')
      cssSelector.id('testId')
      expect(cssSelector.toString()).toBe('#testId')
    })

    it('throws error for invalid id format', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.id('123-invalid')).toThrow('Invalid Id name format.')
    })

    it('throws error for empty id', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.id('')).toThrow('Id cannot be undefined, null, or empty.')
    })
  })

  describe('class', () => {
    it('appends a class to the selector', () => {
      const cssSelector = new CssSelector('')
      cssSelector.class('testClass')
      expect(cssSelector.toString()).toBe('.testClass')
    })

    it('throws error for invalid class format', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.class('123-invalid')).toThrow('Invalid Class name format.')
    })

    it('throws error for empty class', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.class('')).toThrow('Class cannot be undefined, null, or empty.')
    })
  })

  describe('attribute', () => {
    it('appends an attribute selector with a value', () => {
      const cssSelector = new CssSelector('')
      cssSelector.attribute('type', 'button')
      expect(cssSelector.toString()).toBe('[type="button"]')
    })

    it('appends an attribute selector without a value', () => {
      const cssSelector = new CssSelector('')
      cssSelector.attribute('disabled')
      expect(cssSelector.toString()).toBe('[disabled]')
    })

    it('throws error for invalid attribute format', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.attribute('invalid="test')).toThrow('Invalid Attribute name format.')
    })

    it('throws error for empty attribute', () => {
      const cssSelector = new CssSelector('')
      expect(() => cssSelector.attribute('')).toThrow('Attribute cannot be undefined, null, or empty.')
    })
  })

  describe('parentOf', () => {
    it('handles nested selectors with parentOf', () => {
      const child = new CssSelector('button')
      const parent = new CssSelector('div').parentOf(child)
      expect(parent.toString()).toBe('div button')
    })
  })

  describe('childOf', () => {
    it('handles nested selectors with childOf', () => {
      const parent = new CssSelector('div')
      const child = new CssSelector('button').childOf(parent)
      expect(child.toString()).toBe('div > button')
    })
  })

  describe('first', () => {
    it('appends :first-child to the selector', () => {
      const selector = new CssSelector('div').first()
      expect(selector.toString()).toBe('div:first-child')
    })
  })

  describe('last', () => {
    it('appends :last-child to the selector', () => {
      const selector = new CssSelector('div').last()
      expect(selector.toString()).toBe('div:last-child')
    })
  })

  describe('nth', () => {
    it('appends :nth-child(n) to the selector', () => {
      const selector = new CssSelector('div').nth(3)
      expect(selector.toString()).toBe('div:nth-child(3)')
    })
  })

  describe('hover', () => {
    it('appends :hover to the selector', () => {
      const selector = new CssSelector('button').hover()
      expect(selector.toString()).toBe('button:hover')
    })
  })

  describe('active', () => {
    it('appends :active to the selector', () => {
      const selector = new CssSelector('button').active()
      expect(selector.toString()).toBe('button:active')
    })
  })

  describe('focus', () => {
    it('appends :focus to the selector', () => {
      const selector = new CssSelector('input').focus()
      expect(selector.toString()).toBe('input:focus')
    })
  })

  describe('nextSibling', () => {
    it('appends + selector for nextSibling', () => {
      const siblingSelector = new CssSelector('span')
      const selector = new CssSelector('div').nextSibling(siblingSelector)
      expect(selector.toString()).toBe('div + span')
    })
  })

  describe('followingSiblings', () => {
    it('appends ~ selector for followingSiblings', () => {
      const siblingSelector = new CssSelector('span')
      const selector = new CssSelector('div').followingSiblings(siblingSelector)
      expect(selector.toString()).toBe('div ~ span')
    })
  })

  describe('pseudo', () => {
    it('appends a pseudo-class to the selector', () => {
      const selector = new CssSelector('button').pseudo(':hover')
      expect(selector.toString()).toBe('button:hover')
    })

    it('appends a pseudo-element to the selector', () => {
      const selector = new CssSelector('div').pseudo('::before')
      expect(selector.toString()).toBe('div::before')
    })

    it('appends a parameterized pseudo-class to the selector', () => {
      const selector = new CssSelector('div').pseudo(':nth-child(3)')
      expect(selector.toString()).toBe('div:nth-child(3)')
    })

    it('correctly handles pseudo selectors not starting with a colon', () => {
      const selector = new CssSelector('ul').pseudo('hover')
      expect(selector.toString()).toBe('ul:hover')
    })
  })
})

describe('selectByElement', () => {
  it('selects by tag name', () => {
    const selector = selectByElement('div')
    expect(selector.toString()).toBe('div')
  })
})

describe('selectAllElements', () => {
  it('selects all elements', () => {
    const selector = selectAllElements()
    expect(selector.toString()).toBe('*')
  })
})

describe('selectById', () => {
  it('selects by ID', () => {
    const selector = selectById('main')
    expect(selector.toString()).toBe('#main')
  })
})

describe('selectByClass', () => {
  it('selects by class', () => {
    const selector = selectByClass('container')
    expect(selector.toString()).toBe('.container')
  })
})

describe('selectByAttribute', () => {
  it('selects by attribute with a value', () => {
    const selector = selectByAttribute('type', 'submit')
    expect(selector.toString()).toBe('[type="submit"]')
  })

  it('selects by attribute without a value', () => {
    const selector = selectByAttribute('disabled')
    expect(selector.toString()).toBe('[disabled]')
  })
})

describe('select', () => {
  it('throws an error for an empty CssSelector', () => {
    const selector = select()
    expect(() => selector.toString()).toThrow('CssSelector is empty')
  })
})

describe('selectBy', () => {
  it('creates a CssSelector with a specific selector', () => {
    const selector = selectBy('.example')
    expect(selector.toString()).toBe('.example')
  })

  it('handles complex selectors', () => {
    const complexSelector = 'div.example > ul > li:first-child'
    const selector = selectBy(complexSelector)
    expect(selector.toString()).toBe(complexSelector)
  })

  it('throws an error when called with an empty string', () => {
    const selector = selectBy('')
    expect(() => selector.toString()).toThrow('CssSelector is empty')
  })
})
