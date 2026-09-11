/** Props for {@link StepMarker}. */
export interface StepMarkerProps {
  /** The step's number */
  number: number
  /**
   * How large the marker is drawn. `sm` sits beside a line of body text, `md`
   * beside a section heading.
   */
  size?: 'sm' | 'md'
}

/** The circle at each size: its box, and the type inside it. */
const SIZES: Record<NonNullable<StepMarkerProps['size']>, string> = {
  sm: 'h-6 w-6 text-sm',
  md: 'h-8 w-8 text-base',
}

/**
 * A step's number, in a circle.
 *
 * One component rather than a class string repeated beside every step,
 * because centring a digit in a circle is a typographic problem and not a
 * layout one: fonts place their ink differently inside the same box, and the
 * stylesheet's `step-marker` rule is where that is dealt with, once.
 * @param props - See {@link StepMarkerProps}.
 * @param props.number - The step's number
 * @param props.size - How large the marker is drawn
 * @returns The marker.
 * @example Numbering a step beside its heading
 * ```tsx
 * <StepMarker number={1} size="md" />
 * ```
 */
export function StepMarker({ number, size = 'sm' }: StepMarkerProps) {
  return (
    <span className={`step-marker bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 ${SIZES[size]}`}>
      <span className="step-marker__digit">{number}</span>
    </span>
  )
}
