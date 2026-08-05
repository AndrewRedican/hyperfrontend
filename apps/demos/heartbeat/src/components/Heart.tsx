import type { RefObject } from 'react'
import { useId } from 'react'
import { AORTA_D, CAVA_D, CAVA_RIM_D, HEART_VIEW_BOX, MASS_D, MASS_VESSEL_RIM_D, MASS_ATRIUM_D } from './heart-paths'

/** Props for the anatomical heart illustration. */
export interface HeartProps {
  /** Ref to the `<svg>` root so the beat animation can reach the stage groups. */
  svgRef: RefObject<SVGSVGElement | null>
}

/** Deep muscle red painted behind the plates — grooves and cutouts read as dark flesh, never as background. */
const UNDER = '#7f1b24'

/* why: The mass carries its two dark details as evenodd cutouts, so they stay welded to the plate while it moves. */
const massD = `${MASS_D} ${MASS_VESSEL_RIM_D} ${MASS_ATRIUM_D}`

/* magic: The clip rects split the mass at the atrioventricular groove (y=70) with a 2-unit overlap, so the halves never separate even at the ventricles' deepest squeeze (scale 0.92 about the seam). */
const CLIP_SEAM_OVERLAP = { upperBottom: 70.6, lowerTop: 68.6 }

/* magic: Goo tuning picked from a rendered matrix — σ1.4 heals the transient seams the pulse opens while a steeper 26/-13 alpha threshold keeps the resting grooves and the outer silhouette crisp. */
const GOO_BLUR = 1.4
const GOO_ALPHA_MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -13'

/**
 * The anatomical heart, decomposed into independently animatable layers that
 * reassemble into one organic body: a dark-red underlay that owns the grooves
 * and line-work, the vena cava, the aortic-arch crown, and the cardiac mass
 * split at the atrioventricular groove into an atria band and a ventricular
 * mass. The stage groups (`hb-cava`, `hb-aorta`, `hb-atria`, `hb-ventricles`,
 * `hb-underlay`) each pulse on their own schedule per beat, and a gooey filter
 * over the shared container blends neighbouring plates so the cuts between
 * them never read as straight seams mid-beat.
 *
 * @param props - The {@link HeartProps}.
 * @returns The inline SVG illustration.
 */
export function Heart({ svgRef }: HeartProps) {
  // why: Ids are referenced by URL, so every heart instance needs its own set — two mounted hearts must never resolve each other's filter or clips.
  const uid = useId()
  const fleshId = `${uid}-flesh`
  const gooId = `${uid}-goo`
  const upperId = `${uid}-clip-upper`
  const lowerId = `${uid}-clip-lower`
  const flesh = `url(#${fleshId})`
  return (
    <svg ref={svgRef} className="heart" viewBox={HEART_VIEW_BOX} role="img" aria-hidden="true" focusable="false">
      <defs>
        {/* why: One user-space gradient shared by every plate keeps shading continuous across section boundaries — independently scaling parts never expose a shade step. */}
        <linearGradient id={fleshId} gradientUnits="userSpaceOnUse" x1="78" y1="8" x2="132" y2="136">
          <stop offset="0" stopColor="#d0333f" />
          <stop offset="0.45" stopColor="#c62c36" />
          <stop offset="1" stopColor="#9c202b" />
        </linearGradient>
        <clipPath id={upperId}>
          <rect x="52" y="1" width="106" height={CLIP_SEAM_OVERLAP.upperBottom - 1} />
        </clipPath>
        <clipPath id={lowerId}>
          <rect x="52" y={CLIP_SEAM_OVERLAP.lowerTop} width="106" height={141 - CLIP_SEAM_OVERLAP.lowerTop} />
        </clipPath>
        {/* why: The widened region keeps the blur of pulsing plates inside the filter tile — without it the aorta's 1.06 systole scale would clip flat. */}
        <filter id={gooId} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={GOO_BLUR} result="blur" />
          <feColorMatrix in="blur" mode="matrix" values={GOO_ALPHA_MATRIX} result="goo" />
          {/* why: `over` (not the reference's `atop`) keeps the artwork uncropped — atop's thresholded mask erodes the thin aorta branch stubs — while the goo underneath still bridges any gap the pulse opens. */}
          <feComposite in="SourceGraphic" in2="goo" operator="over" />
        </filter>
      </defs>
      <g className="hb-goo" filter={`url(#${gooId})`}>
        <g className="hb-underlay">
          {/* why: A solid dark-red body under the plates means every groove, cutout, and transient seam reveals flesh instead of the page behind the heart. */}
          {[AORTA_D, CAVA_D, MASS_D].map((d) => (
            <path key={d.slice(0, 24)} d={d} fill={UNDER} stroke={UNDER} strokeWidth="0.8" strokeLinejoin="round" />
          ))}
        </g>
        <g className="hb-cava">
          <path d={`${CAVA_D} ${CAVA_RIM_D}`} fill={flesh} fillRule="evenodd" />
        </g>
        <g className="hb-aorta">
          <path d={AORTA_D} fill={flesh} />
        </g>
        <g className="hb-atria">
          <path d={massD} fill={flesh} fillRule="evenodd" clipPath={`url(#${upperId})`} />
        </g>
        <g className="hb-ventricles">
          <path d={massD} fill={flesh} fillRule="evenodd" clipPath={`url(#${lowerId})`} />
        </g>
      </g>
    </svg>
  )
}
