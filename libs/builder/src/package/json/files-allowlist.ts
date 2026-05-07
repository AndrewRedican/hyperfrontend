import type { BinConfig, BinScriptFormat, BuildContext } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Standard top-level metadata files always included in the published tarball.
 *
 * Hard-coded because npm conventions for these names are stable and the files
 * either exist (and ship) or don't (and the entry harmlessly resolves nothing).
 */
const STANDARD_METADATA_FILES = ['FUNDING.md', 'LICENSE.md', 'README.md', 'SECURITY.md', 'THIRD_PARTY_LICENSES.md']

const normalizeFormats = (format: BinConfig['format']): BinScriptFormat[] => (isArray(format) ? format : [format])

const topLevelSegmentOf = (srcPath: string): string => <string>srcPath.split('/')[0]
const secondSegmentOf = (srcPath: string): string | undefined => srcPath.split('/')[1]

const collectBinScriptFiles = (bins: BinConfig[]): string[] => {
  const files: string[] = []
  for (const bin of bins) {
    const formats = normalizeFormats(bin.format)
    if (formats.length === 0) continue
    if (formats.includes('cjs')) {
      const cjsFile = formats.length === 1 && formats[0] === 'cjs' ? `bin/${bin.name}.js` : `bin/${bin.name}.cjs.js`
      files.push(cjsFile)
    }
    if (formats.includes('esm')) {
      files.push(`bin/${bin.name}.mjs`)
    }
    files.push(`bin/${bin.name}.d.ts`)
  }
  return files
}

/**
 * Computes the default `package.json#files` allowlist for a build.
 *
 * Derived programmatically from `ctx.entryPointDiscovery` plus the bin
 * declarations so the allowlist tracks new top-level entry directories
 * without hand-editing the project config.
 *
 * Behavior:
 * - Top-level entry directories surface as `<dir>/` patterns.
 * - The root entry (`src/index.ts`) adds `index.*` and `index.d.ts`.
 * - `bin/` is **never** included as a wildcard — it co-locates the JS bin
 *   scripts with the per-platform SEA binaries that must NOT ship in the
 *   main tarball. Sub-entries of `bin/` (e.g., `bin/script/`, `bin/native/`)
 *   are included individually; the JS bin script files are added per-bin.
 * - `_dependencies/` is included when `ctx.bundledDeps` is non-empty.
 * - Standard top-level metadata files (README, LICENSE, etc.) are always
 *   listed.
 *
 * @param ctx - Resolved build context.
 * @param bins - Bin declarations being synthesized.
 * @returns Sorted list of allowlist entries suitable for `package.json#files`.
 *
 * @example Computing the allowlist for a typical multi-entry library
 * ```typescript
 * const files = computeDefaultFilesAllowlist(ctx, [{ name: 'hf-build', format: ['cjs'] }])
 * ```
 */
export const computeDefaultFilesAllowlist = (ctx: BuildContext, bins: BinConfig[]): string[] => {
  const allow = createSet<string>()

  if (ctx.bundledDeps.length > 0) allow.add('_dependencies/')

  const topLevelDirs = createSet<string>()
  const binSubDirs = createSet<string>()
  let hasRootEntry = false
  let hasBinEntry = false

  for (const entry of ctx.entryPointDiscovery.entryPoints) {
    if (entry.srcPath === '') {
      hasRootEntry = true
      continue
    }
    const top = topLevelSegmentOf(entry.srcPath)
    if (top === 'bin') {
      const second = secondSegmentOf(entry.srcPath)
      if (second === undefined) {
        hasBinEntry = true
      } else {
        binSubDirs.add(`bin/${second}/`)
      }
      continue
    }
    topLevelDirs.add(`${top}/`)
  }

  if (hasRootEntry) {
    allow.add('index.*')
    allow.add('index.d.ts')
  }
  if (hasBinEntry) {
    allow.add('bin/index.*')
    allow.add('bin/index.d.ts')
  }
  for (const dir of topLevelDirs) allow.add(dir)
  for (const dir of binSubDirs) allow.add(dir)
  for (const file of collectBinScriptFiles(bins)) allow.add(file)
  for (const file of STANDARD_METADATA_FILES) allow.add(file)

  return [...allow].sort()
}
