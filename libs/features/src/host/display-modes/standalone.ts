import type { DisplayModeMount } from '../types'
import { assertNoSandbox, openExternalWindow } from './external-window'

/**
 * Mounts a feature in a full standalone browser tab/window.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @returns The opened window and a teardown that closes it.
 *
 * @example Mounting standalone
 * ```typescript
 * const { target, cleanup } = mountStandalone({ options, requestClose })
 * ```
 */
export const mountStandalone: DisplayModeMount = ({ options }) => {
  assertNoSandbox(options.sandbox, 'standalone')
  return openExternalWindow(options.url ?? '')
}
