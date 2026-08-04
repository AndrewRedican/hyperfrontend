import type { RefObject } from 'react'
import { AORTA_D, CAVA_D, CAVA_RIM_D, HEART_VIEW_BOX, MASS_D, MASS_VESSEL_RIM_D, MASS_ATRIUM_D } from './heart-paths'

/** Props for the anatomical heart illustration. */
export interface HeartProps {
  /** Ref to the `<svg>` root so the beat animation can reach the stage groups. */
  svgRef: RefObject<SVGSVGElement | null>
}

/** The artwork's flat red. */
const RED = '#c62c36'
/** The artwork's line-work white, painted as a backing layer behind the red plates. */
const WHITE = '#ffffff'

/* why: The mass carries its two white details as evenodd cutouts, so they stay welded to the plate while it moves. */
const massD = `${MASS_D} ${MASS_VESSEL_RIM_D} ${MASS_ATRIUM_D}`

/* magic: The clip rects split the mass at the atrioventricular groove (y=70) with a 1.2-unit overlap that hides the seam at rest. */
const CLIP_SEAM_OVERLAP = { upperBottom: 70.6, lowerTop: 69.4 }

/**
 * The anatomical heart, decomposed into independently animatable layers that
 * reassemble into the source artwork: a white backing that provides the
 * line-work and outer rim, the vena cava, the aortic-arch crown, and the
 * cardiac mass split at the atrioventricular groove into an atria band and a
 * ventricular mass. The stage groups (`hb-cava`, `hb-aorta`, `hb-atria`,
 * `hb-ventricles`, `hb-backing`) each pulse on their own schedule per beat.
 *
 * @param props - The {@link HeartProps}.
 * @returns The inline SVG illustration.
 */
export function Heart({ svgRef }: HeartProps) {
  return (
    <svg ref={svgRef} className="heart" viewBox={HEART_VIEW_BOX} role="img" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="hb-clip-upper">
          <rect x="52" y="1" width="106" height={CLIP_SEAM_OVERLAP.upperBottom - 1} />
        </clipPath>
        <clipPath id="hb-clip-lower">
          <rect x="52" y={CLIP_SEAM_OVERLAP.lowerTop} width="106" height={141 - CLIP_SEAM_OVERLAP.lowerTop} />
        </clipPath>
      </defs>
      <g className="hb-backing">
        {/* why: Each subpath is stroked white and inflated, so the gaps between plates and the outer rim read as the artwork's line-work on any background. */}
        {[AORTA_D, CAVA_D, CAVA_RIM_D, massD, MASS_VESSEL_RIM_D, MASS_ATRIUM_D].map((d) => (
          <path key={d.slice(0, 24)} d={d} fill={WHITE} stroke={WHITE} strokeWidth="3" strokeLinejoin="round" />
        ))}
      </g>
      <g className="hb-cava">
        <path d={`${CAVA_D} ${CAVA_RIM_D}`} fill={RED} fillRule="evenodd" stroke={RED} strokeWidth="0.25" strokeLinejoin="round" />
      </g>
      <g className="hb-aorta">
        <path d={AORTA_D} fill={RED} stroke={RED} strokeWidth="0.25" strokeLinejoin="round" />
      </g>
      <g className="hb-atria">
        <path
          d={massD}
          fill={RED}
          fillRule="evenodd"
          stroke={RED}
          strokeWidth="0.25"
          strokeLinejoin="round"
          clipPath="url(#hb-clip-upper)"
        />
      </g>
      <g className="hb-ventricles">
        <path
          d={massD}
          fill={RED}
          fillRule="evenodd"
          stroke={RED}
          strokeWidth="0.25"
          strokeLinejoin="round"
          clipPath="url(#hb-clip-lower)"
        />
      </g>
    </svg>
  )
}
