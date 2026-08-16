/**
 * Repository field in package.json.
 */
export interface RepositoryField {
  /** Repository type (e.g., 'git'). */
  type: string
  /** Repository URL. */
  url: string
  /** Optional sub-directory inside the repository. */
  directory?: string
}

/**
 * Bugs field in package.json.
 */
export interface BugsField {
  /** Bug tracker URL. */
  url?: string
  /** Bug tracker email. */
  email?: string
}

/**
 * Author / contributor entry in package.json.
 */
export interface AuthorField {
  /** Author name. */
  name: string
  /** Author email. */
  email?: string
  /** Author URL. */
  url?: string
}

/**
 * Funding entry in package.json.
 */
export interface FundingField {
  /** Funding type (e.g., 'github', 'patreon'). */
  type: string
  /** Funding URL. */
  url: string
}

/**
 * Conditional export specification for the package.json `exports` field.
 *
 * Each property maps an export condition (e.g., `import`, `require`, `types`) to a
 * resolved file path, or to a nested conditional-export object for further refinement.
 */
export interface ConditionalExport {
  /** Path used by ESM `import`. */
  import?: string
  /** Path used by CommonJS `require`. */
  require?: string
  /** Default fallback path. */
  default?: string
  /** TypeScript declaration path. */
  types?: string
  /** Node.js-specific export. */
  node?: string | ConditionalExport
  /** Browser-specific export. */
  browser?: string | ConditionalExport
  /** Development build export. */
  development?: string | ConditionalExport
  /** Production build export. */
  production?: string | ConditionalExport
}

/**
 * Value form for an `exports` map entry: a resolved string path, a conditional
 * exports object, or a nested record for sub-conditions.
 */
export type ExportValue = string | ConditionalExport | Record<string, unknown>

/**
 * Subset of the npm package.json schema that the builder reads from and writes to.
 *
 * Only fields the builder pipeline interacts with directly are typed; arbitrary additional
 * fields are preserved through the index signature and emitted to the output package.json.
 */
export interface PackageJson {
  /** Package name. */
  name?: string
  /** Package version. */
  version?: string
  /** Short package description. */
  description?: string
  /** SPDX license identifier or expression. */
  license?: string
  /** Main entry path (CommonJS). */
  main?: string
  /** Module entry path (ESM). */
  module?: string
  /** TypeScript type-declarations entry path. */
  types?: string
  /** Subpath exports map. */
  exports?: Record<string, ExportValue>
  /** Bin name → script path mapping. */
  bin?: Record<string, string> | string
  /** Runtime dependencies. */
  dependencies?: Record<string, string>
  /** Development dependencies. */
  devDependencies?: Record<string, string>
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>
  /** Optional dependencies. */
  optionalDependencies?: Record<string, string>
  /** Repository field. */
  repository?: RepositoryField | string
  /** Bugs field. */
  bugs?: BugsField | string
  /** Homepage URL. */
  homepage?: string
  /** Author field. */
  author?: AuthorField | string
  /** Contributors. */
  contributors?: (AuthorField | string)[]
  /** Funding entry or list. */
  funding?: FundingField | FundingField[] | string
  /** Whether the package has side effects. */
  sideEffects?: boolean
  /** Keywords for npm search. */
  keywords?: string[]
  /** unpkg CDN entry path. */
  unpkg?: string
  /** jsdelivr CDN entry path. */
  jsdelivr?: string
  /** Engines compatibility map. */
  engines?: Record<string, string>
  /** Files included when packaging. */
  files?: string[]
  /** Arbitrary additional fields preserved on read/write. */
  [key: string]: unknown
}
