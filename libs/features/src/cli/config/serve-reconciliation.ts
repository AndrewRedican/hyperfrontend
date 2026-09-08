import type { ServeConfig, ServeHeaderRule } from '../../shared/serve-types'
import type { DisplayMode, ResolvedFeatureConfig } from '../../shared/types'
import { dirname, join } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { resolveDeclaredModes } from '../../generators/shared/declared-modes'
import { WINDOWED_DISPLAY_MODES } from '../../shared/isolation'
import { SERVE_CONFIG_BASENAME } from './discover'

// note: A bundler copies this directory verbatim to the served root, so the artifact-carried serve config is authored there rather than beside feature.config.
const PUBLIC_DIRECTORY = 'public'

// note: The only artifact-carried serve-config format; a TS or JS one needs the module loader and is not read here.
const SERVE_CONFIG_FILENAME = `${SERVE_CONFIG_BASENAME}.json`

// note: The header an origin declares its opener policy in, lowercased for comparison.
const OPENER_POLICY_HEADER = 'cross-origin-opener-policy'

// note: The one opener-policy value that severs an incoming opener; `same-origin-allow-popups` governs windows the document opens, not the opener it keeps when it is opened.
const SEVERING_POLICY = 'same-origin'

/**
 * Reads the serve config a build's output will carry, when the project authored one.
 *
 * @param baseDir - The directory the feature config was loaded from.
 * @returns The parsed serve config, or `null` when the project has none.
 */
function readServeConfig(baseDir: string): ServeConfig | null {
  return (
    readJsonFileIfExists<ServeConfig>(join(baseDir, PUBLIC_DIRECTORY, SERVE_CONFIG_FILENAME)) ??
    readJsonFileIfExists<ServeConfig>(join(baseDir, SERVE_CONFIG_FILENAME))
  )
}

/**
 * Finds the opener policy a header rule sets for every path.
 *
 * A rule bounded by a prefix or suffix is not read: it leaves the rest of the
 * origin uncovered, and the feature's own URL may sit outside it.
 *
 * @param rules - The authored header rules, when any.
 * @returns The opener-policy value applied site-wide, lowercased, or `undefined`.
 */
function siteWideOpenerPolicy(rules: readonly ServeHeaderRule[] | undefined): string | undefined {
  const unbounded = rules?.find((rule) => rule.prefix === undefined && rule.suffix === undefined)
  if (unbounded === undefined) {
    return undefined
  }
  const name = keys(unbounded.headers).find((header) => header.toLowerCase() === OPENER_POLICY_HEADER)
  return name === undefined ? undefined : unbounded.headers[name]?.trim().toLowerCase()
}

/**
 * Reports whether a served origin severs the opener of a window a cross-origin
 * host opens onto it.
 *
 * Two spellings say the same thing: the declared `isolation` key, and a
 * hand-written opener policy on the rule covering every path.
 *
 * @param config - The project's serve config.
 * @returns `true` when the origin's opener policy severs a cross-origin opener.
 */
function seversOpener(config: ServeConfig): boolean {
  return config.isolation !== undefined || siteWideOpenerPolicy(config.headers) === SEVERING_POLICY
}

/**
 * Reconciles a feature's declared display modes against the opener policy its
 * own origin will serve, returning an advisory message when they disagree.
 *
 * The config types already make this combination unauthorable in a
 * `feature.config.ts`, and the build refuses it in a JSON config that declares
 * `isolation`. What is left is the gap between two files: a serve config that
 * spells the headers by hand, or declares isolation the feature config never
 * mentions. That is a deliberate escape hatch, so it warns rather than fails.
 *
 * @param config - The resolved feature config, supplying the declared modes.
 * @param sourcePath - Absolute path of the feature config that was loaded, or `null` when the build ran on flags alone.
 * @returns The warning to print, or `null` when the two agree or there is nothing to compare.
 *
 * @example Reconciling before a build
 * ```typescript
 * const warning = reconcileServeIsolation(config, '/project/feature.config.ts')
 * ```
 */
export function reconcileServeIsolation(config: ResolvedFeatureConfig, sourcePath: string | null): string | null {
  if (sourcePath === null || config.isolation !== undefined) {
    return null
  }
  const serveConfig = readServeConfig(dirname(sourcePath))
  if (serveConfig === null || !seversOpener(serveConfig)) {
    return null
  }
  const unreachable = resolveDeclaredModes(config).filter((mode: DisplayMode) => WINDOWED_DISPLAY_MODES.includes(mode))
  if (unreachable.length === 0) {
    return null
  }
  const named = unreachable.map((mode) => `"${mode}"`).join(' and ')
  return `Warning: this feature composes ${named}, but its ${SERVE_CONFIG_FILENAME} makes the origin cross-origin isolated. A window a cross-origin host opens onto an isolated origin loses its opener as the document loads, so those modes will never complete a handshake. Declare "isolation" in the feature config to compose only the modes the origin can serve, or drop the isolation headers.\n`
}
