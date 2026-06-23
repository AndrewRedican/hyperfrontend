import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Verifies that every external dependency declared for an IIFE / UMD bundle
 * has a corresponding entry in the supplied `globals` map.
 *
 * Throws an aggregated error listing the missing entries when the configuration
 * is incomplete; resolves silently otherwise.
 *
 * @param external - Package names declared as external for the bundle.
 * @param globals - Mapping of package name to global variable name.
 * @throws {Error} When at least one external dependency is missing from `globals`.
 *
 * @example Failing fast when a globals mapping is missing
 * ```typescript
 * validateExternalsConfig(['react'], { 'react-dom': 'ReactDOM' })
 * // => throws: Missing globals mapping for external dependencies: react
 * ```
 */
export const validateExternalsConfig = (external: string[] | undefined, globals: Record<string, string> | undefined): void => {
  if (!external || external.length === 0) return
  const missing = external.filter((dep) => !globals?.[dep])
  if (missing.length === 0) return
  throw createError(
    `Missing globals mapping for external dependencies:\n${missing.map((d) => `  - ${d}`).join('\n')}\nAdd a globals entry or remove the package from the external list to inline it.`
  )
}
