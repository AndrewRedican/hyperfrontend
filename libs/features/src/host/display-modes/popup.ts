import type { DisplayModeMount } from '../types'
import { dialogDefaults } from './defaults'
import { assertNoSandbox, openExternalWindow } from './external-window'

/**
 * Mounts a feature in a separate, dialog-sized browser popup window.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @returns The popup window and a teardown that closes it.
 *
 * @example Mounting a popup
 * ```typescript
 * const { target, cleanup } = mountPopup({ options, requestClose })
 * ```
 */
export const mountPopup: DisplayModeMount = ({ options }) => {
  assertNoSandbox(options.sandbox, 'popup')
  const width = options.dialogWidth ?? dialogDefaults.width
  const height = options.dialogHeight ?? dialogDefaults.height
  return openExternalWindow(options.url ?? '', `width=${width},height=${height},scrollbars=no`)
}
