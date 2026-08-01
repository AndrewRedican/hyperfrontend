import type { DisplayMode, ResolvedFeatureConfig } from '../../shared/types'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { DisplayMode as Modes } from '../../shared/types'

/**
 * Resolves the display modes a feature's build composes into its shell.
 *
 * A config that declares `display.modes` gets exactly those; one that does not
 * gets every built-in mode. Both the shell generator and the metadata stamp
 * resolve through here so the composed code and the disclosed capability list
 * can never disagree.
 *
 * @param config - The resolved feature config.
 * @returns The declared modes, in declaration order.
 *
 * @example Resolving an undeclared config
 * ```typescript
 * resolveDeclaredModes({ name: 'clock', version: '1.0.0', contract: './c.json', url: '/' })
 * // => ['embedded', 'dialog', 'popup', 'standalone']
 * ```
 */
export function resolveDeclaredModes(config: ResolvedFeatureConfig): DisplayMode[] {
  return config.display?.modes ?? values(Modes)
}
