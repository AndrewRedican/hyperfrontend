import { exp, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { isFinite, parseFloat } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** Natural (unscaled) pixel dimensions of a diagram or its container. */
export interface DiagramSize {
  /** Width in CSS pixels. */
  width: number
  /** Height in CSS pixels. */
  height: number
}

/** A position in container-local CSS pixels. */
export interface ViewportPoint {
  /** Horizontal offset from the container's left edge. */
  x: number
  /** Vertical offset from the container's top edge. */
  y: number
}

/** An affine viewport transform applied as translate(tx, ty) scale(scale) with origin 0 0. */
export interface ViewportTransform {
  /** Uniform scale factor. */
  scale: number
  /** Horizontal translation in container pixels. */
  tx: number
  /** Vertical translation in container pixels. */
  ty: number
}

/** Lower zoom bound for user-driven zooming; the fit scale may go lower for enormous diagrams. */
export const SCALE_MIN = 0.1

/** Upper zoom bound for user-driven zooming; the fit scale may go higher for tiny diagrams. */
export const SCALE_MAX = 10

/** Multiplier applied per discrete zoom step (buttons, keyboard, double-click). */
export const ZOOM_STEP = 1.5

/** Pixels of breathing room kept around the diagram when fitting it to the container. */
export const FIT_PADDING = 32

/** Minimum pixels of the diagram that must remain inside the container when panning. */
export const PAN_MARGIN = 48

/**
 * Matches the opening root svg tag of a serialized SVG document.
 *
 * @param svg - Serialized SVG markup
 * @returns The root tag text, or null when no svg tag is present
 */
function matchRootSvgTag(svg: string): string | null {
  const match = /<svg[^>]*>/i.exec(svg)
  return match ? match[0] : null
}

/**
 * Checks that both dimensions are finite and positive.
 *
 * @param width - Candidate width in pixels
 * @param height - Candidate height in pixels
 * @returns True when the pair describes a usable size
 */
function isUsableSize(width: number, height: number): boolean {
  return isFinite(width) && isFinite(height) && width > 0 && height > 0
}

/**
 * Extracts the natural (unscaled) pixel size of an SVG from its root tag.
 * Prefers the viewBox dimensions and falls back to the width/height attributes.
 *
 * @param svg - Serialized SVG markup
 * @returns The natural size, or null when the root tag declares no usable dimensions
 */
export function extractNaturalSize(svg: string): DiagramSize | null {
  const rootTag = matchRootSvgTag(svg)
  if (!rootTag) return null
  const viewBox = /\sviewBox="([^"]*)"/i.exec(rootTag)
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/)
    if (parts.length === 4) {
      const width = parseFloat(parts[2])
      const height = parseFloat(parts[3])
      if (isUsableSize(width, height)) return { width, height }
    }
  }
  const widthAttr = /\swidth="([^"%]+)"/i.exec(rootTag)
  const heightAttr = /\sheight="([^"%]+)"/i.exec(rootTag)
  if (widthAttr && heightAttr) {
    const width = parseFloat(widthAttr[1])
    const height = parseFloat(heightAttr[1])
    if (isUsableSize(width, height)) return { width, height }
  }
  return null
}

/**
 * Removes the max-width declaration mermaid bakes into the root tag's inline style.
 *
 * @param tag - The root svg tag text
 * @returns The tag with max-width stripped, dropping the style attribute if it becomes empty
 */
function stripMaxWidthStyle(tag: string): string {
  const style = /\sstyle="([^"]*)"/i.exec(tag)
  if (!style) return tag
  const kept = style[1]
    .split(';')
    .filter((declaration) => !declaration.trim().toLowerCase().startsWith('max-width'))
    .join(';')
    .trim()
  if (kept === '') return tag.replace(style[0], '')
  return tag.replace(style[0], ` style="${kept}"`)
}

/**
 * Rewrites the root svg tag so the element renders at an explicit natural pixel size.
 * Drops the width/height attributes and the inline max-width cap, then stamps the
 * natural dimensions so the element measures exactly `size` and can be positioned
 * with a CSS transform.
 *
 * @param svg - Serialized SVG markup
 * @param size - Natural size to stamp onto the root element
 * @returns The rewritten SVG markup, or the input unchanged when no root tag is found
 */
