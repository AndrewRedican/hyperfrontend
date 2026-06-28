/**
 * IIFE bundle E2E tests for @hyperfrontend/features
 * Tests that the host/hostee browser bundles load and attach their globals.
 */

import { resolve } from 'node:path'
import { executeBundleInWindow, loadBundleCode } from '../../shared/helpers'

const iifeBundle = (dir: string, minified = false): string =>
  resolve(__dirname, `../../../../dist/libs/features/bundle/${dir}/index.iife${minified ? '.min' : ''}.js`)

const bundles: ReadonlyArray<readonly [string, string, string]> = [
  ['host', 'HyperfrontendFeaturesHost', 'createShell'],
  ['hostee', 'HyperfrontendFeaturesHostee', 'createFeature'],
]

describe('@hyperfrontend/features IIFE bundles', () => {
  it.each(bundles)('%s bundle file exists', (dir) => {
    expect(() => loadBundleCode(iifeBundle(dir))).not.toThrow()
  })

  it.each(bundles)('%s minified bundle file exists', (dir) => {
    expect(() => loadBundleCode(iifeBundle(dir, true))).not.toThrow()
  })

  it.each(bundles)('%s bundle attaches its API to the window global', (dir, globalName, api) => {
    const global = executeBundleInWindow(loadBundleCode(iifeBundle(dir)), globalName) as Record<string, unknown>
    expect(global[api]).toBeDefined()
  })
})
