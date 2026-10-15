import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The modules a run hands to Node by path rather than by import: the two preloads, the
 * reporter, and the main entry a replacement module reads the `jest` object from.
 */
export type RuntimeEntry = 'main' | 'hooks' | 'dom' | 'reporter'

/**
 * Where each entry sits relative to the directory of any other entry, without its
 * extension. The package keeps one directory per entry in both of its layouts, so an entry
 * can find its siblings by this offset wherever the package is run from.
 */
const ENTRY_OFFSETS: Record<RuntimeEntry, string> = {
  main: '../index',
  hooks: '../hooks/index',
  dom: '../dom/index',
  reporter: '../reporter/index',
}

/**
 * The extensions an entry is looked for under, in the order they are tried: the TypeScript
 * source in a checkout of the package, then the ES module the build emits beside it.
 */
const LAYOUT_EXTENSIONS: readonly string[] = ['.ts', '.mjs']

/**
 * Finds the file one of the package's entries is served from, next to the entry asking.
 *
 * The runner passes the preloads and the reporter to Node as file paths, and the preload
 * builds a replacement module that imports `jest` from the main entry by URL. Both have to
 * name a real file in whichever layout the package is run from: the source checkout, where
 * every entry is `index.ts`, or the published package, where it is `index.mjs`. The
 * directory is handed in rather than read here, because a build may hoist this module into
 * a shared chunk whose own location says nothing about where the entries are.
 *
 * @param entry - The entry wanted.
 * @param fromDirectory - Absolute directory of the entry asking, as its own module sees it.
 * @returns The absolute path of the entry's file.
 * @throws {Error} When no layout places the entry beside the asking directory.
 * @example Naming the preload for a `node --import` argument from inside the runner
 * ```ts
 * const hooks = locateRuntimeEntry('hooks', dirname(fileURLToPath(import.meta.url)))
 * // '/repo/libs/testing/src/hooks/index.ts' in a checkout, '.../hooks/index.mjs' once published
 * ```
 */
export function locateRuntimeEntry(entry: RuntimeEntry, fromDirectory: string): string {
  for (const extension of LAYOUT_EXTENSIONS) {
    const candidate = resolve(fromDirectory, `${ENTRY_OFFSETS[entry]}${extension}`)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(
    `@hyperfrontend/testing cannot find its ${entry} entry beside ${fromDirectory}; the package layout is not one the runtime knows`
  )
}
