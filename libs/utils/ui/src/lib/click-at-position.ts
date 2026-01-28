export type TMouseEvent = MouseEvent & { pageX: number; pageY: number }

export function clickAtPosition(x: number, y: number): void {
  const clickEvent = new Event('mousedown') as TMouseEvent
  clickEvent.pageX = x
  clickEvent.pageY = y
  document.dispatchEvent(clickEvent)
}
