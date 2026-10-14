import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The module record a UMD wrapper writes its exports onto when it takes the CommonJS branch.
 */
type CommonJsModule = {
  /** What the bundle assigned, read back as the bundle's public surface. */
  exports: unknown
}

/**
 * Resolves the path to a bundle file relative to dist/libs/{package}/bundle/.
 *
 * The path is anchored on the working directory rather than this module's own location,
 * because the e2e executor always launches the suites from the workspace root and the
 * module has to say the same thing under a CommonJS transform and as a native ES module.
 *
 * @param packageName - The unscoped package directory under dist/libs.
 * @param bundleType - Which browser bundle to resolve.
 * @param minified - Whether to resolve the minified twin.
 * @returns The absolute path to the bundle file.
 */
export function getBundlePath(packageName: string, bundleType: 'iife' | 'umd', minified = false): string {
  const suffix = minified ? '.min.js' : '.js'
  const filename = `index.${bundleType}${suffix}`
  return resolve(process.cwd(), `dist/libs/${packageName}/bundle/${filename}`)
}

/**
 * Loads bundle code from dist and returns it as a string.
 *
 * @param bundlePath - The absolute path to the bundle file.
 * @returns The bundle source.
 */
export function loadBundleCode(bundlePath: string): string {
  if (!existsSync(bundlePath)) {
    throw new Error(`Bundle not found: ${bundlePath}`)
  }
  return readFileSync(bundlePath, 'utf-8')
}

/**
 * Executes bundle code against the window and returns the global it attached.
 *
 * The code runs through indirect eval, whose top-level `var` declarations land on the
 * global object exactly as a classic script's would; the previous script-element approach
 * only executed under a DOM configured to run scripts. The target global is cleared first,
 * so a bundle that fails to attach cannot pass on a value left by an earlier test.
 *
 * @param bundleCode - The IIFE bundle source.
 * @param globalName - The global the bundle is expected to attach.
 * @returns Whatever the bundle attached under that global.
 */
export function executeBundleInWindow(bundleCode: string, globalName: string): unknown {
  const target = window as unknown as Record<string, unknown>
  try {
    target[globalName] = undefined
  } catch {
    // why: the property may be non-writable, in which case the freshness guard simply does not apply.
  }

  ;(0, eval)(bundleCode)

  const attached = target[globalName]
  if (!attached) {
    throw new Error(`Global "${globalName}" not found after executing bundle`)
  }
  return attached
}

/**
 * Simulates requiring a UMD bundle in a CommonJS environment.
 *
 * @param bundleCode - The UMD bundle source.
 * @returns The exports the bundle assigned to the module record.
 */
export function requireUmdBundle(bundleCode: string): unknown {
  const mockModule: CommonJsModule = { exports: {} }
  const requireCalls: unknown[][] = []
  const mockRequire = (...args: unknown[]) => {
    requireCalls.push(args)
    return undefined
  }

  // how: a UMD wrapper probes for `module` and `exports` before `define` or a global, so handing it a CommonJS-shaped triple makes it take the CommonJS branch.
  const wrapper = new Function('module', 'exports', 'require', bundleCode)
  wrapper(mockModule, mockModule.exports, mockRequire)

  return mockModule.exports
}
