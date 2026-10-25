/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/ui-utils`
 * Tests that the package sub-entries are requireable.
 *
 * Note: ui-utils is browser-focused but sub-entries should still be requireable.
 * Functionality tests are limited as many features require a real DOM.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/ui-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { hexToRgb, rgbToHex, rgbToString } = require('@hyperfrontend/ui-utils/color')",
  'async function main() {',
  "  return { rgb: hexToRgb('#ff0000'), hex: rgbToHex(255, 0, 0).toLowerCase(), string: rgbToString(hexToRgb('#00ff00')) }",
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

describe('@hyperfrontend/ui-utils CJS', () => {
  describe('color sub-entry', () => {
    it('is requireable', () => {
      const color = require('@hyperfrontend/ui-utils/color')
      expect(color).toBeDefined()
    })

    it('exports hexToRgb function', () => {
      const { hexToRgb } = require('@hyperfrontend/ui-utils/color')
      expect(typeof hexToRgb).toBe('function')
    })

    it('exports rgbToHex function', () => {
      const { rgbToHex } = require('@hyperfrontend/ui-utils/color')
      expect(typeof rgbToHex).toBe('function')
    })

    it('hexToRgb converts hex to RGB', () => {
      const { hexToRgb } = require('@hyperfrontend/ui-utils/color')
      const rgb = hexToRgb('#ff0000')
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('rgbToHex converts RGB to hex', () => {
      const { rgbToHex } = require('@hyperfrontend/ui-utils/color')
      const hex = rgbToHex(255, 0, 0)
      expect(hex.toLowerCase()).toBe('#ff0000')
    })
  })

  describe('selector sub-entry', () => {
    it('is requireable', () => {
      const selector = require('@hyperfrontend/ui-utils/selector')
      expect(selector).toBeDefined()
    })

    it('exports select function', () => {
      const { select } = require('@hyperfrontend/ui-utils/selector')
      expect(typeof select).toBe('function')
    })

    it('exports isValidCssSelector function', () => {
      const { isValidCssSelector } = require('@hyperfrontend/ui-utils/selector')
      expect(typeof isValidCssSelector).toBe('function')
    })
  })

  describe('audio sub-entry', () => {
    it('is requireable', () => {
      const audio = require('@hyperfrontend/ui-utils/audio')
      expect(audio).toBeDefined()
    })
  })

  describe('component sub-entry', () => {
    it('is requireable', () => {
      const component = require('@hyperfrontend/ui-utils/component')
      expect(component).toBeDefined()
    })
  })

  describe('element sub-entry', () => {
    it('is requireable', () => {
      const element = require('@hyperfrontend/ui-utils/element')
      expect(element).toBeDefined()
    })
  })

  describe('event sub-entry', () => {
    it('is requireable', () => {
      const event = require('@hyperfrontend/ui-utils/event')
      expect(event).toBeDefined()
    })
  })

  describe('misc sub-entry', () => {
    it('is requireable', () => {
      const misc = require('@hyperfrontend/ui-utils/misc')
      expect(misc).toBeDefined()
    })
  })

  describe('mobile sub-entry', () => {
    it('is requireable', () => {
      const mobile = require('@hyperfrontend/ui-utils/mobile')
      expect(mobile).toBeDefined()
    })
  })

  describe('style sub-entry', () => {
    it('is requireable', () => {
      const style = require('@hyperfrontend/ui-utils/style')
      expect(style).toBeDefined()
    })
  })

  describe('time sub-entry', () => {
    it('is requireable', () => {
      const time = require('@hyperfrontend/ui-utils/time')
      expect(time).toBeDefined()
    })
  })
})

describe('@hyperfrontend/ui-utils CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('converts colours through the color entry', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      rgb: {
        r: 255,
        g: 0,
        b: 0,
      },
      hex: '#ff0000',
      string: 'rgb(0,255,0)',
    })
  })
})
