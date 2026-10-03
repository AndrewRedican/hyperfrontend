/**
 * Support a package declares for one runtime environment.
 */
export type SupportLevel = 'full' | 'partial' | 'none'

/**
 * Environment support declared under `metadata.compatibility` in project.json.
 */
interface CompatibilityEnvironments {
  /** Declared support for Node.js. */
  node?: unknown
  /** Declared support for the browser. */
  browser?: unknown
  /** Declared support for a Web Worker. */
  webWorker?: unknown
}

/**
 * The `metadata.compatibility` block of project.json.
 */
interface CompatibilityMetadata {
  /** Declared support per runtime environment. */
  environments?: CompatibilityEnvironments
  /** Caveat rendered under the platform table. */
  note?: string
}

/**
 * The `metadata` block of project.json, restricted to what the matrix reads.
 */
interface ProjectMetadata {
  /** Compatibility declaration for the package. */
  compatibility?: CompatibilityMetadata
}

/**
 * Configuration for one browser bundle (IIFE or UMD).
 */
export interface BundleFormatConfig {
  /** Entry point the bundle is built from. */
  entry?: string
  /** Global variable the bundle assigns itself to. */
  globalName?: string
}

/**
 * Build options of project.json, restricted to the output formats the matrix reads.
 */
export interface MatrixBuildOptions {
  /** ESM output configuration. */
  esm?: unknown
  /** CommonJS output configuration. */
  cjs?: unknown
  /** IIFE output configuration: one bundle or several. */
  iife?: BundleFormatConfig | BundleFormatConfig[]
  /** UMD output configuration: one bundle or several. */
  umd?: BundleFormatConfig | BundleFormatConfig[]
  [key: string]: unknown
}

/**
 * Build target of project.json, restricted to its options.
 */
interface MatrixBuildTarget {
  /** Options passed to the build executor. */
  options?: MatrixBuildOptions
  [key: string]: unknown
}

/**
 * The `targets` map of project.json, restricted to the `build` entry.
 */
interface MatrixTargets {
  /** Build target. */
  build?: MatrixBuildTarget
  /** Publish target; its presence marks the library publishable. */
  publish?: unknown
  [key: string]: unknown
}

/**
 * project.json fields the matrix is derived from.
 */
export interface MatrixProjectJson {
  /** Nx project type; only libraries are documented. */
  projectType?: string
  /** Nx project metadata carrying the compatibility declaration. */
  metadata?: ProjectMetadata
  /** Build targets. */
  targets?: MatrixTargets
  [key: string]: unknown
}

/**
 * The npm `engines` block.
 */
interface PackageEngines {
  /** Supported Node.js range. */
  node?: string
  /** Supported npm range. */
  npm?: string
}

/**
 * package.json fields the matrix is derived from.
 */
export interface MatrixPackageJson {
  /** Published package name. */
  name?: string
  /** Published version. */
  version?: string
  /** Runtime version ranges the package supports. */
  engines?: PackageEngines
  /** Runtime dependencies. */
  dependencies?: Record<string, string>
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>
  [key: string]: unknown
}

/**
 * A first-party dependency edge drawn in the dependency section.
 */
export interface MatrixDependency {
  /** Name of the package depended on. */
  packageName: string
  /** Whether the dependency is declared as a peer dependency. */
  peer: boolean
}

/**
 * Declared support for each runtime environment, null where nothing is declared.
 */
export interface MatrixEnvironments {
  /** Node.js support. */
  node: SupportLevel | null
  /** Browser support. */
  browser: SupportLevel | null
  /** Web Worker support. */
  webWorker: SupportLevel | null
}

/**
 * Output formats a package's build target produces.
 */
export interface MatrixFormats {
  /** Ships an ESM build. */
  esm: boolean
  /** Ships a CommonJS build. */
  cjs: boolean
  /** Ships an IIFE bundle. */
  iife: boolean
  /** Ships a UMD bundle. */
  umd: boolean
}

/**
 * Everything the generated document states about one publishable library.
 */
export interface MatrixLibrary {
  /** Published package name. */
  packageName: string
  /** Package name without its scope, used for diagram labels. */
  shortName: string
  /** Published version, null when package.json declares none. */
  version: string | null
  /** Supported Node.js range, null when package.json declares none. */
  nodeEngine: string | null
  /** Supported npm range, null when package.json declares none. */
  npmEngine: string | null
  /** Declared runtime support. */
  environments: MatrixEnvironments
  /** Caveat to render under the platform table, null when there is none. */
  note: string | null
  /** Output formats produced by the build target. */
  formats: MatrixFormats
  /** Global names the browser bundles assign themselves to. */
  globalNames: string[]
  /** First-party dependencies, sorted by package name. */
  dependencies: MatrixDependency[]
}
