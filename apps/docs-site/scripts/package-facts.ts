import type {
  EnvironmentId,
  EnvironmentSupport,
  OutputFormatId,
  PackageCompatibility,
  PackageFacts,
  PackageOutput,
} from './package-facts.types'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The runtimes a compatibility row reports, in the order the row shows them. */
const ENVIRONMENT_ORDER: readonly EnvironmentId[] = ['node', 'browser', 'webWorker']

/** The formats an output row reports, in the order the row shows them. */
const OUTPUT_ORDER: readonly OutputFormatId[] = ['esm', 'cjs', 'iife', 'umd', 'bin']

/** Support levels a declaration may use. */
const SUPPORT_LEVELS: readonly EnvironmentSupport[] = ['full', 'partial', 'none']

/** The `engines` block of a package manifest. */
interface ManifestEngines {
  /** Supported Node.js range */
  node?: string
}

/** The package manifest fields these facts are read from. */
interface PackageManifest {
  /** SPDX license identifier */
  license?: string
  /** Released version */
  version?: string
  /** Whether the package is withheld from the registry */
  private?: boolean
  /** Whether the package declares itself free of side effects */
  sideEffects?: boolean | string[]
  /** Declared engine ranges */
  engines?: ManifestEngines
}

/** One executable entry of a build target's `bin` option. */
interface BinOption {
  /** Command name installed on a consumer's PATH */
  name?: string
  /** Standalone-executable options, present when native binaries are built */
  sea?: unknown
}

/** One bundle entry of a build target's `iife` or `umd` option. */
interface BundleOption {
  /** Browser global the bundle assigns itself to */
  globalName?: string
}

/** The build target's options, as far as output formats are concerned. */
interface BuildOptions {
  /** ESM output configuration */
  esm?: unknown
  /** CommonJS output configuration */
  cjs?: unknown
  /** IIFE bundle configuration, one entry or several */
  iife?: BundleOption | BundleOption[]
  /** UMD bundle configuration, one entry or several */
  umd?: BundleOption | BundleOption[]
  /** Executables the package installs */
  bin?: BinOption[]
}

/** The build target of a project configuration. */
interface BuildTarget {
  /** Options passed to the package builder */
  options?: BuildOptions
}

/** The project configuration fields these facts are read from. */
interface ProjectConfiguration {
  /** Declared targets, keyed by name */
  targets?: Record<string, BuildTarget>
  /** Free-form project metadata */
  metadata?: ProjectMetadata
}

/** The `metadata` block of a project configuration. */
interface ProjectMetadata {
  /** Runtime compatibility the package declares */
  compatibility?: unknown
}

/**
 * Read and parse a JSON file, or return null when it is not there.
 *
 * @param path - Absolute path to the file
 * @returns The parsed contents, or null when the file does not exist
 */
function readJson<TShape>(path: string): TShape | null {
  if (!existsSync(path)) return null
  return parse(readFileSync(path, 'utf-8')) as TShape
}

/**
 * Narrow an unknown value to a support level.
 *
 * @param value - The raw declaration
 * @returns The support level, or null when the value is not one
 */
function toSupport(value: unknown): EnvironmentSupport | null {
  return SUPPORT_LEVELS.find((level) => level === value) ?? null
}

/**
 * Read the compatibility a project declares, checking the declaration rather
 * than trusting it.
 *
 * A malformed declaration throws instead of degrading to a partial row,
 * because a compatibility row that quietly loses an environment reads as a
 * package that does not support it.
 *
 * @param declared - The raw `metadata.compatibility` value
 * @param packageName - The package being read, for the failure message
 * @param nodeRange - The `engines.node` range from the package manifest
 * @returns The validated compatibility, or null when nothing is declared
 */
