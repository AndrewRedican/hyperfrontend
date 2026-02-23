/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/ui-utils
 * Tests that the package sub-entries are requireable.
 *
 * Note: ui-utils is browser-focused but sub-entries should still be requireable.
 * Functionality tests are limited as many features require a real DOM.
 */

describe('@hyperfrontend/ui-utils CJS', () => {
  describe('color sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const color = require('@hyperfrontend/ui-utils/color')
      expect(color).toBeDefined()
    })

    it('should export hexToRgb function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { hexToRgb } = require('@hyperfrontend/ui-utils/color')
      expect(typeof hexToRgb).toBe('function')
    })

    it('should export rgbToHex function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { rgbToHex } = require('@hyperfrontend/ui-utils/color')
      expect(typeof rgbToHex).toBe('function')
    })

    it('hexToRgb should convert hex to RGB', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { hexToRgb } = require('@hyperfrontend/ui-utils/color')
      const rgb = hexToRgb('#ff0000')
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('rgbToHex should convert RGB to hex', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { rgbToHex } = require('@hyperfrontend/ui-utils/color')
      const hex = rgbToHex(255, 0, 0)
      expect(hex.toLowerCase()).toBe('#ff0000')
    })
  })

  describe('selector sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const selector = require('@hyperfrontend/ui-utils/selector')
      expect(selector).toBeDefined()
    })

    it('should export select function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { select } = require('@hyperfrontend/ui-utils/selector')
      expect(typeof select).toBe('function')
    })

    it('should export isValidCssSelector function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isValidCssSelector } = require('@hyperfrontend/ui-utils/selector')
      expect(typeof isValidCssSelector).toBe('function')
    })
  })

  describe('audio sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const audio = require('@hyperfrontend/ui-utils/audio')
      expect(audio).toBeDefined()
    })
  })

  describe('component sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const component = require('@hyperfrontend/ui-utils/component')
      expect(component).toBeDefined()
    })
  })

  describe('element sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const element = require('@hyperfrontend/ui-utils/element')
      expect(element).toBeDefined()
    })
  })

  describe('event sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const event = require('@hyperfrontend/ui-utils/event')
      expect(event).toBeDefined()
    })
  })

  describe('misc sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const misc = require('@hyperfrontend/ui-utils/misc')
      expect(misc).toBeDefined()
    })
  })

  describe('mobile sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mobile = require('@hyperfrontend/ui-utils/mobile')
      expect(mobile).toBeDefined()
    })
  })

  describe('style sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const style = require('@hyperfrontend/ui-utils/style')
      expect(style).toBeDefined()
    })
  })

  describe('time sub-entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const time = require('@hyperfrontend/ui-utils/time')
      expect(time).toBeDefined()
    })
  })
})
