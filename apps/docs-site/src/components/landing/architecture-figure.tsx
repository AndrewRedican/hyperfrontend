'use client'

import { useEffect, useState } from 'react'

/** The three things the figure draws, which the legend beside it names. */
export type ArchitecturePart = 'host' | 'shell' | 'broker'

/** Props for {@link ArchitectureFigure}. */
interface ArchitectureFigureProps {
  /** The part the reader is pointing at or has focused, or null for none */
  highlight: ArchitecturePart | null
  /** Called as the pointer enters or leaves a part of the drawing */
  onHighlight: (part: ArchitecturePart | null) => void
}

/** The channel's path, from the host's own page to the feature's window. */
const CHANNEL = 'M 240 250 H 328'

/** The channel's path the other way. */
const CHANNEL_BACK = 'M 328 250 H 240'

/** How long a message takes to cross the channel, in seconds. */
const CROSSING_S = 3.6

/** When each message passes the broker, in seconds from the start of its crossing, for the pulse to time itself on. */
const BROKER_PASS_S = { forward: 1.3, back: 2.3 }

/** Placeholder text bars in a window, as `[x, y, width]`. */
type Bar = readonly [number, number, number]

/** The host page's own content, left of the shell. */
const HOST_BARS: readonly Bar[] = [
  [40, 86, 176],
  [40, 108, 240],
  [40, 130, 206],
  [40, 152, 132],
  [40, 304, 150],
  [40, 326, 220],
  [40, 348, 138],
]

/** The feature's own content, inside its window. */
const FEATURE_BARS: readonly Bar[] = [
  [352, 192, 124],
  [352, 214, 262],
  [352, 236, 228],
  [352, 258, 172],
  [352, 296, 198],
]

/**
 * The relationship the landing page has to explain, drawn once: a host
 * application with a feature shell seated in its page, a dashed isolation
 * boundary inside the shell, the feature application on its own origin
 * inside that, and the message broker between the host's page and the shell
 * with messages crossing it both ways.
 *
 * The drawing is grounded in the shape the architecture guide documents and
 * stops well short of being that guide: nothing here is a sequence diagram,
 * and every label is one a visitor can carry into the legend beside it. The
 * legend and the drawing point at each other, so hovering either lifts the
 * same part in both. Under reduced motion the messages stand still mid-way.
 * @param props - See {@link ArchitectureFigureProps}.
 * @param props.highlight - The part the reader is pointing at
 * @param props.onHighlight - Called as the pointer enters or leaves a part
 * @returns The figure.
 */
