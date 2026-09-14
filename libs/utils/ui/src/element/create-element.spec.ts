import type { ElementMethods, ElementConfig } from './create-element'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createElement } from './create-element'

describe('createElement', () => {
  let element: ElementMethods<HTMLDivElement>

  beforeEach(() => {
    element = createElement('div')
    document.body.appendChild(element.ref)
  })

  afterEach(() => {
    if (document.body.contains(element.ref)) {
      document.body.removeChild(element.ref)
    }
  })

  it('creates an element with the given tag name', () => {
    expect(element.ref.tagName).toBe('DIV')
  })

  it('creates an element that is not visible by default', () => {
    expect(element.visible).toBe(false)
  })

  it('applies styles from the config object', () => {
    const config: ElementConfig = {
      inlineStyle: {
        backgroundColor: 'red',
        width: '100px',
        height: '100px',
      },
    }
    element = createElement<HTMLDivElement>('div', config)
    expect(element.ref.style.backgroundColor).toBe('red')
    expect(element.ref.style.width).toBe('100px')
    expect(element.ref.style.height).toBe('100px')
  })

  it('adds a child element', () => {
    const child = createElement<HTMLDivElement>('div')
    element.addChild(child)
    expect(element.ref.contains(child.ref)).toBe(true)
  })

  it('attaches to a parent element', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    element.attachTo(parent)
    expect(parent.contains(element.ref)).toBe(true)
    document.body.removeChild(parent)
  })

  it('shows the element', () => {
    element.show()
    expect(element.ref.style.opacity).toBe('1')
    expect(element.visible).toBe(true)
  })

  it('hides the element', () => {
    element.show()
    element.hide()
    expect(element.ref.style.opacity).toBe('0')
    expect(element.visible).toBe(false)
  })

  it('removes a child element', () => {
    const child = createElement<HTMLDivElement>('div')
    element.addChild(child)
    element.removeChild(child)
    expect(element.ref.contains(child.ref)).toBe(false)
  })

  it('detaches from its parent', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    element.attachTo(parent)
    element.detachFromParent()
    expect(parent.contains(element.ref)).toBe(false)
    document.body.removeChild(parent)
  })

  it('applies transition with duration when showing the element', () => {
    element.show(500)
    expect(element.ref.style.transition).toBe('opacity 0.5s')
  })

  it('applies transition without duration when showing the element', () => {
    element.show()
    expect(element.ref.style.transition).toBe('none')
  })

  it('applies transition with duration when hiding the element', () => {
    element.show()
    element.hide(500)
    expect(element.ref.style.transition).toBe('opacity 0.5s')
  })

  it('applies transition without duration when hiding the element', () => {
    element.show()
    element.hide()
    expect(element.ref.style.transition).toBe('none')
  })

  it('applies given class names from the config object', () => {
    const config: ElementConfig = {
      classNames: ['test-class', 'another-class'],
    }
    const divElement = createElement<HTMLDivElement>('div', config)
    expect(divElement.ref.classList.contains('test-class')).toBe(true)
    expect(divElement.ref.classList.contains('another-class')).toBe(true)
  })

  it('applies className from the config object', () => {
    const config: ElementConfig = {
      className: 'single-class',
    }
    const divElement = createElement<HTMLDivElement>('div', config)
    expect(divElement.ref.classList.contains('single-class')).toBe(true)
  })

  it('does not add child if child is falsy', () => {
    const initialChildCount = element.ref.children.length
    element.addChild(null as unknown as HTMLElement)
    expect(element.ref.children.length).toBe(initialChildCount)
  })

  it('does not attach to parent if parent is falsy', () => {
    const initialParent = element.ref.parentElement
    element.attachTo(null as unknown as HTMLElement)
    expect(element.ref.parentElement).toBe(initialParent)
  })

  it('does not remove child if child is falsy', () => {
    const child = createElement<HTMLDivElement>('div')
    element.addChild(child)
    const initialChildCount = element.ref.children.length
    element.removeChild(null as unknown as HTMLElement)
    expect(element.ref.children.length).toBe(initialChildCount)
  })

  it('does not add child if already present', () => {
    const child = createElement<HTMLDivElement>('div')
    element.addChild(child)
    const initialChildCount = element.ref.children.length
    element.addChild(child)
    expect(element.ref.children.length).toBe(initialChildCount)
  })

  it('does not attach to parent if already attached', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    element.attachTo(parent)
    const initialChildCount = parent.children.length
    element.attachTo(parent)
    expect(parent.children.length).toBe(initialChildCount)
    document.body.removeChild(parent)
  })

  it('does not remove child if not present', () => {
    const child = createElement<HTMLDivElement>('div')
    const initialChildCount = element.ref.children.length
    element.removeChild(child)
    expect(element.ref.children.length).toBe(initialChildCount)
  })

  it('handles detachFromParent when element has no parent', () => {
    const orphan = createElement<HTMLDivElement>('div')
    orphan.detachFromParent()
    expect(orphan.ref.parentElement).toBeNull()
  })
})
