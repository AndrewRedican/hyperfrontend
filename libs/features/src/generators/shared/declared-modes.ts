import type { DisplayMode, ResolvedFeatureConfig } from '../../shared/types'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { keepsWindowedModes, WINDOWED_DISPLAY_MODES } from '../../shared/isolation'
import { DisplayMode as Modes } from '../../shared/types'

/**
 * Resolves the display modes a feature's build composes into its shell.
 *
 * A config that declares `display.modes` gets exactly those; one that does not
 * gets every built-in mode its origin can serve. A feature declaring
 * cross-origin isolation drops the windowed modes from that default, because an
 * isolated origin severs the opener of any window a cross-origin host opens
 * onto it, so composing them would ship a presentation that can never connect.
 * Both the shell generator and the metadata stamp resolve through here so the
 * composed code and the disclosed capability list can never disagree.
 *
 * @param config - The resolved feature config.
 * @returns The declared modes, in declaration order.
 *
 * @example Resolving an undeclared config
 * ```typescript
 * resolveDeclaredModes({ name: 'clock', version: '1.0.0', contract: './c.json', url: '/' })
 * // => ['embedded', 'dialog', 'popup', 'standalone']
 * ```
 *
 * @example Resolving an undeclared config on an isolated origin
 * ```typescript
 * resolveDeclaredModes({ name: 'pond', version: '1.0.0', contract: './c.json', url: '/', isolation: 'require-corp' })
 * // => ['embedded', 'dialog']
 * ```
 */
export function resolveDeclaredModes(config: ResolvedFeatureConfig): DisplayMode[] {
  if (config.display?.modes !== undefined) {
    return config.display.modes
  }
  const all = values(Modes)
  return keepsWindowedModes(config.isolation) ? all : all.filter((mode) => !WINDOWED_DISPLAY_MODES.includes(mode))
}
