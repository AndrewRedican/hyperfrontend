/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Rect {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  w: number
  /** Height. */
  h: number
}
