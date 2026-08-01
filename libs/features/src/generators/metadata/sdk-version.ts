import { dirname, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { currentModuleDir } from '../../server/module-dir'
import { sdkInfo } from '../../shared/sdk-info'

/**
 * Reads the SDK version from a directory's `package.json`, when it is the
 * SDK's own manifest.
 *
 * @param dir - The directory to probe for the SDK manifest.
 * @returns The manifest's version, or `undefined` when the directory holds no
 * manifest or one belonging to a different package.
 */
function readSdkManifestVersion(dir: string): string | undefined {
  const manifest = readJsonFileIfExists<Record<string, unknown>>(join(dir, 'package.json'))
  if (manifest !== null && manifest['name'] === sdkInfo.packageName && typeof manifest['version'] === 'string') {
    return manifest['version']
  }
  return undefined
}

/**
 * Resolves the version of the running `@hyperfrontend/features` SDK.
 *
 * Ascends from the executing module until it reaches the SDK's own
 * `package.json` (matched by package name, so unrelated manifests along the
 * way are skipped). The ascent finds the manifest wherever the package lives —
 * the built dist, an installed `node_modules` copy, or the source tree.
 *
 * @param startDir - Directory the ascent starts from; defaults to the running module's directory.
 * @returns The SDK's version string.
 * @throws {Error} When no ancestor directory holds the SDK's manifest.
 *
 * @example Stamping the running SDK version into build output
 * ```typescript
 * const sdk = resolveSdkVersion()
 * ```
 */
export function resolveSdkVersion(startDir: string = currentModuleDir()): string {
  let dir = startDir
  let parent = dirname(dir)
  // how: probe each level then step up until the filesystem root, where parent === dir
  let version = readSdkManifestVersion(dir)
  while (version === undefined && parent !== dir) {
    dir = parent
    parent = dirname(dir)
    version = readSdkManifestVersion(dir)
  }
  if (version === undefined) {
    throw createError(`Could not locate the ${sdkInfo.packageName} package.json above ${startDir} to resolve the SDK version.`)
  }
  return version
}
