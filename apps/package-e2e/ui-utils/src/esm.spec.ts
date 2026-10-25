/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/ui-utils`
 * Tests that the package sub-entries are importable.
 *
 * Note: ui-utils is browser-focused but sub-entries should still be importable.
 * Functionality tests are limited as many features require a real DOM.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/ui-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { hexToRgb, rgbToHex, rgbToString } from '@hyperfrontend/ui-utils/color'",
  'async function main() {',
  "  return { rgb: hexToRgb('#ff0000'), hex: rgbToHex(255, 0, 0).toLowerCase(), string: rgbToString(hexToRgb('#00ff00')) }",
  '}',
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

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

describe('@hyperfrontend/ui-utils ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('converts colours through the color entry', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
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
