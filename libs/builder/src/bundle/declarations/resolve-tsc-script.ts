import { createRequire } from 'node:module'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { join } from '@hyperfrontend/project-scope/core/path'

/** The compiler's own entry script, as a module specifier. */
const TSC_SCRIPT = 'typescript/bin/tsc'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const MODULE_DIRECTORY = typeof __dirname === 'string' ? __dirname : import.meta.dirname

/**
 * The compiler's entry script as Node resolves it from one directory, or null.
 *
 * @param directory - Absolute directory the lookup climbs from.
 * @returns Absolute path of the script, or null when nothing above the directory resolves it.
 */
const tscScriptFrom = (directory: string): string | null => {
  try {
    return createRequire(join(directory, 'package.json')).resolve(TSC_SCRIPT)
  } catch {
    return null
  }
}

/**
 * Resolves the entry script of the TypeScript compiler the declarations run on.
 *
 * The lookup climbs from this module first, so the TypeScript the builder itself depends on is
 * found wherever npm placed it, nested beside the package or hoisted above it, and only then
 * from the workspace root. A TypeScript the workspace installed that ships no `tsc` script
 * (7 and later) therefore does not stand in the way. Either way the result is the JavaScript
 * file itself rather than the platform-specific launcher npm writes into `node_modules/.bin`,
 * so running it with the Node binary works the same on every operating system and needs no shell.
 *
 * @param workspaceRoot - Absolute path of the workspace whose TypeScript install is the fallback.
 * @param moduleDirectory - Absolute directory the lookup climbs from first; this module's own when omitted.
 * @returns Absolute path of the `tsc` entry script.
 * @throws {Error} When neither the builder's own installation nor the workspace resolves the script.
 *
 * @example Running the compiler without a shell
 * ```typescript
 * const tscScript = resolveTscScript('/abs/repo')
 * spawn(process.execPath, [tscScript, '--version'])
 * ```
 */
export const resolveTscScript = (workspaceRoot: string, moduleDirectory: string = MODULE_DIRECTORY): string => {
  const script = tscScriptFrom(moduleDirectory) ?? tscScriptFrom(workspaceRoot)
  if (script === null)
    throw createError(
      `Cannot resolve ${TSC_SCRIPT} beside the builder (${moduleDirectory}) or from ${workspaceRoot}: run npm install, or install typescript 5 at the workspace root; TypeScript 7 ships no tsc script`
    )
  return script
}
