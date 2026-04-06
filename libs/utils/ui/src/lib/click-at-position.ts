/** Page coordinates for click position. */
interface ClickPageCoordinates {
  /** X coordinate on the page. */
  pageX: number
  /** Y coordinate on the page. */
  pageY: number
}

/** Extended MouseEvent with guaranteed pageX and pageY coordinates. */
export type TMouseEvent = MouseEvent & ClickPageCoordinates

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
