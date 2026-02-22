import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Resolves the path to a bundle file relative to dist/libs/{package}/bundle/
 */
export function getBundlePath(packageName: string, bundleType: 'iife' | 'umd', minified = false): string {
  const suffix = minified ? '.min.js' : '.js'
  const filename = `index.${bundleType}${suffix}`
  return resolve(__dirname, `../../../dist/libs/${packageName}/bundle/${filename}`)
}

/**
 * Loads bundle code from dist and returns it as a string.
 */
export function loadBundleCode(bundlePath: string): string {
  if (!existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`)
  }
  return readFileSync(bundlePath, 'utf-8')
}

/**
 * Executes bundle code in the current jsdom window context.
 * Returns the global object that was attached by the IIFE/UMD bundle.
 */
export function executeBundleInWindow(bundleCode: string, globalName: string): unknown {
  const script = document.createElement('script')
  script.textContent = bundleCode
  document.head.appendChild(script)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = (window as any)[globalName]
  if (!global) {
    throw new Error(`Global "${globalName}" not found after executing bundle`)
  }
  return global
}

/**
 * Simulates requiring a UMD bundle in a CommonJS environment.
 */
export function requireUmdBundle(bundleCode: string): unknown {
  const mockModule: { exports: unknown } = { exports: {} }
  const mockRequire = jest.fn()

  // UMD bundles typically wrap in a function that detects the environment
  const wrapper = new Function('module', 'exports', 'require', bundleCode)
  wrapper(mockModule, mockModule.exports, mockRequire)

  return mockModule.exports
}

/**
 * Cleans up globals attached to window after bundle tests.
 */
export function cleanupWindowGlobal(globalName: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any)[globalName]
}
