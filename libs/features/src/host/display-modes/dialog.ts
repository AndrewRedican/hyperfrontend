import type { DisplayModeMount } from '../types'
import { button, div } from '@hyperfrontend/ui-utils/element'
import { createFeatureIframe } from '../iframe'
import { dialogDefaults } from './defaults'

// note: Overlay, close button, and Escape-to-close are on by default; all are customizable via ShellOptions.

/**
 * Mounts a feature as a centered modal dialog with an overlay and close button.
 *
 * @param context - Inputs the shell passes to this display mode.
 * @param context.options - The merged shell options.
 * @param context.requestClose - Requests the shell close itself.
 * @returns The iframe content window, the dialog container as the mounted element, and a teardown that unmounts the dialog.
 *
 * @example Mounting a dialog
 * ```typescript
 * const { target, cleanup } = mountDialog({ options, requestClose })
 * ```
 */
export const mountDialog: DisplayModeMount = ({ options, requestClose }) => {
  const container = div({ inlineStyle: { position: 'fixed', inset: '0', zIndex: '2147483647' } })

  if (options.dialogOverlay ?? true) {
    const backdrop = div({ inlineStyle: { position: 'absolute', inset: '0', background: 'rgba(0, 0, 0, 0.5)' } })
    backdrop.ref.addEventListener('click', () => requestClose())
    container.addChild(backdrop)
  }

  const dialog = div({
    inlineStyle: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${options.dialogWidth ?? dialogDefaults.width}px`,
      height: `${options.dialogHeight ?? dialogDefaults.height}px`,
      background: '#fff',
    },
  })

  const closeButton = button()
  closeButton.ref.type = 'button'
  closeButton.ref.textContent = '×'
  closeButton.ref.setAttribute('aria-label', 'Close')
  closeButton.ref.addEventListener('click', () => requestClose())

  const iframe = createFeatureIframe(options.url ?? '')
  dialog.addChild(closeButton)
  dialog.addChild(iframe)
  container.addChild(dialog)
  container.attachTo(document.body)

  const escapeEnabled = options.closeOnEscape !== false
  const onKeydown = (event: KeyboardEvent) => {
    if (escapeEnabled && event.key === 'Escape') {
      requestClose()
    }
  }
  document.addEventListener('keydown', onKeydown)

  return {
    target: iframe.contentWindow,
    element: container.ref,
    cleanup: () => {
      document.removeEventListener('keydown', onKeydown)
      container.ref.remove()
    },
  }
}
