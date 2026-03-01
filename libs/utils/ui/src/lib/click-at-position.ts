export type TMouseEvent = MouseEvent & { pageX: number; pageY: number }

/**
 * Simulates a mouse click at the specified screen coordinates.
 * Dispatches a synthetic mousedown event to the document.
 *
 * @param x - The x-coordinate for the click position
 * @param y - The y-coordinate for the click position
 */
export function clickAtPosition(x: number, y: number): void {
  const clickEvent = <TMouseEvent>new Event('mousedown')
  clickEvent.pageX = x
  clickEvent.pageY = y
  document.dispatchEvent(clickEvent)
}
