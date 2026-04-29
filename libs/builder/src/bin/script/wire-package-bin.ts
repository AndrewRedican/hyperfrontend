import type { BinOutput, PackageJson } from '../../models'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { relativePath } from '@hyperfrontend/project-scope/core'

const KIND_PRIORITY: Record<BinOutput['kind'], number> = { cjs: 0, esm: 1, native: 2 }

const isJsBin = (output: BinOutput): boolean => output.kind === 'cjs' || output.kind === 'esm'

const pickPreferredOutput = (outputs: BinOutput[]): BinOutput => {
  let best = outputs[0]
  for (const candidate of outputs) {
    if (KIND_PRIORITY[candidate.kind] < KIND_PRIORITY[best.kind]) best = candidate
  }
  return best
}

const groupByName = (outputs: BinOutput[]): Map<string, BinOutput[]> => {
  const grouped = createMap<string, BinOutput[]>()
  for (const output of outputs) {
    if (!isJsBin(output)) continue
    const bucket = grouped.get(output.name) ?? []
    bucket.push(output)
    grouped.set(output.name, bucket)
  }
  return grouped
}

const toRelativeBinPath = (outputRoot: string, absolutePath: string): string => {
  const rel = relativePath(outputRoot, absolutePath)
  return rel.startsWith('.') ? rel : `./${rel}`
}

/**
 * Mutates `pkg.bin` to map every JS bin name produced by the build to its relative
 * output path inside the dist root.
 *
 * For names with multiple outputs, CJS is preferred over ESM for compat with the
 * widest range of npm consumers. Native binaries are intentionally ignored — they are
 * shipped as separate release artifacts, not via `package.json#bin`.
 *
 * Existing entries on `pkg.bin` for names not present in `binOutputs` are preserved.
 *
 * @param pkg - Package manifest to mutate. The `bin` field is replaced with a normalized object.
 * @param binOutputs - Outputs collected from the bin phase.
 * @param outputRoot - Absolute path to the dist root used to compute the relative paths.
 *
 * @example Wiring CJS bin outputs into a package manifest
 * ```typescript
 * wireBinFieldInPackageJson(
 *   pkg,
 *   [{ name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/hf-build.cjs.js' }],
 *   '/abs/dist/libs/builder'
 * )
 * // pkg.bin === { 'hf-build': './bin/hf-build.cjs.js' }
 * ```
 */
export const wireBinFieldInPackageJson = (pkg: PackageJson, binOutputs: BinOutput[], outputRoot: string): void => {
  const grouped = groupByName(binOutputs)
  if (grouped.size === 0) return

  const existing = typeof pkg.bin === 'object' && pkg.bin !== null ? { ...pkg.bin } : {}
  const next: Record<string, string> = { ...existing }

  for (const [name, outputs] of grouped) {
    const preferred = pickPreferredOutput(outputs)
    next[name] = toRelativeBinPath(outputRoot, preferred.outputPath)
  }

  pkg.bin = next
}
