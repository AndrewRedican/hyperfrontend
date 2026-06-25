// note: In content mode the host mirrors the feature's announced content height onto the iframe so the embed grows with its content; width still fills the container via CSS.

/**
 * Shape of the size payload a feature announces over the control channel.
 */
interface SizeAnnouncement {
  /** Announced content height in pixels, when present. */
  height?: unknown
}

/**
 * Applies a feature-announced content height to the embedded iframe.
 *
 * @param frame - The iframe element to size.
 * @param data - The announced size payload; its numeric `height` is applied when present.
 *
 * @example Sizing the frame from an announcement
 * ```typescript
 * applyContentSize(iframe, { height: 480 })
 * ```
 */
export function applyContentSize(frame: HTMLElement, data: unknown): void {
  const height = (<SizeAnnouncement>data)?.height
  if (typeof height === 'number') {
    frame.style.height = `${height}px`
  }
}
