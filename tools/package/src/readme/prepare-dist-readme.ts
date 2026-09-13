import type { TransformOutcome } from './transform'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMediaCatalog } from './catalog'
import { transformReadme } from './transform'

/** The filename the readme is read from and written to. */
const README = 'README.md'

/** The directory under the workspace that holds the libraries, which the documentation site mirrors as slugs. */
const LIBRARIES_DIR = 'libs'

/** Everything the preparation needs to know about where things are. */
export interface PrepareDistReadmeOptions {
  /** Absolute path of the workspace root. */
  workspaceRoot: string
  /** Absolute path of the package's source directory. */
  projectRoot: string
  /** Absolute path of the package's build output. */
  outputPath: string
  /** Directory the recorder writes assets to, relative to the workspace root. */
  mediaRoot: string
  /** The URL that serves the media directory, with its trailing slash. */
  publicBaseUrl: string
  /** The URL under which each library's documentation lives, with its trailing slash. */
  docsBaseUrl: string
}

/** What the preparation did, for the build log. */
export interface PreparedDistReadme {
  /** Absolute path of the readme that was written. */
  path: string
  /** The transform's own account of what changed. */
  outcome: TransformOutcome
  /** The documentation landing page the visuals link to by default. */
  docsLanding: string
}

/**
 * The documentation slug of a package, from where it lives.
 *
 * The site addresses a library by its path under `libs/`, so a utility at
 * `libs/utils/data` is documented at `utils/data/` and a top-level library at
 * its own name. Reading it off the path rather than the name is what keeps
 * the two from drifting.
 *
 * @param workspaceRoot - Absolute path of the workspace root.
 * @param projectRoot - Absolute path of the package's source directory.
 * @returns The slug, with a trailing slash.
 * @throws {Error} When the package does not live under the libraries directory.
 */
function docsSlug(workspaceRoot: string, projectRoot: string): string {
  const parts = relative(workspaceRoot, projectRoot).split(sep)
  if (parts[0] !== LIBRARIES_DIR || parts.length < 2) {
    throw createError(`${projectRoot} is not under ${join(workspaceRoot, LIBRARIES_DIR)}, so its documentation URL cannot be derived`)
  }
  return `${parts.slice(1).join('/')}/`
}

/**
 * Write the distribution readme into the build output.
 *
 * The source readme is read from the package directory and never written to.
 * What lands in the output directory is the source with every marked region
 * replaced by the visual it names, which is what `npm pack` will pick up from
 * there; a source with no regions is written through unchanged. A readme that
 * cannot be transformed completely is not written at all: the copy the asset
 * phase left in the output is removed, so the output holds either the
 * finished readme or none, and a build that failed cannot be packed with a
 * half-done one.
 *
 * @param options - Where things are.
 * @returns What was written, or undefined when the package has no readme.
 * @throws {Error} When a directive cannot be read or names media that does not exist.
 * @example Preparing a library's readme after its build
 * ```ts
 * prepareDistReadme({
 *   workspaceRoot: '/repo',
 *   projectRoot: '/repo/libs/builder',
 *   outputPath: '/repo/dist/libs/builder',
 *   mediaRoot: 'assets/media',
 *   publicBaseUrl: 'https://www.hyperfrontend.dev/media/',
 *   docsBaseUrl: 'https://www.hyperfrontend.dev/docs/libraries/',
 * })
 * ```
 */
export function prepareDistReadme(options: PrepareDistReadmeOptions): PreparedDistReadme | undefined {
  const sourcePath = join(options.projectRoot, README)
  const targetPath = join(options.outputPath, README)
  if (!existsSync(sourcePath)) {
    return undefined
  }
  try {
    const docsLanding = `${options.docsBaseUrl}${docsSlug(options.workspaceRoot, options.projectRoot)}`
    const catalog = createMediaCatalog(join(options.workspaceRoot, options.mediaRoot), options.publicBaseUrl)
    const outcome = transformReadme(readFileSync(sourcePath, 'utf8'), { docsLanding, catalog })
    writeFileSync(targetPath, outcome.markdown)
    return { path: targetPath, outcome, docsLanding }
  } catch (cause) {
    rmSync(targetPath, { force: true })
    // why: everything this calls throws an Error, so the plain-text arm is for a throw that is not one and is never taken here
    /* node:coverage ignore next 1 */
    throw createError(`Could not prepare ${targetPath}: ${cause instanceof Error ? cause.message : `${cause}`}`)
  }
}
