/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/ui-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/ui-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the color entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/ui-utils/color')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        hexToRgb: 'function',
        rgbToHex: 'function',
        rgbToString: 'function',
        rgbStringToHex: 'function',
        getColorVariation: 'function',
      })
    )
  })

  it('exposes the documented surface of the selector entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/ui-utils/selector')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        select: 'function',
        isValidCssSelector: 'function',
      })
    )
  })

  it('converts hex to RGB', () => {
    const rgb = consumer.run(
      async () => {
        const { hexToRgb } = require('@hyperfrontend/ui-utils/color')
        return hexToRgb('#ff0000')
      },
      { kind: 'require' }
    )
    expect(rgb).toEqual({
      r: 255,
      g: 0,
      b: 0,
    })
  })

  it('converts RGB to hex', () => {
    const hex = consumer.run(
      async () => {
        const { rgbToHex } = require('@hyperfrontend/ui-utils/color')
        return rgbToHex(255, 0, 0).toLowerCase()
      },
      { kind: 'require' }
    )
    expect(hex).toBe('#ff0000')
  })

  it('renders an RGB triple as a CSS colour', () => {
    const css = consumer.run(
      async () => {
        const { rgbToString } = require('@hyperfrontend/ui-utils/color')
        return rgbToString({ r: 0, g: 255, b: 0 })
      },
      { kind: 'require' }
    )
    expect(css).toBe('rgb(0,255,0)')
  })
})
