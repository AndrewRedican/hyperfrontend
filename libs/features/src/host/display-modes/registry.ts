import type { DisplayMode } from '../../shared/types'
import type { DisplayModeMount } from '../types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { mountDialog } from './dialog'
import { mountEmbedded } from './embedded'
import { mountPopup } from './popup'
import { mountStandalone } from './standalone'

// note: Replaces a display-modes/index.ts barrel, which no-unwanted-barrel-files forbids outside declared package entry points.

/**
 * Every built-in display mode, mode name to mount function.
 *
 * `createShell` composes a shell from this full map; generated shells import
 * the individual mounts and compose only the modes their feature declared, so
 * this map (and the modes it would drag in) stays out of their bundles.
 */
export const builtInDisplayModes: Readonly<Record<DisplayMode, DisplayModeMount>> = freeze(<Record<DisplayMode, DisplayModeMount>>{
  embedded: mountEmbedded,
  dialog: mountDialog,
  popup: mountPopup,
  standalone: mountStandalone,
})
