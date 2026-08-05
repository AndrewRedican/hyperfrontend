/** Props for {@link DialogCloseControls}. */
export interface DialogCloseControlsProps {
  /** Invoked when the visitor activates the close button. */
  onCloseRequest: () => void
}

/**
 * The dialog-mode close chrome: a circular ✕ button with an `ESC` hint beside
 * it. Rendered only while a host presents the feature as a dialog. The button
 * emits a `close-request` through the contract — the host owns the dialog and
 * performs the actual close. Escape needs no listener here: the SDK already
 * turns an in-frame Escape into its dismiss signal for the host.
 *
 * @param props - The {@link DialogCloseControlsProps}.
 * @returns The close controls.
 */
export function DialogCloseControls({ onCloseRequest }: DialogCloseControlsProps) {
  return (
    <div className="dialog-chrome">
      <span className="dialog-esc-hint" aria-hidden="true">
        esc
      </span>
      <button type="button" className="dialog-close" aria-label="Close dialog" onClick={onCloseRequest}>
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path d="M2.5 2.5 9.5 9.5 M9.5 2.5 2.5 9.5" />
        </svg>
      </button>
    </div>
  )
}
