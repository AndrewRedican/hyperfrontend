/**
 * How finely the pond's own canvases paint.
 *
 * A canvas allocates one backing pixel per CSS pixel for every unit of device
 * pixel ratio, and phones report ratios approaching three: a 288 pixel card bed
 * painted at 2.8125 costs about 2.6MB of memory for detail no eye resolves at
 * arm's length, and an expanded scene costs proportionally more. Every WebGL
 * surface in the scene already refuses to go past two, and the canvases the
 * host paints itself hold to the same ceiling.
 *
 * This is a plain capability cap rather than a quality setting: nothing here
 * inspects the device, tiers it, or degrades one scene differently from
 * another.
 */

/** Most backing-store pixels a pond canvas paints for each CSS pixel. */
export const MAX_CANVAS_DPR = 2

/**
 * The ratio a pond canvas paints at, whatever the device reports.
 *
 * @param reported - The device pixel ratio the browser reports.
 * @returns The ratio to size the backing store and scale the drawing transform by.
 */
export function canvasPixelRatio(reported: number): number {
  return Math.min(reported, MAX_CANVAS_DPR)
}