function readCompatibility(declared: unknown, packageName: string, nodeRange: string | undefined): PackageCompatibility | null {
  if (declared === undefined || declared === null) return null

  const record = declared as Record<string, unknown>
  const rawEnvironments = record['environments'] as Record<string, unknown> | undefined
  if (!rawEnvironments) {
    throw createError(`${packageName}: metadata.compatibility declares no environments`)
  }

  const environments = {} as Record<EnvironmentId, EnvironmentSupport>
  for (const environment of ENVIRONMENT_ORDER) {
    const support = toSupport(rawEnvironments[environment])
    if (!support) {
      throw createError(`${packageName}: metadata.compatibility.environments.${environment} must be one of ${SUPPORT_LEVELS.join(', ')}`)
    }
    environments[environment] = support
  }

  const note = record['note']
  return {
    environments,
    ...(typeof note === 'string' && note !== '' ? { note } : {}),
    ...(nodeRange !== undefined && nodeRange !== '' ? { nodeRange } : {}),
  }
}

/**
 * Collect the browser globals a bundle option defines, whether the target
 * builds one bundle or several.
 *
 * @param option - The `iife` or `umd` build option
 * @returns Every declared global, in configuration order
 */
function collectGlobalNames(option: BundleOption | BundleOption[] | undefined): string[] {
  if (!option) return []
  const entries = isArray(option) ? option : [option]
  return entries.map((entry) => entry.globalName).filter((name): name is string => typeof name === 'string' && name !== '')
}

/**
 * Derive the outputs a package publishes from the options its build target
 * carries.
 *
 * The build target is the only thing that decides what lands in the published
 * tarball, so it is the only thing consulted. A package with no build target
 * publishes nothing and gets an empty list.
 *
 * @param options - The build target's options
 * @param sideEffectFree - Whether the package manifest declares no side effects
 * @returns The outputs, in {@link OUTPUT_ORDER}
 */
function deriveOutputs(options: BuildOptions | undefined, sideEffectFree: boolean): PackageOutput[] {
  if (!options) return []

  const outputs: PackageOutput[] = []

  for (const format of OUTPUT_ORDER) {
    if (format === 'esm' && options.esm) {
      outputs.push({ format, treeShakeable: sideEffectFree })
    } else if (format === 'cjs' && options.cjs) {
      outputs.push({ format })
    } else if ((format === 'iife' || format === 'umd') && options[format]) {
      const globalNames = collectGlobalNames(options[format])
      outputs.push({ format, ...(globalNames.length > 0 ? { globalNames } : {}) })
    } else if (format === 'bin' && isArray(options.bin) && options.bin.length > 0) {
      const binaries = options.bin.map((entry) => entry.name).filter((name): name is string => typeof name === 'string' && name !== '')
      const native = options.bin.some((entry) => entry.sea !== undefined)
      outputs.push({ format, ...(binaries.length > 0 ? { binaries } : {}), ...(native ? { native: true } : {}) })
    }
  }

  return outputs
}

/**
 * Read everything a package states about itself in its own configuration.
 *
 * Compatibility is declared once, in `project.json` under
 * `metadata.compatibility`, and every publishable package must declare it: a
 * package that ships to the registry without saying where it runs is a gap in
 * the documentation, not a package to draw an empty row for. Output formats
 * are never declared at all, only derived, so they cannot drift from the build.
 *
 * @param libraryRoot - Absolute path to the library directory
 * @param packageName - The npm package name, for failure messages
 * @returns The package's own account of itself
 *
 * @example Reading the flagship's facts
 * ```ts
 * readPackageFacts('/repo/libs/features', '@hyperfrontend/features')
 * // { license: 'MIT', version: '0.10.0', isPrivate: false, compatibility: {...}, outputs: [...] }
 * ```
 */
export function readPackageFacts(libraryRoot: string, packageName: string): PackageFacts {
  const manifest = readJson<PackageManifest>(join(libraryRoot, 'package.json')) ?? {}
  const project = readJson<ProjectConfiguration>(join(libraryRoot, 'project.json')) ?? {}

  const isPrivate = manifest.private === true
  const compatibility = readCompatibility(project.metadata?.compatibility, packageName, manifest.engines?.node)

  if (!compatibility && !isPrivate) {
    throw createError(
      `${packageName}: publishable packages must declare metadata.compatibility in project.json so the docs site can state where the package runs`
    )
  }

  return {
    license: manifest.license ?? '',
    version: manifest.version ?? '',
    isPrivate,
    compatibility,
    outputs: deriveOutputs(project.targets?.['build']?.options, manifest.sideEffects === false),
  }
}