export function prepareNaturalSvg(svg: string, size: DiagramSize): string {
  const rootTag = matchRootSvgTag(svg)
  if (!rootTag) return svg
  let tag = rootTag
  tag = tag.replace(/\swidth="[^"]*"/i, '')
  tag = tag.replace(/\sheight="[^"]*"/i, '')
  tag = stripMaxWidthStyle(tag)
  tag = tag.replace(/<svg/i, `<svg width="${size.width}" height="${size.height}"`)
  return svg.replace(rootTag, tag)
}

/**
 * Computes the scale that fits the whole diagram inside the container with padding.
 *
 * @param size - Natural diagram size
 * @param container - Container size
 * @param padding - Pixels of breathing room kept on every side
 * @returns The largest uniform scale at which the diagram fits entirely
 */
export function fitScale(size: DiagramSize, container: DiagramSize, padding: number): number {
  const availableWidth = max(1, container.width - padding * 2)
  const availableHeight = max(1, container.height - padding * 2)
  return min(availableWidth / size.width, availableHeight / size.height)
}

/**
 * Clamps a requested scale to the zoom bounds, widened so the fit scale stays reachable
 * for diagrams whose fit falls outside the fixed bounds.
 *
 * @param scale - Requested scale
 * @param fit - The container's fit scale for the current diagram
 * @returns The clamped scale
 */
export function clampScale(scale: number, fit: number): number {
  return min(max(scale, min(SCALE_MIN, fit)), max(SCALE_MAX, fit))
}

/**
 * Builds the transform that centers the diagram in the container at a given scale.
 *
 * @param size - Natural diagram size
 * @param container - Container size
 * @param scale - Uniform scale factor to apply
 * @returns The centering transform
 */
export function centerTransform(size: DiagramSize, container: DiagramSize, scale: number): ViewportTransform {
  return {
    scale,
    tx: (container.width - size.width * scale) / 2,
    ty: (container.height - size.height * scale) / 2,
  }
}

/**
 * Rescales the view while keeping the diagram point under `point` stationary on screen.
 *
 * @param view - Current transform
 * @param point - Anchor position in container-local pixels
 * @param scale - New scale factor
 * @returns The transform at the new scale anchored on the point
 */
export function zoomAtPoint(view: ViewportTransform, point: ViewportPoint, scale: number): ViewportTransform {
  const ratio = scale / view.scale
  return {
    scale,
    tx: point.x - (point.x - view.tx) * ratio,
    ty: point.y - (point.y - view.ty) * ratio,
  }
}

/**
 * Clamps the translation so at least a margin of the diagram stays inside the container.
 *
 * @param view - Transform to clamp
 * @param size - Natural diagram size
 * @param container - Container size
 * @returns The transform with its translation clamped into the visible range
 */
export function clampPan(view: ViewportTransform, size: DiagramSize, container: DiagramSize): ViewportTransform {
  const scaledWidth = size.width * view.scale
  const scaledHeight = size.height * view.scale
  // why: The margin shrinks with tiny diagrams or containers so the clamp range can never invert
  const marginX = min(PAN_MARGIN, container.width, scaledWidth)
  const marginY = min(PAN_MARGIN, container.height, scaledHeight)
  return {
    scale: view.scale,
    tx: min(max(view.tx, marginX - scaledWidth), container.width - marginX),
    ty: min(max(view.ty, marginY - scaledHeight), container.height - marginY),
  }
}

/**
 * Converts a wheel delta into a multiplicative zoom factor.
 *
 * @param deltaY - Vertical wheel delta; negative deltas zoom in
 * @returns The factor to multiply the current scale by
 */
export function wheelZoomFactor(deltaY: number): number {
  // magic: 0.002 maps a mouse-wheel notch (~120 delta) to roughly a 25% zoom change while keeping trackpad pinches smooth
  return exp(-deltaY * 0.002)
}
