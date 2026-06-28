/**
 * UMD bundle E2E tests for @hyperfrontend/features
 * Tests that the host/hostee UMD bundles load and attach their globals.
 */

import { resolve } from 'node:path'
import { executeBundleInWindow, loadBundleCode } from '../../shared/helpers'

const umdBundle = (dir: string, minified = false): string =>
  resolve(__dirname, `../../../../dist/libs/features/bundle/${dir}/index.umd${minified ? '.min' : ''}.js`)

const bundles: ReadonlyArray<readonly [string, string, string]> = [
  ['host', 'HyperfrontendFeaturesHost', 'createShell'],
  ['hostee', 'HyperfrontendFeaturesHostee', 'createFeature'],
]

describe('@hyperfrontend/features UMD bundles', () => {
  it.each(bundles)('%s bundle file exists', (dir) => {
    expect(() => loadBundleCode(umdBundle(dir))).not.toThrow()
  })

  it.each(bundles)('%s minified bundle file exists', (dir) => {
    expect(() => loadBundleCode(umdBundle(dir, true))).not.toThrow()
  })

  it.each(bundles)('%s bundle attaches its API to the window global', (dir, globalName, api) => {
    const global = executeBundleInWindow(loadBundleCode(umdBundle(dir)), globalName) as Record<string, unknown>
    expect(global[api]).toBeDefined()
  })
})
