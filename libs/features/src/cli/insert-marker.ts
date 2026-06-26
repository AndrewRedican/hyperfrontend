// note: Token searched for to keep insertion idempotent; deleting the block reverses the mutation.
const MARKER_TOKEN = '<hf:feature>'

/** Result of attempting to insert the marker-guarded glue import. */
export interface MarkerInsertion {
  /** The (possibly unchanged) entry-file content. */
  readonly content: string
  /** Whether the marker block was newly inserted. */
  readonly changed: boolean
}

/**
 * Builds the marker-guarded glue import block for an entry file.
 *
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The marker block, including a trailing newline.
 *
 * @example Building the block for a co-located glue module
 * ```typescript
 * buildMarkerBlock('./hyperfrontend.feature')
 * ```
 */
export function buildMarkerBlock(importSpecifier: string): string {
  return `// <hf:feature> — managed by @hyperfrontend/features; safe to keep\nimport '${importSpecifier}'\n// </hf:feature>\n`
}

/**
 * Inserts the marker-guarded glue import at the top of an entry file, idempotently.
 *
 * When the marker is already present the source is returned unchanged so re-runs
 * never duplicate the import — this is the CLI's only mutation of hand-written
 * app code and is reversible by deleting the block.
 *
 * @param source - The current entry-file content.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The resulting content and whether it changed.
 *
 * @example Wiring the glue import into an app entry
 * ```typescript
 * const { content, changed } = insertFeatureImport(entrySource, './hyperfrontend.feature')
 * ```
 */
export function insertFeatureImport(source: string, importSpecifier: string): MarkerInsertion {
  if (source.includes(MARKER_TOKEN)) {
    return { content: source, changed: false }
  }
  return { content: `${buildMarkerBlock(importSpecifier)}\n${source}`, changed: true }
}
