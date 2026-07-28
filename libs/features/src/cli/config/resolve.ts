import type { DisplayDefaults, FeatureContract, FeaturePermission, ResolvedFeatureConfig, SecurityProtocol } from '../../shared/types'
import type { CliFlags } from '../args'
import { dirname, isAbsolute, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { canonicalVersion } from '../../generators/shared/canonical-version'
import { validateContract, validateFeatureConfig } from '../../shared/contract'
import { discoverConfigFile, FEATURE_CONFIG_BASENAME } from './discover'
import { loadModuleFile } from './load-module'

// note: Accepted security envelopes; the build command requires v1 or v2 for production output.
const VALID_PROTOCOLS: readonly string[] = ['none', 'v1', 'v2']

/** Inputs for {@link resolveBuildConfig}. */
export interface ResolveBuildConfigOptions {
  /** Working directory the config and contract paths resolve against. */
  readonly cwd: string
  /** Parsed CLI flags, applied with the highest precedence. */
  readonly flags: CliFlags
}

/** A fully-resolved feature config plus its loaded, validated contract. */
export interface ResolvedBuildBundle {
  /** The resolved config the generators consume. */
  readonly config: ResolvedFeatureConfig
  /** The validated contract loaded from {@link ResolvedFeatureConfig.contract}. */
  readonly contract: FeatureContract
  /** The resolved security envelope (`none` unless overridden). */
  readonly protocol: SecurityProtocol
  /** Whether the protocol came from a flag or the config file rather than the default. */
  readonly protocolExplicit: boolean
  /** Absolute path of the config file that was loaded, when one was found. */
  readonly sourcePath?: string
}

/**
 * Narrows an unknown value to a plain record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Resolves a possibly-relative path against a base directory.
 *
 * @param base - Absolute base directory.
 * @param path - The path to resolve.
 * @returns The absolute path.
 */
function toAbsolute(base: string, path: string): string {
  return isAbsolute(path) ? path : resolve(base, path)
}

/**
 * Validates the config's optional `permissions` list of Permissions-Policy feature names.
 *
 * @param value - The raw `permissions` value from the loaded config.
 * @returns The validated list, or `undefined` when the config declares none.
 * @throws {Error} When the value is not an array of non-empty strings.
 */
function parsePermissions(value: unknown): FeaturePermission[] | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw createError('Invalid config: "permissions" must be an array of Permissions-Policy feature names (e.g. ["fullscreen", "camera"]).')
  }
  return <FeaturePermission[]>value
}

/**
 * Canonicalizes the config's `version` for the contract-coherence check.
 *
 * @param version - The config's authored version string.
 * @returns The canonical semver string.
 * @throws {Error} When the config `version` is not valid semver.
 */
function canonicalConfigVersion(version: string): string {
  try {
    return canonicalVersion(version)
  } catch {
    throw createError(`Invalid config: "version" must be a valid semver version (e.g. "1.2.0"), but got "${version}".`)
  }
}

/**
 * Resolves the effective `feature.config.*` into a `ResolvedFeatureConfig` and its
 * contract, applying `defaults < config file < flags` precedence where a flag
 * replaces its whole top-level key (no deep merge).
 *
 * @param options - The working directory and parsed flags.
 * @returns The resolved config, loaded contract, protocol (with its explicitness), and source path.
 * @throws {Error} When the config or contract is missing required keys or malformed.
 *
 * @example Resolving from a discovered config plus a flag override
 * ```typescript
 * const { config, contract } = await resolveBuildConfig({ cwd: process.cwd(), flags })
 * ```
 */
export async function resolveBuildConfig(options: ResolveBuildConfigOptions): Promise<ResolvedBuildBundle> {
  const { cwd, flags } = options
  const sourcePath = flags.config ? toAbsolute(cwd, flags.config) : discoverConfigFile(cwd, FEATURE_CONFIG_BASENAME)
  const loaded = sourcePath ? await loadModuleFile(sourcePath) : {}
  if (!isRecord(loaded)) {
    throw createError(`Config at ${sourcePath} must resolve to an object.`)
  }

  const merged = {
    name: flags.name ?? loaded['name'],
    version: flags.version ?? loaded['version'],
    contract: flags.contract ?? loaded['contract'],
  }
  const config = validateFeatureConfig(merged)

  // why: An explicitly chosen protocol (flag or config) is distinguished from the fallback so the build gate can require a deliberate acknowledgment for an open build instead of ever defaulting into one.
  const chosenProtocol = flags.protocol ?? loaded['protocol']
  const protocol = chosenProtocol ?? 'none'
  if (typeof protocol !== 'string' || !VALID_PROTOCOLS.includes(protocol)) {
    throw createError(`Invalid protocol: "${String(protocol)}" (expected none, v1, or v2).`)
  }

  const baseDir = sourcePath ? dirname(sourcePath) : cwd
  const contract = validateContract(await loadModuleFile(toAbsolute(baseDir, config.contract)))
  // why: The build stamps the canonicalized config version into the connector, so a contract authoring a different version would announce a cut the build did not produce; the mismatch fails fast naming both values.
  if (contract.version !== undefined && canonicalVersion(contract.version) !== canonicalConfigVersion(config.version)) {
    throw createError(
      `Contract version "${contract.version}" does not match the feature version "${config.version}". Align the contract's "version" with the config, or remove it to inherit the config version.`
    )
  }
  const display = isRecord(loaded['display']) ? <DisplayDefaults>loaded['display'] : undefined
  const permissions = parsePermissions(loaded['permissions'])

  const resolved: ResolvedFeatureConfig = {
    ...config,
    url: flags.url ?? (typeof loaded['url'] === 'string' ? loaded['url'] : '/'),
    ...(display !== undefined && { display }),
    ...(permissions !== undefined && { permissions }),
    protocol: <SecurityProtocol>protocol,
  }
  return {
    config: resolved,
    contract,
    protocol: <SecurityProtocol>protocol,
    protocolExplicit: chosenProtocol !== undefined,
    ...(sourcePath !== null && { sourcePath }),
  }
}
