/**
 * The manifests Nx discovers in a plugin package: `executors.json` and `generators.json`, as far
 * as Nx reads them and the workspace writes them.
 *
 * @module manifests/model
 */

/** One executor of `executors.json`. */
export interface ExecutorEntry {
  /** The module exporting the executor, relative to the manifest. */
  readonly implementation: string
  /** The options schema, relative to the manifest. */
  readonly schema: string
  /** What the executor does. */
  readonly description?: string
}

/** The `executors.json` of a plugin package. */
export interface ExecutorsManifest {
  /** The executors, by the name a target's `executor` field uses after the package name. */
  readonly executors: Readonly<Record<string, ExecutorEntry>>
}

/** One generator of `generators.json`. */
export interface GeneratorEntry {
  /** The module exporting the generator, relative to the manifest. */
  readonly factory: string
  /** The options schema, relative to the manifest. */
  readonly schema: string
  /** What the generator does. */
  readonly description?: string
  /** Other names the generator answers to. */
  readonly aliases?: readonly string[]
  /** Whether the generator is left out of listings. */
  readonly hidden?: boolean
}

/** The `generators.json` of a plugin package. */
export interface GeneratorsManifest {
  /** The generators, by name. */
  readonly generators: Readonly<Record<string, GeneratorEntry>>
}

/** One problem a manifest has. */
export interface ManifestIssue {
  /** The entry the problem is in, as `executors.<name>` or `generators.<name>`, or the manifest itself. */
  readonly path: string
  /** What is wrong. */
  readonly message: string
}
