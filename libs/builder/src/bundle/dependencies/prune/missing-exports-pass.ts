import type { BuildContext } from '../../../models'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, getDirname, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { synthesizeMissingNamedExports } from './missing-exports'
import { collectEntryFiles, walkFiles } from './orphan-chunks'
import { collectImportEdges } from './used-exports'

/**
 * Aggregate result of the missing-export synthesis pass.
 */
export interface MissingExportsPassResult {
  /** Named exports appended onto CJS-interop ESM wrappers across all chunks. */
  namedExportsSynthesized: number
}

/**
 * Reconciles every ESM `_dependencies/` chunk's export surface with the named
 * bindings its importers actually demand, appending interop-backed named
 * exports where a CJS-wrapped dependency only emitted a default.
 *
 * Demand is the union of the concrete named-import sets each importer (entry
 * bundles plus sibling chunks) declares against a chunk; wholesale
 * namespace / default demand contributes nothing, because those bindings link
 * against any surface. Runs before the dead-export strip so the interop default
 * declaration the synthesized bindings read from is still present; the strip
 * then keeps it alive through the new references. CJS chunks need no
 * counterpart pass: `require` resolves member access at runtime.
 *
 * @param context - Resolved build context supplying the entry points.
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Count of synthesized named exports.
 *
 * @example Running the synthesis before the dead-export strip
 * ```typescript
 * const { namedExportsSynthesized } = synthesizeMissingExportsPass(context, depsRootOf(context))
 * ```
 */
export const synthesizeMissingExportsPass = (context: BuildContext, depsRoot: string): MissingExportsPassResult => {
  const result: MissingExportsPassResult = { namedExportsSynthesized: 0 }
  if (!exists(depsRoot)) return result
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === 'index.esm.js', chunks)
  if (chunks.length === 0) return result
  const demand = createMap<string, Set<string>>()
  for (const chunk of chunks) demand.set(chunk, createSet<string>([]))
  for (const importer of [...collectEntryFiles(context, depsRoot, ['index.esm.js']), ...chunks]) {
    for (const [target, usage] of collectImportEdges(readFileContent(importer), getDirname(importer), 'esm')) {
      const named = demand.get(target)
      if (named === undefined || usage === 'all') continue
      for (const name of usage) named.add(name)
    }
  }
  for (const [chunk, names] of demand) {
    const synthesized = synthesizeMissingNamedExports(readFileContent(chunk), names)
    if (synthesized === null) continue
    writeFileContent(chunk, synthesized.code)
    result.namedExportsSynthesized += synthesized.synthesizedNames.length
  }
  return result
}
