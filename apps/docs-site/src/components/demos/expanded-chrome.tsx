'use client'

/** Props for {@link ExpandButton}. */
export interface ExpandButtonProps {
  /** The expandable demo's title, for the control label. */
  title: string
  /** Stretches the running embed over the viewport. */
  onExpand: () => void
}

/**
 * The affordance a live expandable embed floats over itself.
 * @param root0
 * @param root0.title
 * @param root0.onExpand
 */
export function ExpandButton({ title, onExpand }: ExpandButtonProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      // why: A hosting surface may pointer-capture presses on its container (the deck's drag machinery); without stopping propagation the capture retargets the click and the button never fires.
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/70 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
      aria-label={`Expand the ${title} demo over the page`}
    >
      Click to expand ⤢
    </button>
  )
}

/** Props for {@link ExpandedChrome}. */
export interface ExpandedChromeProps {
  /** The expanded demo's title, for the control labels. */
  title: string
  /** Collapses the overlay back into its card. */
  onCollapse: () => void
  /** Offered when the overlay can hand the stage to a neighbouring demo. */
  onNeighbor?: (direction: -1 | 1) => void
}

/**
 * The expanded overlay's own controls: close, and — where the hosting surface
 * offers neighbours and the viewport has room beside the scene — next/previous
 * demo, floated over the revealed scene.
 * @param root0
 * @param root0.title
 * @param root0.onCollapse
 * @param root0.onNeighbor
 */
export function ExpandedChrome({ title, onCollapse, onNeighbor }: ExpandedChromeProps) {
  // why: The hosting surface may pointer-capture presses that bubble to its container (the deck's drag machinery); the overlay's controls must keep their presses to themselves.
  const keep = (event: React.PointerEvent) => event.stopPropagation()
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        onClick={onCollapse}
        onPointerDown={keep}
        className="pointer-events-auto absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90"
        aria-label={`Close the expanded ${title} demo`}
      >
        ✕
      </button>
      <span className="pointer-events-none absolute right-14 top-6 text-[0.66rem] tracking-wider text-white/50">esc</span>
      {/* why: On a phone the scene *is* the viewport, and these two sit right where a finger reaches into it — a tap meant for the demo hands the stage to another one instead. Closing the overlay puts the deck back within a swipe, so the neighbour controls only appear where there is room beside the scene for them. */}
      {onNeighbor ? (
        <>
          <button
            type="button"
            onClick={() => onNeighbor(-1)}
            onPointerDown={keep}
            className="pointer-events-auto absolute left-4 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90 sm:flex"
            aria-label="Previous demo"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onNeighbor(1)}
            onPointerDown={keep}
            className="pointer-events-auto absolute right-4 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/70 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/90 sm:flex"
            aria-label="Next demo"
          >
            →
          </button>
        </>
      ) : null}
    </div>
  )
}
