/** A runtime a package can claim support for. */
export type EnvironmentId = 'node' | 'browser' | 'webWorker'

/**
 * How completely a package supports one runtime.
 *
 * `partial` exists because the honest answer for a few packages is neither yes
 * nor no, and a bare tick beside a package whose support is per entry point
 * would be a claim the repository does not make.
 */
export type EnvironmentSupport = 'full' | 'partial' | 'none'

/**
 * A package's declared runtime compatibility, as its `project.json` states it
 * under `metadata.compatibility`.
 */
export interface PackageCompatibility {
  /** Support level per runtime */
  environments: Record<EnvironmentId, EnvironmentSupport>
  /** One line qualifying the row, present only when a bare support level would mislead */
  note?: string
  /** The `engines.node` range the package.json declares, when it declares one */
  nodeRange?: string
}

/** A module or bundle format a package's build target emits. */
export type OutputFormatId = 'esm' | 'cjs' | 'iife' | 'umd' | 'bin'

/**
 * One output a package publishes, with the few facts that distinguish it from
 * the same format in another package.
 */
export interface PackageOutput {
  /** Which format this entry describes */
  format: OutputFormatId
  /** Browser globals the bundles define, for `iife` and `umd` */
  globalNames?: string[]
  /** Executables the package installs, for `bin` */
  binaries?: string[]
  /** Whether standalone native executables are built alongside the script, for `bin` */
  native?: boolean
  /** Whether the package declares itself free of side effects, for `esm` */
  treeShakeable?: boolean
}

/**
 * Everything a package landing page needs about the package itself, as opposed
 * to about its documentation.
 */
export interface PackageFacts {
  /** SPDX identifier from package.json, empty when the manifest carries none */
  license: string
  /** Released version, empty when the package.json carries none */
  version: string
  /** Whether the package is withheld from the registry */
  isPrivate: boolean
  /** Declared runtime compatibility, absent for a package that declares none */
  compatibility: PackageCompatibility | null
  /** Formats the build target emits, in presentation order */
  outputs: PackageOutput[]
}
