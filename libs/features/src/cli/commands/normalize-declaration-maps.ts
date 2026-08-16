import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { readDirectoryRecursive, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core/fs'

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
 * Rewrites one declaration-map source path to a stable, feature-derived form.
 *
 * @param source - The emitted source path, possibly reaching into the build's throwaway staging directory.
 * @param packageName - The sanitized feature name the stable path is rooted at.
 * @returns The stable source path.
 */
function toStableSource(source: string, packageName: string): string {
  // why: An already-stable source keeps its shape, so re-running the pass never degrades a path it produced earlier.
  if (source.startsWith(`${packageName}/`)) {
    return source
  }
  const segments = source.split('/')
  const stagingIndex = segments.findIndex((segment) => segment.startsWith('.hf-shell-'))
  // why: Only the segments inside the staging dir identify the file; everything before them describes the build machine and process, not the feature.
  const tail = stagingIndex === -1 ? segments.slice(-1) : segments.slice(stagingIndex + 1)
  return [packageName, ...tail].join('/')
}

/**
 * Rewrites the `sources` paths of every `*.d.ts.map` under a build output
 * directory to stable paths derived from the feature name, so rebuilding an
 * unchanged feature emits byte-identical declaration maps. A map file that is
 * not valid JSON or carries no `sources` array is left untouched with a note.
 *
 * @param outputDir - The built package directory to walk.
 * @param featureName - The feature name the stable source paths derive from.
 * @param warn - Sink for the note written when a malformed map file is skipped.
 *
 * @example Normalizing a built shell's declaration maps
 * ```typescript
 * normalizeDeclarationMaps('/project/dist/clock-shell', 'clock', (message) => process.stderr.write(message))
 * ```
 */
export function normalizeDeclarationMaps(outputDir: string, featureName: string, warn: (message: string) => void): void {
  const packageName = featureName.replace(/[^a-z0-9-]/gi, '-')
  for (const entry of readDirectoryRecursive(outputDir)) {
    if (!entry.isFile || !entry.name.endsWith('.d.ts.map')) {
      continue
    }
    let map: unknown
    try {
      map = parse(readFileContent(entry.path))
    } catch {
      warn(`Skipping malformed declaration map: ${entry.path}\n`)
      continue
    }
    if (!isRecord(map) || !isArray(map['sources'])) {
      warn(`Skipping malformed declaration map: ${entry.path}\n`)
      continue
    }
    const sources = map['sources'].map((source) => (typeof source === 'string' ? toStableSource(source, packageName) : source))
    writeFileContent(entry.path, stringify({ ...map, sources }))
  }
}
