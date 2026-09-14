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
    expect(styleElement.textContent).toContain('.test-class')
    expect(styleElement.textContent).toContain('color: red;')
    cleanupFunctions.push(removeStyles)
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
    expect(styleElement1.textContent).toContain('.test-class')
    expect(styleElement1.textContent).toContain('color: blue;')
    expect(styleElement1).toEqual(styleElement2)
    cleanupFunctions.push(removeStyles1, removeStyles2)
  })
})
