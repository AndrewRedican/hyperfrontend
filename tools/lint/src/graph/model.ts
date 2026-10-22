/**
 * The project graph model: the projects a workspace holds, the files each owns, the manifests
 * and configurations they carry, and the edges their imports and declarations draw between
 * them, as the previous linter read them off Nx.
 *
 * @module graph/model
 */

/** A project's `package.json`, as far as the graph reads it. */
export interface PackageManifest {
  /** The package name. */
  readonly name?: string
  /** The version. */
  readonly version?: string
  /** Whether the package is private. */
  readonly private?: boolean
  /** The keywords, which become tags. */
  readonly keywords?: readonly string[]
  /** The runtime dependencies. */
  readonly dependencies?: Readonly<Record<string, string>>
  /** The development dependencies. */
  readonly devDependencies?: Readonly<Record<string, string>>
  /** The peer dependencies. */
  readonly peerDependencies?: Readonly<Record<string, string>>
  /** The optional dependencies. */
  readonly optionalDependencies?: Readonly<Record<string, string>>
  /** The exports map. */
  readonly exports?: unknown
  /** Nx settings carried by the manifest. */
  readonly nx?: Readonly<Record<string, unknown>>
}

/** A project's `project.json`, as far as the graph reads it. */
export interface ProjectConfiguration {
  /** The project's name. */
  readonly name?: string
  /** `application` or `library`. */
  readonly projectType?: string
  /** The tags. */
  readonly tags?: readonly string[]
  /** The projects this one depends on without importing them. */
  readonly implicitDependencies?: readonly string[]
  /** The targets by name. */
  readonly targets?: Readonly<Record<string, unknown>>
  /** The metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>
  /** The source root. */
  readonly sourceRoot?: string
  /** The named inputs the project defines for its targets. */
  readonly namedInputs?: Readonly<Record<string, readonly unknown[]>>
}

/** One project. */
export interface ProjectRecord {
  /** The name Nx knows it by. */
  readonly name: string
  /** The root, workspace-relative and POSIX; `.` for the workspace itself. */
  readonly root: string
  /** `app` or `lib`. */
  readonly type: 'app' | 'lib'
  /** The tags: the manifest's visibility and keywords, then the configuration's. */
  readonly tags: readonly string[]
  /** The projects it depends on by declaration. */
  readonly implicitDependencies: readonly string[]
  /** The files it owns, workspace-relative and POSIX, in listing order. */
  readonly files: readonly string[]
  /** The manifest, or null when the project has none. */
  readonly manifest: PackageManifest | null
  /** The configuration, or null when the project has none. */
  readonly configuration: ProjectConfiguration | null
}

/** One import of a file. */
export interface FileImport {
  /** The specifier as written. */
  readonly specifier: string
  /** Whether it is a dynamic `import()`. */
  readonly dynamic: boolean
}

/** A specifier naming a workspace project. */
export interface ProjectResolution {
  /** The resolution's kind. */
  readonly kind: 'project'
  /** The project the specifier names. */
  readonly project: ProjectRecord
  /** The file within it, or null when the specifier names a package or a missing file. */
  readonly file: string | null
}

/** A specifier naming an npm package. */
export interface NpmResolution {
  /** The resolution's kind. */
  readonly kind: 'npm'
  /** The package name, scope included. */
  readonly name: string
}

/** A specifier naming a Node built-in, or a path no project holds. */
export interface OtherResolution {
  /** `builtin` for a Node module, `unknown` for a path outside every project. */
  readonly kind: 'builtin' | 'unknown'
}

/** What a specifier names. */
export type Resolution = ProjectResolution | NpmResolution | OtherResolution

/** An edge between projects. */
export interface Edge {
  /** The depending project. */
  readonly source: string
  /** The project depended on. */
  readonly target: string
  /** `static` for an import, `dynamic` for a dynamic import, `implicit` for a declaration. */
  readonly type: 'static' | 'dynamic' | 'implicit'
  /** The files of the source that draw the edge, for an import. */
  readonly files: readonly string[]
}

/** The npm packages a project's files import. */
export interface NpmUse {
  /** The package name. */
  readonly name: string
  /** The files importing it. */
  readonly files: readonly string[]
}
