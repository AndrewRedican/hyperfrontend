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

// note: The one opener-policy value that keeps the opener of a window a cross-origin host opened; every other value, `same-origin-allow-popups` included, mismatches that opener's own `unsafe-none` and severs it.
const KEPT_OPENER_POLICY = 'unsafe-none'

// note: The opener policy the server expands a declared `isolation` into, ahead of the authored rules.
const ISOLATION_OPENER_POLICY = 'same-origin'

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
 * Reads the opener policy one header rule sets for every path.
 *
 * A rule bounded by a prefix or suffix is not read: it leaves the rest of the
 * origin uncovered, and the feature's own URL may sit outside it.
 *
 * @param rule - One authored header rule.
 * @returns The rule's opener-policy value, lowercased, or `undefined` when the rule is bounded or sets no opener policy.
 */
function ruleOpenerPolicy(rule: ServeHeaderRule): string | undefined {
  if (rule.prefix !== undefined || rule.suffix !== undefined) {
    return undefined
  }
  const name = keys(rule.headers).find((header) => header.toLowerCase() === OPENER_POLICY_HEADER)
  return name === undefined ? undefined : rule.headers[name]?.trim().toLowerCase()
}

/**
 * Computes the opener policy the served origin applies to every path, the way
 * the server itself does: a declared `isolation` expands into a site-wide rule
 * placed ahead of the authored ones, then every unbounded rule is folded in
 * order with the last value winning. An explicit rule after the expansion is
 * therefore the documented way to take the opener policy back.
 *
 * @param config - The project's serve config.
 * @returns The effective site-wide opener-policy value, lowercased, or `undefined` when the origin sets none.
 */
function effectiveOpenerPolicy(config: ServeConfig): string | undefined {
  let policy = config.isolation === undefined ? undefined : ISOLATION_OPENER_POLICY
  for (const rule of config.headers ?? []) {
    policy = ruleOpenerPolicy(rule) ?? policy
  }
  return policy
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
  if (serveConfig === null) {
    return null
  }
  const policy = effectiveOpenerPolicy(serveConfig)
  if (policy === undefined || policy === KEPT_OPENER_POLICY) {
    return null
  }
  const unreachable = resolveDeclaredModes(config).filter((mode: DisplayMode) => WINDOWED_DISPLAY_MODES.includes(mode))
  if (unreachable.length === 0) {
    return null
  }
  const named = unreachable.map((mode) => `"${mode}"`).join(' and ')
  return `Warning: this feature composes ${named}, but its ${SERVE_CONFIG_FILENAME} serves "Cross-Origin-Opener-Policy: ${policy}" on every path. A window a cross-origin host opens onto an origin whose opener policy is anything other than "${KEPT_OPENER_POLICY}" loses its opener as the document loads, so those modes will never complete a handshake. Declare "isolation" in the feature config to compose only the modes the origin can serve, or serve the feature's own paths with "Cross-Origin-Opener-Policy: ${KEPT_OPENER_POLICY}".\n`
}
