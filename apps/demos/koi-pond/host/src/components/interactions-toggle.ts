/**
 * The "View interactions" control: the pond's own primary instrument.
 *
 * Turning it on is what makes the composition visible. Eight independent
 * applications coordinating through one host is otherwise a claim a visitor has
 * to take on trust; the decision overlay draws the sensing cones and the
 * coloured traces of what each koi has actually decided, which is the whole
 * point of the demo made literal. That is not an incidental diagnostic, so it
 * does not sit in a corner dressed as one: it holds the bottom edge of the
 * scene, centred, where no host's chrome ever lands (the close control takes
 * the top-right, an embedding host's console the top-left, the roster the
 * bottom-right) and where a thumb reaches it on a phone.
 *
 * Its presence follows the pond's presentation rather than the viewport's
 * width, because those are different questions. A thumbnail card has no room
 * for controls and is an invitation to expand rather than the venue; a pond
 * presented as the whole experience has room for this one control at any width,
 * which is exactly the case a width rule used to get wrong on a phone.
 *
 * Like every interactive thing over the pond it keeps its presses to itself: a
 * click on the button must never strike the water behind it.
 */

/** The glyph on the control: a koi's sensing cone sweeping ahead of it. */
const CONE_GLYPH =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="13" height="13"><circle cx="4" cy="8" r="1.6" fill="currentColor"/><path d="M5.6 8 13 3.6M5.6 8 13 12.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.55"/><path d="M11.2 5.2a3.6 3.6 0 0 1 0 5.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>'

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
  button.setAttribute('aria-pressed', 'false')
  // why: The label names the capability and never changes with state; `aria-pressed` and the lit treatment are what say whether it is on, so the control keeps one identity a visitor can look for twice.
  button.innerHTML = `${CONE_GLYPH}<span>View interactions</span>`

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
