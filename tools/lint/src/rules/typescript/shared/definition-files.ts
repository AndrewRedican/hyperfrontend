/**
 * Whether a file is a declaration file, whose top-level declarations describe existing code
 * and are exported ambiently rather than through `export`.
 *
 * @module rules/typescript/shared/definition-files
 */

/** The extensions that end a declaration file outright. */
const DECLARATION_EXTENSIONS = ['.d.ts', '.d.cts', '.d.mts']

/**
 * Whether a path names a declaration file: one ending in `.d.ts`, `.d.cts` or `.d.mts`, or one
 * carrying a `.d.` segment before its final `.ts`, as `shims.d.vue.ts` does, in any letter case.
 *
 * @param path - Where the linted text lives, absolute or relative
 * @returns Whether the compiler reads the file as declarations
 */
export function isDefinitionFile(path: string): boolean {
  const lower = path.toLowerCase()
  if (DECLARATION_EXTENSIONS.some((extension) => lower.endsWith(extension))) return true
  return lower.endsWith('.ts') && lower.includes('.d.')
}
