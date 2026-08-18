/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/ui-utils`
 * Tests that the package sub-entries are importable.
 *
 * Note: ui-utils is browser-focused but sub-entries should still be importable.
 * Functionality tests are limited as many features require a real DOM.
 */

describe('@hyperfrontend/ui-utils ESM', () => {
  describe('color sub-entry', () => {
    it('is importable', async () => {
      const color = await import('@hyperfrontend/ui-utils/color')
      expect(color).toBeDefined()
    })

    it('exports hexToRgb function', async () => {
      const { hexToRgb } = await import('@hyperfrontend/ui-utils/color')
      expect(typeof hexToRgb).toBe('function')
    })

    it('exports rgbToHex function', async () => {
      const { rgbToHex } = await import('@hyperfrontend/ui-utils/color')
      expect(typeof rgbToHex).toBe('function')
    })

    it('hexToRgb converts hex to RGB', async () => {
      const { hexToRgb } = await import('@hyperfrontend/ui-utils/color')
      const rgb = hexToRgb('#ff0000')
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('rgbToHex converts RGB to hex', async () => {
      const { rgbToHex } = await import('@hyperfrontend/ui-utils/color')
      const hex = rgbToHex(255, 0, 0)
      expect(hex.toLowerCase()).toBe('#ff0000')
    })
  })

  describe('selector sub-entry', () => {
    it('is importable', async () => {
      const selector = await import('@hyperfrontend/ui-utils/selector')
      expect(selector).toBeDefined()
    })

    it('exports select function', async () => {
      const { select } = await import('@hyperfrontend/ui-utils/selector')
      expect(typeof select).toBe('function')
    })

    it('exports isValidCssSelector function', async () => {
      const { isValidCssSelector } = await import('@hyperfrontend/ui-utils/selector')
      expect(typeof isValidCssSelector).toBe('function')
    })
  })

  describe('audio sub-entry', () => {
    it('is importable', async () => {
      const audio = await import('@hyperfrontend/ui-utils/audio')
      expect(audio).toBeDefined()
    })
  })

  describe('component sub-entry', () => {
    it('is importable', async () => {
      const component = await import('@hyperfrontend/ui-utils/component')
      expect(component).toBeDefined()
    })
  })

  describe('element sub-entry', () => {
    it('is importable', async () => {
      const element = await import('@hyperfrontend/ui-utils/element')
      expect(element).toBeDefined()
    })
  })

  describe('event sub-entry', () => {
    it('is importable', async () => {
      const event = await import('@hyperfrontend/ui-utils/event')
      expect(event).toBeDefined()
    })
  })

  describe('misc sub-entry', () => {
    it('is importable', async () => {
      const misc = await import('@hyperfrontend/ui-utils/misc')
      expect(misc).toBeDefined()
    })
  })

  describe('mobile sub-entry', () => {
    it('is importable', async () => {
      const mobile = await import('@hyperfrontend/ui-utils/mobile')
      expect(mobile).toBeDefined()
    })
  })

  describe('style sub-entry', () => {
    it('is importable', async () => {
      const style = await import('@hyperfrontend/ui-utils/style')
      expect(style).toBeDefined()
    })
  })

  describe('time sub-entry', () => {
    it('is importable', async () => {
      const time = await import('@hyperfrontend/ui-utils/time')
      expect(time).toBeDefined()
    })
  })
})
