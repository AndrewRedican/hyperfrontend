import type { PackageManager, PathExists } from './install'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { resolveSdkManifest } from '../../generators/metadata/sdk-version'
import { detectPackageManager } from './install'

/** Loads the packaged plugin's manifest object. */
export type ManifestLoader = () => Record<string, unknown>

/** Resolves a candidate binding package from the consumer workspace root; throws when unresolvable. */
export type BindingResolver = (packageName: string, workspaceRoot: string) => string

/** Injectable boundaries for the advisory check, defaulted for production and overridden in tests. */
export interface RollupBindingAdvisoryOptions {
  /** Loads the plugin manifest whose `optionalDependencies` pin the bindings; defaults to the SDK manifest ascent. */
  readonly loadManifest?: ManifestLoader
  /** Resolution boundary for candidate packages; defaults to a `createRequire` resolve from the workspace root. */
  readonly resolveBinding?: BindingResolver
  /** Sink for the advisory warning; defaults to `process.stderr`. */
  readonly stderr?: NodeJS.WritableStream
  /** Existence probe for lockfile detection; defaults to disk checks under the workspace root. */
  readonly pathExists?: PathExists
}

// note: npm is the one manager that commonly skips optionals (config or flags); the others install them by default, so a plain install heals.
const REMEDIATION: Record<PackageManager, string> = {
  npm: 'npm install --include=optional',
  yarn: 'yarn install',
  pnpm: 'pnpm install',
  bun: 'bun install',
}

/**
 * Default binding resolver: resolve the package from the consumer workspace root.
 *
 * @param packageName - The platform binding package to resolve.
 * @param workspaceRoot - Absolute root of the consumer workspace.
 * @returns The resolved module path.
 */
function requireResolveBinding(packageName: string, workspaceRoot: string): string {
  return createRequire(join(workspaceRoot, 'package.json')).resolve(packageName)
}

/**
 * Warn on stderr when rollup's native binding for this platform is missing.
 *
 * Advisory only: never throws and writes nothing when the check cannot run or
 * passes. Candidates are the plugin manifest's `optionalDependencies` whose
 * names carry the running `platform-arch` pair; when at least one resolves
 * from the consumer workspace the build can proceed and the check stays
 * silent. Otherwise one warning names the missing packages at their pinned
 * versions, explains that `hf build` (and the build executor) needs the native
 * binding, and gives the exact install command for the detected package
 * manager.
 *
 * @param workspaceRoot - Absolute root of the consumer workspace resolution runs against.
 * @param options - Injectable boundaries; see {@link RollupBindingAdvisoryOptions}.
 *
 * @example Explaining a failed build that may lack the platform binding
 * ```typescript
 * warnIfRollupBindingMissing(context.root)
 * ```
 */
export function warnIfRollupBindingMissing(workspaceRoot: string, options: RollupBindingAdvisoryOptions = {}): void {
  const loadManifest = options.loadManifest ?? resolveSdkManifest
  let manifest: Record<string, unknown>
  try {
    manifest = loadManifest()
  } catch {
    // why: advisory only — without the plugin manifest there is nothing to check against.
    return
  }
  const optional = manifest['optionalDependencies']
  if (typeof optional !== 'object' || optional === null) {
    return
  }
  const declarations = <Record<string, unknown>>optional
  const platformMarker = `-${process.platform}-${process.arch}`
  // why: the marker must end on a token boundary so an 'arm' host never matches 'arm64' binding names.
  const candidates = keys(declarations).filter((name) => {
    const markerIndex = name.indexOf(platformMarker)
    if (markerIndex === -1) {
      return false
    }
    const nextChar = name.charAt(markerIndex + platformMarker.length)
    return nextChar === '' || nextChar === '-'
  })
  if (candidates.length === 0) {
    return
  }
  const resolveBinding = options.resolveBinding ?? requireResolveBinding
  const resolvable = candidates.some((name) => {
    try {
      resolveBinding(name, workspaceRoot)
      return true
    } catch {
      // note: this candidate is not installed; keep checking the remaining ones.
      return false
    }
  })
  if (resolvable) {
    return
  }
  const pathExists = options.pathExists ?? ((relativePath: string) => existsSync(join(workspaceRoot, relativePath)))
  const packageManager = detectPackageManager(pathExists)
  const stderr = options.stderr ?? process.stderr
  const pinned = candidates.map((name) => `${name}@${String(declarations[name])}`).join(', ')
  stderr.write(
    `Rollup's native binding for this platform is not installed (expected one of: ${pinned}). \`hf build\` and the @hyperfrontend/features build executor need it to bundle. Run \`${REMEDIATION[packageManager]}\` to install it.\n`
  )
}
