/**
 * The "View interactions" control.
 *
 * Turns the pond's decision overlay on and off: the sensing cones and the
 * coloured traces of what each koi has decided to do. It floats over the water
 * like the roster does, and like every interactive thing over the pond it keeps
 * its presses to itself — a click on the button must never strike the water
 * behind it.
 */

/**
 * Mounts the interactions toggle.
 *
 * @param root - The pond root the control is placed over.
 * @param onToggle - Receives the new state whenever the visitor flips it.
 * @returns A function that removes the control.
 *
 * @example Arming the overlay toggle at boot
 * ```typescript
 * mountInteractionsToggle(pondRoot, (on) => scene.setInteractions(on))
 * ```
 */
export function mountInteractionsToggle(root: HTMLElement, onToggle: (on: boolean) => void): () => void {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pond-interactions'
  button.textContent = 'View interactions'
  button.setAttribute('aria-pressed', 'false')

  let on = false
  const contain = (event: Event): void => {
    event.stopPropagation()
  }
  button.addEventListener('pointerdown', contain)
  button.addEventListener('click', (event) => {
    contain(event)
    on = !on
    button.setAttribute('aria-pressed', on ? 'true' : 'false')
    onToggle(on)
  })

  root.append(button)
  return () => {
    button.remove()
  }
}
