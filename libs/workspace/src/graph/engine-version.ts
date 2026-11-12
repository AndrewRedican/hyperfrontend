/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * The version of this package where it runs installed, which stamps the caches the graph writes:
 * the parser the import reader uses and the graph algorithm are both inlined into the package, so
 * its version is what identifies them, and a cache another version wrote is discarded.
 *
 * @module graph/engine-version
 */

import { dirname, join } from 'node:path'
import { readJson } from './json'

/** The package whose version identifies the installed engine. */
const ENGINE_PACKAGE_NAME = '@hyperfrontend/workspace'

/** What a cache is stamped with when no manifest of the engine is found above the module. */
export const UNKNOWN_VERSION = 'unknown'

/** A manifest as far as the engine's identity is read. */
interface EngineManifest {
  /** The package's name. */
  readonly name?: string
  /** The package's version. */
  readonly version?: string
}

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const MODULE_DIRECTORY = typeof __dirname === 'string' ? __dirname : import.meta.dirname

/**
 * The version of the engine a module belongs to: that of the nearest `package.json` at or above
 * the module's directory that names the engine package.
 *
 * @param from - The directory to climb from; this module's own when omitted
 * @returns The version, or `unknown` when no such manifest is found or it states no version
 */
export function installedEngineVersion(from: string = MODULE_DIRECTORY): string {
  let directory = from
  for (;;) {
    const manifest = readJson<EngineManifest>(join(directory, 'package.json'))
    if (manifest?.name === ENGINE_PACKAGE_NAME) return manifest.version ?? UNKNOWN_VERSION
    const parent = dirname(directory)
    if (parent === directory) return UNKNOWN_VERSION
    directory = parent
  }
}
