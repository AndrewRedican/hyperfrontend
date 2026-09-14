import { afterEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createApplyStyle } from './create-apply-style'

describe('createApplyStyle', () => {
  let cleanupFunctions: (() => void)[] = []

  const cleanup = () => {
    cleanupFunctions.forEach((fn) => fn())
    cleanupFunctions = []
  }

  afterEach(cleanup)

  it('returns a function that applies a style to a selector and returns a cleanup function', () => {
    const selector = '.test-class'
    const style = { color: 'red' }
    const applyStyle = createApplyStyle(selector, style)
    const [styleElement, removeStyle] = applyStyle()
    expect(styleElement.textContent).toContain(selector)
    expect(styleElement.textContent).toContain('color: red')
    cleanupFunctions.push(removeStyle)
  })

  it('returns a function that applies the same style only once for the same selector', () => {
    const selector = '.test-class'
    const style = { color: 'blue' }
    const [styleElement1, removeStyle1] = createApplyStyle(selector, style)()
    const [styleElement2, removeStyle2] = createApplyStyle(selector, style)()
    expect(styleElement1.textContent).toContain(selector)
    expect(styleElement1.textContent).toContain('color: blue')
    expect(styleElement1).toEqual(styleElement2)
    cleanupFunctions.push(removeStyle1, removeStyle2)
  })
})
