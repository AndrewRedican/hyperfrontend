/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { addStylesheet, removeStylesheet } from './stylesheets'

const removeCallbacks: (() => void)[] = []
const removeAll = () => removeCallbacks.forEach((fn) => fn())

describe('addStylesheet function', () => {
  beforeEach(removeAll)
  afterEach(removeAll)

  it('adds a new stylesheet to the document', () => {
    const css = '.test { color: red; }'
    const [styleElement, remove] = addStylesheet(css)
    expect(document.head.contains(styleElement)).toBe(true)
    expect(styleElement.textContent).toEqual(css)
    removeCallbacks.push(remove)
  })

  it('adds a new stylesheet using a StyleMap', () => {
    const styleMap = { '.test': { color: 'red' } }
    const [styleElement, remove] = addStylesheet(styleMap)

    expect(document.head.contains(styleElement)).toBe(true)
    expect(styleElement.textContent).toContain('.test{color: red;}')
    removeCallbacks.push(remove)
  })

  it('throws an error when css is not a string or StyleMap or is empty', () => {
    expect(() => addStylesheet('')).toThrow()
    expect(() => addStylesheet(123 as any)).toThrow()
    expect(() => addStylesheet({} as any)).toThrow()
    expect(() => addStylesheet(null as any)).toThrow()
  })

  it('throws an error if a stylesheet with the same label already exists', () => {
    const css = '.test { color: red; }'
    const [_, remove] = addStylesheet(css, 'label')

    expect(() => addStylesheet(css, 'label')).toThrow()
    removeCallbacks.push(remove)
  })
})

describe('removeStylesheet function', () => {
  beforeEach(removeAll)
  afterEach(removeAll)

  it('removes a stylesheet from the document', () => {
    const css = '.test { color: red; }'
    const [styleElement, remove] = addStylesheet(css, 'label')
    expect(document.head.contains(styleElement)).toBe(true)
    remove()
    expect(document.head.contains(styleElement)).toBe(false)
  })

  it('removes a stylesheet by directly passing HTMLStyleElement', () => {
    const css = '.test { color: red; }'
    const [styleElement] = addStylesheet(css)
    expect(document.head.contains(styleElement)).toBe(true)
    removeStylesheet(styleElement)
    expect(document.head.contains(styleElement)).toBe(false)
  })

  it('handles the removal of an already removed stylesheet', () => {
    const css = '.test { color: red; }'
    const [_, remove] = addStylesheet(css)
    remove()
    expect(() => remove()).not.toThrow()
  })

  it('does not throw an error when removing a stylesheet with an invalid label', () => {
    expect(() => removeStylesheet('invalid-label')).not.toThrow()
  })

  it('silently handlea non-existent stylesheet removal', () => {
    expect(() => removeStylesheet('non-existent-label')).not.toThrow()
  })
})