export function ArchitectureFigure({ highlight, onHighlight }: ArchitectureFigureProps) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotion = () => setReduced(motion.matches)
    applyMotion()
    motion.addEventListener('change', applyMotion)
    return () => motion.removeEventListener('change', applyMotion)
  }, [])

  const partProps = (part: ArchitecturePart) => ({
    className: `arch-part arch-part--${part}`,
    onMouseEnter: () => onHighlight(part),
    onMouseLeave: () => onHighlight(null),
  })

  return (
    <svg
      viewBox="0 0 760 450"
      className="arch-figure h-auto w-full"
      data-highlight={highlight ?? undefined}
      role="img"
      aria-labelledby="arch-figure-title arch-figure-desc"
    >
      <title id="arch-figure-title">How a feature runs inside a host</title>
      <desc id="arch-figure-desc">
        A host application window with a feature shell seated in its page. Inside the shell, a dashed boundary marks a separate browsing
        context, and inside that the feature application runs from its own origin. A message broker sits between the host&apos;s page and
        the shell, and contract messages cross it in both directions.
      </desc>

      <g {...partProps('host')}>
        <text className="arch-caps" x="18" y="14">
          Host application
        </text>
        <rect className="arch-window" x="16" y="24" width="728" height="404" rx="14" />
        <path className="arch-chrome" d="M 16 38 a 14 14 0 0 1 14 -14 h 700 a 14 14 0 0 1 14 14 v 20 H 16 z" />
        <circle cx="36" cy="41" r="4.5" fill="#f87171" />
        <circle cx="52" cy="41" r="4.5" fill="#fbbf24" />
        <circle cx="68" cy="41" r="4.5" fill="#34d399" />
        <rect className="arch-url" x="90" y="31" width="186" height="20" rx="10" />
        <text className="arch-mono" x="102" y="45">
          https://app.example.com
        </text>
        {HOST_BARS.map(([x, y, width]) => (
          <rect key={`${x}-${y}`} className="arch-bar" x={x} y={y} width={width} height="10" rx="5" />
        ))}
      </g>

      <g {...partProps('shell')}>
        <rect className="arch-shell" x="296" y="72" width="432" height="340" rx="12" />
        <rect className="arch-pill" x="312" y="60" width="124" height="24" rx="12" />
        <g
          transform="translate(323 65) scale(0.4375)"
          className="arch-mark"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="5.5" width="24" height="21" rx="3" />
          <path d="M4 11.5h24" />
          <circle cx="7.6" cy="8.5" r="1.15" fill="currentColor" stroke="none" />
          <rect x="16.5" y="15" width="8.5" height="8.5" rx="2" />
          <path d="M8.5 19.25h4.5" />
        </g>
        <text className="arch-label" x="342" y="76.5">
          feature shell
        </text>
        <rect className="arch-boundary" x="314" y="104" width="396" height="280" rx="10" />
        <text className="arch-caps" x="694" y="374" textAnchor="end">
          Browsing context
        </text>
        <rect className="arch-window" x="332" y="122" width="360" height="224" rx="10" />
        <path className="arch-chrome" d="M 332 132 a 10 10 0 0 1 10 -10 h 340 a 10 10 0 0 1 10 10 v 20 H 332 z" />
        <circle cx="350" cy="137" r="4" fill="#f87171" />
        <circle cx="364" cy="137" r="4" fill="#fbbf24" />
        <circle cx="378" cy="137" r="4" fill="#34d399" />
        <rect className="arch-url" x="396" y="128" width="198" height="18" rx="9" />
        <text className="arch-mono" x="408" y="141">
          https://checkout.team-b.dev
        </text>
        <text className="arch-caps" x="352" y="176">
          Feature application
        </text>
        {FEATURE_BARS.map(([x, y, width]) => (
          <rect key={`${x}-${y}`} className="arch-bar arch-bar--feature" x={x} y={y} width={width} height="10" rx="5" />
        ))}
      </g>

      <g {...partProps('broker')}>
        <path className="arch-channel" d={CHANNEL} />
        <circle className="arch-port" cx="240" cy="250" r="4" />
        <circle className="arch-port" cx="328" cy="250" r="4" />
        {reduced ? null : (
          <>
            <circle className="arch-pulse" cx="272" cy="250" r="16">
              <animate
                attributeName="r"
                values="16;26"
                dur={`${CROSSING_S}s`}
                begin={`${BROKER_PASS_S.forward}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.55;0"
                dur={`${CROSSING_S}s`}
                begin={`${BROKER_PASS_S.forward}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle className="arch-pulse" cx="272" cy="250" r="16">
              <animate attributeName="r" values="16;26" dur={`${CROSSING_S}s`} begin={`${BROKER_PASS_S.back}s`} repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.55;0"
                dur={`${CROSSING_S}s`}
                begin={`${BROKER_PASS_S.back}s`}
                repeatCount="indefinite"
              />
            </circle>
          </>
        )}
        <circle className="arch-node" cx="272" cy="250" r="16" />
        <g
          transform="translate(263 241) scale(0.5625)"
          className="arch-mark"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="16" cy="16" r="3.6" />
          <circle cx="16" cy="5.6" r="2.1" />
          <circle cx="26.4" cy="16" r="2.1" />
          <circle cx="16" cy="26.4" r="2.1" />
          <circle cx="5.6" cy="16" r="2.1" />
          <path d="M16 12.4V7.7M19.6 16h4.7M16 19.6v4.7M12.4 16H7.7" />
        </g>
        <text className="arch-note" x="272" y="284" textAnchor="middle">
          Message broker
        </text>
        <g className="arch-lock" transform="translate(308 230)">
          <rect x="0" y="5" width="11" height="8.5" rx="2" />
          <path d="M2.5 5V3.6a3 3 0 0 1 6 0V5" />
        </g>
        {reduced ? (
          <>
            <circle className="arch-msg" cx="258" cy="250" r="3.5" />
            <circle className="arch-msg" cx="300" cy="250" r="3.5" />
          </>
        ) : (
          <>
            <circle className="arch-msg" r="3.5">
              <animateMotion dur={`${CROSSING_S}s`} repeatCount="indefinite" path={CHANNEL} />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur={`${CROSSING_S}s`} repeatCount="indefinite" />
            </circle>
            <circle className="arch-msg" r="3.5">
              <animateMotion dur={`${CROSSING_S}s`} begin="1.8s" repeatCount="indefinite" path={CHANNEL_BACK} />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.88;1"
                dur={`${CROSSING_S}s`}
                begin="1.8s"
                repeatCount="indefinite"
              />
            </circle>
          </>
        )}
      </g>
    </svg>
  )
}
