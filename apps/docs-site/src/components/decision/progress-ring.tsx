import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Props for {@link ProgressRing}. */
export interface ProgressRingProps {
  /** Steps completed. */
  value: number
  /** Steps known so far. A total of zero renders an empty ring rather than dividing by zero. */
  total: number
  /** Outer diameter in pixels. */
  size?: number
  /** Ring thickness in pixels. */
  stroke?: number
  /** Accessible label describing what is progressing. */
  label: string
}

/**
 * A compact ring showing progress through a set of steps, with the completed
 * count in the middle.
 *
 * The total is allowed to grow while the reader answers, because later
 * questions unlock: the ring therefore reports position, not a promise about
 * how much is left.
 * @param props - See {@link ProgressRingProps}.
 * @param props.value
 * @param props.total
 * @param props.size
 * @param props.stroke
 * @param props.label
 * @returns The ring.
 * @example
 * ```tsx
 * <ProgressRing value={3} total={8} label="Assessment progress" />
 * ```
 */
export function ProgressRing({ value, total, size = 52, stroke = 4, label }: ProgressRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? min(value / total, 1) : 0
  const dash = circumference * fraction

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="stroke-primary-500 transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {value}
        <span className="text-slate-400 dark:text-slate-500">/{total}</span>
      </span>
    </div>
  )
}
