/**
 * UMD bundle E2E tests for @hyperfrontend/features
 * Tests that the host/hostee UMD bundles load, attach their globals, and
 * stay callable on a page without cross-origin isolation.
 */

import { resolve } from 'node:path'
import { executeBundleInWindow, loadBundleCode } from '../../shared/helpers'

const umdBundle = (dir: string, minified = false): string =>
  resolve(__dirname, `../../../../dist/libs/features/bundle/${dir}/index.umd${minified ? '.min' : ''}.js`)

const bundles: ReadonlyArray<readonly [string, string, string]> = [
  ['host', 'HyperfrontendFeaturesHost', 'createShell'],
  ['hostee', 'HyperfrontendFeaturesHostee', 'createFeature'],
]

// note: A feature-oriented contract exactly as a feature would author it: `emitted` is what the feature sends, `accepted` is what it handles.
const featureContract = {
  emitted: [{ type: 'tick', description: 'Time snapshot the feature streams to its host.' }],
  accepted: [{ type: 'ping', description: 'Liveness probe the host sends to the feature.' }],
}

/** Slice of the host bundle's global used by these tests. */
interface HostGlobal {
  builtInDisplayModes: object
  createShell(options: object): unknown
}

/** Slice of the hostee bundle's global used by these tests. */
interface HosteeGlobal {
  createFeature(options: object): unknown
}

describe('@hyperfrontend/features UMD bundles', () => {
  it.each(bundles)('%s bundle file exists', (dir) => {
    expect(() => loadBundleCode(umdBundle(dir))).not.toThrow()
  })

  it.each(bundles)('%s minified bundle file exists', (dir) => {
    expect(() => loadBundleCode(umdBundle(dir, true))).not.toThrow()
  })

  it.each(bundles)('%s bundle attaches its API to the window global', (dir, globalName, api) => {
    const global = <Record<string, unknown>>executeBundleInWindow(loadBundleCode(umdBundle(dir)), globalName)
    expect(global[api]).toBeDefined()
  })

  describe('on a page without cross-origin isolation', () => {
    const scope = <{ SharedArrayBuffer?: unknown }>(<unknown>globalThis)
    let originalSharedArrayBuffer: unknown

    beforeAll(() => {
      originalSharedArrayBuffer = scope.SharedArrayBuffer
      // why: jsdom inherits Node's SharedArrayBuffer, but a browser page served without COOP/COEP isolation has none; removing it reproduces that consumer page.
      delete scope.SharedArrayBuffer
    })

    afterAll(() => {
      if (originalSharedArrayBuffer !== undefined) {
        scope.SharedArrayBuffer = originalSharedArrayBuffer
      }
    })

    it('evaluates the host bundle without SharedArrayBuffer available', () => {
      expect(() => executeBundleInWindow(loadBundleCode(umdBundle('host')), 'HyperfrontendFeaturesHost')).not.toThrow()
    })

    it('creates a shell from the host bundle at call time', () => {
      const host = <HostGlobal>executeBundleInWindow(loadBundleCode(umdBundle('host')), 'HyperfrontendFeaturesHost')
      expect(() =>
        host.createShell({
          modes: host.builtInDisplayModes,
          container: document.createElement('div'),
          contract: featureContract,
          url: 'http://localhost:4300/',
        })
      ).not.toThrow()
    })

    it('evaluates the hostee bundle without SharedArrayBuffer available', () => {
      expect(() => executeBundleInWindow(loadBundleCode(umdBundle('hostee')), 'HyperfrontendFeaturesHostee')).not.toThrow()
    })

    it('creates a feature from the hostee bundle at call time', () => {
      const hostee = <HosteeGlobal>executeBundleInWindow(loadBundleCode(umdBundle('hostee')), 'HyperfrontendFeaturesHostee')
      expect(() => hostee.createFeature({ name: 'e2e-feature', contract: featureContract })).not.toThrow()
    })
  })
})
