import { describe, expect, it } from '@hyperfrontend/testing'
import { DisplayMode, defineConfig, defineDevConfig } from './types'

describe('DisplayMode', () => {
  it('exposes all four baked-in display modes', () => {
    expect(DisplayMode).toEqual({ Embedded: 'embedded', Dialog: 'dialog', Popup: 'popup', Standalone: 'standalone' })
  })
})

describe('defineConfig', () => {
  it('returns the same config object unchanged', () => {
    const config = { name: 'clock', version: '1.0.0', contract: './clock.contract.json' }
    expect(defineConfig(config)).toBe(config)
  })
})

describe('defineDevConfig', () => {
  it('returns the same dev config object unchanged', () => {
    const config = { apps: [{ name: 'clock', outputDir: 'dist/clock' }] }
    expect(defineDevConfig(config)).toBe(config)
  })
})
