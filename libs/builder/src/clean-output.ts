import type { BuildContext, PackageJson } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import {
  createDirectory,
  exists,
  isDirectory,
  join,
  readDirectory,
  readJsonFileIfExists,
  removeDirectory,
  writeJsonFile,
} from '@hyperfrontend/project-scope/core'
import { isWithinRoot } from '@hyperfrontend/project-scope/core/path'
import { SOURCE_DIR } from './bundle/entries/discover-entries'

/**
 * Refuses an `outputPath` that would take the build's own inputs with it: the
 * project's source tree, its `package.json`, or the tsconfig the declaration
 * pass reads. Emitting into one of those overwrites what the build reads from,
 * and cleaning one destroys it, so the check holds whether or not the clean
 * step runs.
 *
 * @param context - Resolved build context supplying `outputPath`, `projectRoot` and `tsConfigPath`.
 * @throws {Error} When `outputPath` contains, equals, or sits inside one of the build's inputs.
 *
 * @example Validating a context before any phase touches the output
 * ```typescript
 * assertOutputPathClearOfInputs(context) // throws for outputPath: '<projectRoot>/src'
 * ```
 */
export const assertOutputPathClearOfInputs = (context: BuildContext): void => {
  const { outputPath, projectRoot, tsConfigPath } = context
  const inputs = [join(projectRoot, SOURCE_DIR), join(projectRoot, 'package.json'), tsConfigPath]
  const overlapping = inputs.find((input) => isWithinRoot(outputPath, input) || isWithinRoot(input, outputPath))
  if (overlapping !== undefined) {
    throw createError(
      `build: refusing outputPath "${outputPath}" — it overlaps the build's own input "${overlapping}". Point outputPath at a directory that holds only build output.`
    )
  }
}

/**
 * Reads the package name a directory's manifest declares.
 *
 * @param dir - Directory that may hold a `package.json`.
 * @returns The declared name, or `null` when there is no manifest or it names nothing.
 */
const readPackageName = (dir: string): string | null => readJsonFileIfExists<PackageJson>(join(dir, 'package.json'))?.name ?? null

/**
 * Empties a build's own output directory before emission so a build never
 * inherits stale artifacts from a previous run, e.g. a `*.js.map` left behind
 * after sourcemaps were turned off, or a chunk for a since-renamed entry.
 *
 * The directory is judged by what it holds, not by where it sits: it is
 * removed only when it is empty or holds a previous build of this package,
 * recognised by a `package.json` naming the package. A directory holding
 * anything else is refused, whether that is the workspace root, a shared
 * `dist/` holding other projects, a sibling package's output, or a tree the
 * builder never wrote. That leaves every layout open (a shared `dist/` beside
 * the workspace, a standalone project's own `dist/`) without the risk of
 * emptying something another tool or project owns. A missing directory is
 * created.
 *
 * The directory is then stamped with a minimal manifest carrying the package
 * name, so a build interrupted before the package phase writes the real one
 * still leaves an output the next build recognises as its own.
 *
 * @param context - Resolved build context supplying `outputPath` and `projectRoot`.
 * @throws {Error} When `outputPath` is a file, or a directory holding files
 * that are not a previous build of this package.
 *
 * @example Cleaning a library's output before the bundle phase
 * ```typescript
 * cleanOutputPath(context) // removes dist/<project>, leaves the rest of dist/ intact
 * ```
 */
export const cleanOutputPath = (context: BuildContext): void => {
  const { outputPath, projectRoot } = context
  const packageName = readPackageName(projectRoot)
  if (exists(outputPath)) {
    if (!isDirectory(outputPath)) {
      throw createError(`build: refusing outputPath "${outputPath}" — it is a file, and the build needs a directory.`)
    }
    if (readDirectory(outputPath).length > 0) {
      // why: a previous build of this package is the only content a clean may remove; its manifest carries the package name, and nothing else the builder could find there is attributable to it.
      if (packageName === null || readPackageName(outputPath) !== packageName) {
        const owner = packageName === null ? 'this package, whose package.json declares no name' : `"${packageName}"`
        throw createError(
          `build: refusing to clean outputPath "${outputPath}" — it holds files this build did not write. Only an empty directory or a previous build of ${owner} is cleaned; point outputPath elsewhere, or remove the directory yourself.`
        )
      }
      removeDirectory(outputPath, { recursive: true, force: true })
    }
  }
  createDirectory(outputPath, { recursive: true })
  // why: the manifest the package phase writes is what marks an output as this package's own; stamping a minimal one now means a build interrupted before that phase still leaves a directory the next build may clean.
  if (packageName !== null) writeJsonFile(join(outputPath, 'package.json'), { name: packageName })
}
