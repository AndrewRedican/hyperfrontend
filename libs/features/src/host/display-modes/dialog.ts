import type { DialogBoxSize, PresentPayload } from '../../shared/presentation'
import type { ShellOptions } from '../../shared/types'
import type { DisplayModeMount } from '../types'
import { DisplayMode } from '../../shared/types'
import { createFeatureIframe } from '../iframe'
import { createObserverReporter } from '../sizing'

// note: The pane carries no host-drawn visuals — the feature draws the dialog box and backdrop inside it, so an opaque background or a host-side close button here would fight the feature's own design.

/**
 * Builds the presentation announcement for a dialog mount, carrying the
 * pane's dimensions and any agreed inner dialog box geometry for the feature
 * side to apply.
 *
 * @param options - The merged shell options.
 * @returns The present payload.
 */
function buildDialogPresent(options: ShellOptions): PresentPayload {
  const { dialogWidth, dialogHeight, dialogPosition } = options
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  if (dialogWidth === undefined && dialogHeight === undefined && dialogPosition === undefined) {
    return { mode: DisplayMode.Dialog, viewport }
  }
  const dialog: DialogBoxSize = {
    ...(dialogWidth !== undefined && { width: dialogWidth }),
    ...(dialogHeight !== undefined && { height: dialogHeight }),
    ...(dialogPosition !== undefined && { position: dialogPosition }),
  }
  return { mode: DisplayMode.Dialog, viewport, dialog }
}

/**
 * Mounts a feature as a full-viewport dialog pane layered above the host UI.
 *
 * The pane is a single transparent iframe spanning the host viewport; the
 * feature renders its dialog box inside it and the transparent remainder is the
 * backdrop. It mounts hidden — inert to the user and the page — and is
 * revealed once the session opens. Backdrop and in-frame Escape interactions
 * are detected by the feature side and cross as dismiss signals the shell acts
 * on per `dialogBackdrop`/`closeOnEscape`; an Escape pressed while the host
 * document holds focus is handled here directly.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @param context.requestClose - Requests the shell close itself.
 * @returns The iframe content window, the pane as the mounted element, the presentation announcement, the viewport reporter, and the reveal/teardown hooks.
 *
 * @example Mounting a dialog
 * ```typescript
 * const { target, cleanup } = mountDialog({ options, requestClose })
 * ```
 */
export const mountDialog: DisplayModeMount = ({ options, requestClose }) => {
  const iframe = createFeatureIframe(options.url ?? '', options)
  iframe.style.position = 'fixed'
  iframe.style.inset = '0'
  iframe.style.zIndex = '2147483647'
  document.body.appendChild(iframe)

  const escapeEnabled = options.closeOnEscape !== false
  const onKeydown = (event: KeyboardEvent) => {
    if (escapeEnabled && event.key === 'Escape') {
      requestClose()
    }
  }
  document.addEventListener('keydown', onKeydown)

  const present = buildDialogPresent(options)
  const viewport = createObserverReporter(iframe, { width: window.innerWidth, height: window.innerHeight })
  return {
    target: iframe.contentWindow,
    element: iframe,
    present,
    viewport,
    reveal: () => {
      iframe.style.visibility = 'visible'
    },
    cleanup: () => {
      document.removeEventListener('keydown', onKeydown)
      viewport.stop()
      iframe.remove()
    },
  }
}
