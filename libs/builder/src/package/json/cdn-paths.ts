import type { FormatOutputs } from '../../models'

/**
 * Resolved CDN paths for `unpkg` and `jsdelivr` package.json fields.
 */
export interface CdnPaths {
  /** Path advertised on the `unpkg` field. */
  unpkg: string
  /** Path advertised on the `jsdelivr` field. */
  jsdelivr: string
}

/**
 * Optional overrides accepted by {@link getCdnPaths}.
 */
export interface CdnPathOverrides {
  /** Explicit path for the `unpkg` field. */
  unpkg?: string
  /** Explicit path for the `jsdelivr` field. */
  jsdelivr?: string
}

/**
 * Computes the CDN entry paths advertised on the published `package.json`.
 *
 * Priority order:
 * 1. Explicit `opts.unpkg` / `opts.jsdelivr` overrides win for their respective field.
 * 2. The first UMD bundle, when one was emitted, supplies the default path.
 * 3. The first IIFE bundle is used when no UMD bundle exists.
 * 4. When no UMD or IIFE bundles were produced, returns `undefined` so callers can
 *    skip emitting the fields entirely.
 *
 * @param formatOutputs - Aggregated bundle-phase output.
 * @param opts - Optional explicit overrides for either CDN field.
 * @returns Resolved CDN paths or `undefined` when no CDN-eligible bundle was produced.
 *
 * @example Resolving CDN paths from a UMD-only build
 * ```typescript
 * const cdn = getCdnPaths(formatOutputs)
 * // → { unpkg: './bundle/index.umd.min.js', jsdelivr: './bundle/index.umd.min.js' }
 * ```
 */
export const getCdnPaths = (formatOutputs: FormatOutputs, opts?: CdnPathOverrides): CdnPaths | undefined => {
  const umd = formatOutputs.umd[0]
  const iife = formatOutputs.iife[0]
  if (!umd && !iife) return undefined

  const defaultPath = umd
    ? `./${umd.config.output ?? 'bundle'}/index.umd.min.js`
    : `./${(<NonNullable<typeof iife>>iife).config.output ?? 'bundle'}/index.iife.min.js`

  return { unpkg: opts?.unpkg ?? defaultPath, jsdelivr: opts?.jsdelivr ?? defaultPath }
}
