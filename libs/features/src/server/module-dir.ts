import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Directory of the currently-running module under either module system.
 *
 * The CommonJS build (and any CommonJS host) exposes `__dirname`; the
 * ES-module build derives the directory from `import.meta.url`. Both formats
 * ship beside the `debug-ui` assets, so the result anchors asset
 * self-location wherever the package is installed or embedded.
 *
 * @returns Absolute directory path of the running module.
 *
 * @example Anchoring an asset lookup beside the running module
 * ```typescript
 * const assetDir = join(currentModuleDir(), 'debug-ui')
 * ```
 */
export function currentModuleDir(): string {
  // why: `typeof` guards the CommonJS-only global so the ES-module build falls through to `import.meta.url` instead of crashing on an undefined identifier.
  if (typeof __dirname !== 'undefined') {
    return __dirname
  }
  return dirname(fileURLToPath(import.meta.url))
}
