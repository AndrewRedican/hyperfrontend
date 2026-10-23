/**
 * The files named on the command line. A path names a file explicitly; a directory names every
 * file under it; a pattern with glob characters names the files under the working directory it
 * matches. Explicitly named files are reported on even when the configuration ignores them,
 * which is how the linter answers for a file it was asked about; walked and matched files are
 * silently left out when ignored. The walk never enters `node_modules` or `.git`.
 *
 * @module files/enumerate
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { compileGlob } from './glob'

/** One file the command line named. */
export interface EnumeratedFile {
  /** The absolute path. */
  readonly path: string
  /** True when the file itself was named, false when a directory or pattern found it. */
  readonly explicit: boolean
}

/** What the command line named. */
export interface Enumeration {
  /** The files, sorted by path, each once; a file named explicitly stays explicit. */
  readonly files: readonly EnumeratedFile[]
  /** The arguments that named nothing on disk. */
  readonly unmatched: readonly string[]
}

/** Directories never entered. */
const UNWALKED = ['node_modules', '.git']

/**
 * Lists the files the arguments name.
 *
 * @param patterns - Paths relative to `cwd` or absolute, or glob patterns relative to `cwd`
 * @param cwd - The directory the paths and patterns are relative to
 * @returns The files and the arguments that matched nothing
 *
 * @example Name a directory, a file and a pattern that matches nothing
 * ```ts
 * // project/ holds README.md, src/index.ts and src/util/math.ts
 * const patterns = ['src', 'README.md', 'docs/*.md']
 * const { files, unmatched } = enumerateFiles(patterns, '/project')
 * files.map((file) => [file.path, file.explicit])
 * // => [['/project/README.md', true],
 * //     ['/project/src/index.ts', false],
 * //     ['/project/src/util/math.ts', false]]
 * unmatched // => ['docs/*.md']
 * ```
 */
export function enumerateFiles(patterns: readonly string[], cwd: string): Enumeration {
  const files = createMap<string, boolean>()
  const unmatched: string[] = []
  const add = (path: string, explicit: boolean): void => {
    files.set(path, (files.get(path) ?? false) || explicit)
  }
  for (const pattern of patterns) {
    if (/[*?[{]/.test(pattern)) {
      const glob = compileGlob(pattern)
      const matched = walk(cwd).filter((path) => glob.test(relative(cwd, path).split(sep).join(posix.sep)))
      if (matched.length === 0) unmatched.push(pattern)
      for (const path of matched) add(path, false)
      continue
    }
    const path = resolve(cwd, pattern)
    if (!existsSync(path)) {
      unmatched.push(pattern)
      continue
    }
    if (statSync(path).isDirectory()) for (const found of walk(path)) add(found, false)
    else add(path, true)
  }
  return {
    files: [...files].map(([path, explicit]) => ({ path, explicit })).sort((a, b) => (a.path < b.path ? -1 : 1)),
    unmatched,
  }
}

/**
 * Every file under a directory.
 *
 * @param directory - An absolute directory
 * @returns Absolute paths in walk order
 */
function walk(directory: string): string[] {
  const found: string[] = []
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!UNWALKED.includes(entry.name)) visit(join(current, entry.name))
      } else if (entry.isFile()) {
        found.push(join(current, entry.name))
      }
    }
  }
  visit(directory)
  return found
}
