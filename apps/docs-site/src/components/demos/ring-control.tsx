'use client'

import { PI, cos, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Vertical radius (px) of the dial's dot ring. */
const RING_RADIUS_Y = 84
/** Horizontal radius (px) — kept narrow so the ring reads as a wheel seen from its side. */
const RING_RADIUS_X = 10
/** Diameter (px) of the nearest dot; farther dots scale down from this. */
const RING_DOT_SIZE = 10

/** Props for {@link RingControl}. */
export interface RingControlProps {
  /** Demo titles in deck order, one dot each. */
  titles: readonly string[]
  /** The deck's fractional position, rotating the ring live mid-drag. */
  position: number
  /** Index of the centered card, reported to assistive tech. */
  centered: number
  /** Begins a drag on the dial. */
  onBegin: (event: React.PointerEvent<HTMLDivElement>) => void
  /** Continues a drag on the dial. */
  onMove: (event: React.PointerEvent<HTMLDivElement>) => void
  /** Ends a drag on the dial. */
  onEnd: () => void
  /** Applies a wheel tick on the dial. */
  onSpin: (delta: number) => void
  /** Arrow-key navigation, shared with the deck. */
  onKeyNav: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

/**
 * The portrait deck's side dial: one dot per demo arranged on a wheel seen
 * edge-on — much taller than wide, near dots large and opaque, far dots small
 * and faint — rotating with the deck's position. Dragging up or down on the
 * dial (or wheeling over it, or arrow keys while focused) navigates the
 * carousel, which frees the deck itself for normal page scrolling.
 * @param root0 - The {@link RingControlProps}.
 * @param root0.titles - Demo titles in deck order.
 * @param root0.position - The deck's fractional position.
 * @param root0.centered - Index of the centered card.
 * @param root0.onBegin - Begins a drag on the dial.
 * @param root0.onMove - Continues a drag on the dial.
 * @param root0.onEnd - Ends a drag on the dial.
 * @param root0.onSpin - Applies a wheel tick on the dial.
 * @param root0.onKeyNav - Arrow-key navigation, shared with the deck.
 * @returns The side dial element.
 */
export function RingControl({ titles, position, centered, onBegin, onMove, onEnd, onSpin, onKeyNav }: RingControlProps) {
  return (
    <div
      role="slider"
      aria-orientation="vertical"
      aria-label="Browse demos"
      aria-valuemin={0}
      aria-valuemax={titles.length - 1}
      aria-valuenow={centered}
      aria-valuetext={titles[centered]}
      tabIndex={0}
      className="absolute right-0 top-1/2 z-[120] h-56 w-10 -translate-y-1/2 cursor-ns-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      onPointerDown={onBegin}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onWheel={(event) => onSpin(event.deltaY)}
      onKeyDown={onKeyNav}
    >
      {titles.map((title, index) => {
        // how: Each dot rides a circle in the screen's YZ plane — y from sin, apparent depth from cos — squashed to a narrow x bulge so the wheel reads edge-on.
        const angle = ((index - position) / titles.length) * 2 * PI
        const depth = (cos(angle) + 1) / 2
        return (
          <span
            key={title}
            aria-hidden
            className="absolute left-1/2 top-1/2 rounded-full bg-slate-900 dark:bg-white"
            style={{
              width: RING_DOT_SIZE,
              height: RING_DOT_SIZE,
              transform: `translate(-50%, -50%) translate(${cos(angle) * RING_RADIUS_X}px, ${sin(angle) * RING_RADIUS_Y}px) scale(${0.45 + 0.55 * depth})`,
              opacity: 0.25 + 0.75 * depth,
              zIndex: round(depth * 10),
            }}
          />
        )
      })}
    </div>
  )
}
