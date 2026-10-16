import { afterEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createApplyStyles } from './create-apply-styles'

describe('createApplyStyles', () => {
  let cleanupFunctions: (() => void)[] = []

  const cleanup = () => {
    cleanupFunctions.forEach((fn) => fn())
    cleanupFunctions = []
  }

  afterEach(cleanup)

  it('applies styles and returns a cleanup function', () => {
    const styles = {
      '.test-class': {
        color: 'red',
        fontSize: '16px',
      },
    }
    const applyStyles = createApplyStyles(styles)
    const [styleElement, removeStyles] = applyStyles()
    expect(styleElement.textContent).toContain('.test-class{color: red; font-size: 16px;}')
    cleanupFunctions.push(removeStyles)
  })

  it('keeps the style rules in the stylesheet when the same styles are applied twice', () => {
    const styles = {
      '.test-class': {
        color: 'blue',
      },
    }
    const applyStyles = createApplyStyles(styles)
    const [styleElement1, removeStyles1] = applyStyles()
    const [, removeStyles2] = applyStyles()
    expect(styleElement1.textContent).toContain('.test-class{color: blue;}')
    cleanupFunctions.push(removeStyles1, removeStyles2)
  })

  it('applies the same styles only once', () => {
    const styles = {
      '.test-class': {
        color: 'blue',
      },
    }
    const applyStyles = createApplyStyles(styles)
    const [styleElement1, removeStyles1] = applyStyles()
    const [styleElement2, removeStyles2] = applyStyles()
    expect(styleElement1).toEqual(styleElement2)
    cleanupFunctions.push(removeStyles1, removeStyles2)
  })
})
