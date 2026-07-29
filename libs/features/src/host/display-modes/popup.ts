import type { DisplayModeMount } from '../types'
import { alignOffset, resolveBoxPosition } from '../../shared/presentation'
import { DisplayMode } from '../../shared/types'
import { resolvePopupDefaults } from './defaults'
import { assertNoSandbox, openExternalWindow } from './external-window'

/**
 * Mounts a feature in a separate, sized browser popup window.
 *
 * The window opens at the agreed `popupWidth`/`popupHeight` (falling back to a
 * viewport-derived size), placed on the screen per `popupPosition` — centered
 * by default. Once open, the window is the browser's: the user may move and
 * resize it freely, the feature's own window is its viewport (no viewport
 * reports cross the boundary), and no sandbox or permissions delegation can
 * apply to a top-level window. The window's title and chrome belong to the
 * loaded document and the browser — the feature sets `document.title`; the
 * host cannot.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @returns The popup window, the presentation announcement, and a teardown that closes it.
 *
 * @example Mounting a popup
 * ```typescript
 * const { target, cleanup } = mountPopup({ options, requestClose })
 * ```
 */
export const mountPopup: DisplayModeMount = ({ options }) => {
  assertNoSandbox(options.sandbox, 'popup')
  const defaults = resolvePopupDefaults()
  const width = options.popupWidth ?? defaults.width
  const height = options.popupHeight ?? defaults.height
  const position = resolveBoxPosition(options.popupPosition)
  const area = window.screen
  // why: Placement needs a measurable screen; without one the browser's own default placement beats guessing offsets against zero.
  const placement =
    area && area.availWidth > 0 && area.availHeight > 0
      ? `,left=${alignOffset(position.horizontal, area.availWidth, width)},top=${alignOffset(position.vertical, area.availHeight, height)}`
      : ''
  return {
    ...openExternalWindow(options.url ?? '', `width=${width},height=${height},scrollbars=no${placement}`),
    present: { mode: DisplayMode.Popup },
  }
}
