/**
 * A bundle the build produces (`iife` or `umd` in `project.json`) is reachable: its entry is a
 * key of the manifest's `exports`.
 *
 * @module rules/workspace/lib-pkg-bundle-entry
 */

import { dirname } from 'node:path'
import { propertyOf } from '@hyperfrontend/linter/helpers'
import { manifestRule } from './shared/manifest-rule.ts'
import { readProjectFile } from './shared/project-file.ts'

/** One bundled output as declared. */
interface BundleFormat {
  /** The export key the bundle is built from. */
  readonly entry?: unknown
}

/** The build options the rule reads. */
interface BundleOptions {
  /** The IIFE bundle, when built. */
  readonly iife?: BundleFormat
  /** The UMD bundle, when built. */
  readonly umd?: BundleFormat
}

/** The build target as declared. */
interface BuildTarget {
  /** The executor options. */
  readonly options?: BundleOptions
}

/**
 * The bundle entries a project declares, each once.
 *
 * @param directory - The library's directory
 * @returns The entries in declaration order
 */
function bundleEntries(directory: string): string[] {
  const options = (readProjectFile(directory)?.targets?.['build'] as BuildTarget | undefined)?.options
  const entries: string[] = []
  for (const bundle of [options?.iife, options?.umd]) {
    if (typeof bundle?.entry === 'string' && bundle.entry !== '' && !entries.includes(bundle.entry)) entries.push(bundle.entry)
  }
  return entries
}

export default manifestRule('workspace/lib-pkg-bundle-entry', 'package.json', (root, context) => {
  const entries = bundleEntries(dirname(context.file.path))
  if (entries.length === 0) return
  const exports = propertyOf(root, 'exports')
  for (const entry of entries) {
    if (exports !== null && exports.value.kind === 'object' && propertyOf(exports.value, entry) !== null) continue
    context.report({
      start: exports === null ? 0 : exports.start,
      ...(exports === null ? {} : { end: exports.end }),
      message: `Bundle entry '${entry}' specified in project.json is not found in package.json exports. Add the export: "${entry}": "./path/to/entry.js"`,
    })
  }
})
