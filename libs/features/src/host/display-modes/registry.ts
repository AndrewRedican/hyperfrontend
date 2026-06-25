import type { DisplayMode } from '../../shared/types'
import type { DisplayModeMount } from '../types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { mountDialog } from './dialog'
import { mountEmbedded } from './embedded'
import { mountPopup } from './popup'
import { mountStandalone } from './standalone'

// note: Replaces a display-modes/index.ts barrel, which no-unwanted-barrel-files forbids outside declared package entry points.

const MOUNTS = freeze(<Record<DisplayMode, DisplayModeMount>>{
  embedded: mountEmbedded,
  dialog: mountDialog,
  popup: mountPopup,
  standalone: mountStandalone,
})

/**
 * Selects the mount function for a display mode.
 *
 * @param mode - The display mode to resolve.
 * @returns The matching {@link DisplayModeMount}.
 *
 * @example Resolving the dialog mount
 * ```typescript
 * const mount = selectMount('dialog')
 * ```
 */
export function selectMount(mode: DisplayMode): DisplayModeMount {
  return MOUNTS[mode]
}
