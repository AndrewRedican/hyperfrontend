/**
 * The pond's dialog chrome.
 *
 * A close control only makes sense when a host has announced that the pond is
 * being presented as a dialog. The app never guesses that from URLs or frame
 * ancestry — it renders the ✕ when, and only when, a presentation says dialog,
 * and it *requests* the close rather than performing it. The host owns the
 * presentation, so the host does the closing.
 */
import type { FeatureUi } from '../runtime/feature-ui'

/**
 * Mounts the dialog close control and keeps it in step with the presentation.
 *
 * @param root - The pond root the control is placed over.
 * @param ui - The presentation-fed UI state.
 * @returns A function that removes the control and its subscription.
 *
 * @example Arming the dialog chrome at boot
 * ```typescript
 * mountDialogCloseControls(pondRoot, featureUi)
 * ```
 */
export function mountDialogCloseControls(root: HTMLElement, ui: FeatureUi): () => void {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pond-close'
  button.textContent = '✕'
  button.setAttribute('aria-label', 'Close the koi pond')
  button.hidden = true

  const hint = document.createElement('p')
  hint.className = 'pond-close-hint'
  hint.textContent = 'Esc to close'
  hint.hidden = true

  button.addEventListener('click', () => {
    ui.requestClose()
  })

  const sync = (): void => {
    const isDialog = ui.getMode() === 'dialog'
    button.hidden = !isDialog
    hint.hidden = !isDialog
  }

  const unsubscribe = ui.subscribe(sync)
  sync()
  root.append(button, hint)

  return () => {
    unsubscribe()
    button.remove()
    hint.remove()
  }
}
