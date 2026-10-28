import type { IconKind } from '@/lib/ci/labels'
import { ICON_NAMES } from '@/lib/ci/labels'

/** The strokes of each icon, on a 24-unit square. */
const PATHS: Record<IconKind, string> = {
  library: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M4 7.5l8 4.5 8-4.5 M12 12v9',
  utility: 'M14.5 4.5a4 4 0 0 0-5 5L4 15l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z',
  demo: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z M10 8.5v7l6-3.5z',
  tool: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  test: 'M9 3h6 M10 3v6l-5 9.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3 M7.5 15h9',
  app: 'M5 4.5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z M3 9h18 M6 6.8h.01 M8.5 6.8h.01',
  root: 'M3 11l9-7 9 7 M5.5 9.5V20h13V9.5 M10 20v-5h4v5',
  package: 'M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z M3.5 7.5L12 11.5l8.5-4 M12 11.5v9 M7.8 5.5l8.4 4',
  executor: 'M4 4.5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z M7 9.5l3 2.5-3 2.5 M12.5 15h4.5',
  config: 'M6 3h8l5 5v13H6z M14 3v5h5 M9 13h7 M9 17h5',
}

/** Props for {@link NodeIcon}. */
export interface NodeIconProps {
  /** What the icon shows */
  kind: IconKind
  /** The left edge, in the drawing's units */
  x: number
  /** The top edge, in the drawing's units */
  y: number
  /** The side of the square */
  size: number
}

/**
 * An icon drawn inside an SVG, in the secondary ink, so it follows the theme.
 * @param props - See {@link NodeIconProps}.
 * @param props.kind - What the icon shows
 * @param props.x - The left edge
 * @param props.y - The top edge
 * @param props.size - The side of the square
 * @returns The icon
 */
export function NodeIcon({ kind, x, y, size }: NodeIconProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24})`} aria-hidden="true">
      <path d={PATHS[kind]} fill="none" stroke="var(--ci-ink-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** Props for {@link InlineIcon}. */
export interface InlineIconProps {
  /** What the icon shows */
  kind: IconKind
  /** Classes for the box, sizing it */
  className?: string
}

/**
 * An icon inline with text, in the current colour, named for a screen reader.
 * @param props - See {@link InlineIconProps}.
 * @param props.kind - What the icon shows
 * @param props.className - Classes sizing it
 * @returns The icon
 */
export function InlineIcon({ kind, className = 'h-3.5 w-3.5' }: InlineIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 ${className}`} role="img" aria-label={ICON_NAMES[kind]}>
      <title>{ICON_NAMES[kind]}</title>
      <path d={PATHS[kind]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
