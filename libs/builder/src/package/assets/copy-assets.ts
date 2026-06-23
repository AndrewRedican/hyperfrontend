import type { AssetSpec, PackageJson } from '../../models'
import { copyFileSync } from 'node:fs'
import { logger } from '@hyperfrontend/logging'
import {
  ensureDir,
  exists,
  getDirname,
  isFile,
  join,
  matchGlobPattern,
  readDirectoryRecursive,
  relativePath,
} from '@hyperfrontend/project-scope/core'

const log = logger.channel('builder:package:assets')

const resolveTargetDir = (outputPath: string, to?: string): string => (!to || to === '.' ? outputPath : join(outputPath, to))

const collectFromFiles = (from: string, files: string[]): string[] => {
  const collected: string[] = []
  for (const file of files) {
    const srcFile = join(from, file)
    if (exists(srcFile) && isFile(srcFile)) collected.push(file)
  }
  return collected
}

const collectFromGlob = (from: string, pattern: string): string[] => {
  const collected: string[] = []
  for (const entry of readDirectoryRecursive(from)) {
    if (!entry.isFile) continue
    const rel = relativePath(from, entry.path)
    if (matchGlobPattern(rel, pattern)) collected.push(rel)
  }
  return collected
}

const collectAssetFiles = (spec: AssetSpec): string[] => {
  if (spec.files) return collectFromFiles(spec.from, spec.files)
  if (spec.glob) return collectFromGlob(spec.from, spec.glob)
  return []
}

/**
 * Copies one or more asset specs into the build output directory.
 *
 * Each spec selects its inputs in one of two ways:
 * - `spec.files`: explicit list of relative paths under `spec.from`. Missing entries
 *   are silently skipped.
 * - `spec.glob`: POSIX-style glob evaluated relative to `spec.from`.
 *
 * The destination is `<outputPath>/<spec.to>`, defaulting to the dist root when
 * `spec.to` is omitted or equal to `'.'`. Specs whose `condition` predicate returns
 * `false` are skipped entirely.
 *
 * @param specs - Asset specifications to materialize.
 * @param outputPath - Absolute path to the build output directory.
 * @param srcPkg - Source `package.json`, supplied to each spec's `condition` predicate.
 *
 * @example Copying README + LICENSE into the dist root
 * ```typescript
 * copyAssets(
 *   [
 *     { from: '/abs/libs/foo', files: ['README.md', 'CHANGELOG.md'] },
 *     { from: '/abs/repo', files: ['LICENSE.md', 'SECURITY.md'] },
 *   ],
 *   '/abs/dist/libs/foo',
 *   srcPkg
 * )
 * ```
 */
export const copyAssets = (specs: AssetSpec[], outputPath: string, srcPkg: PackageJson): void => {
  for (const spec of specs) {
    if (spec.condition && !spec.condition(srcPkg)) continue
    if (!exists(spec.from)) {
      log.debug(`asset source missing, skipping: ${spec.from}`)
      continue
    }

    const target = resolveTargetDir(outputPath, spec.to)
    const files = collectAssetFiles(spec)

    for (const file of files) {
      const srcPath = join(spec.from, file)
      const destPath = join(target, file)
      ensureDir(getDirname(destPath))
      copyFileSync(srcPath, destPath)
      log.debug(`copied ${file}`)
    }
  }
}
