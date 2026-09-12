import type { BannerConfig } from '../models/banner'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { cos, PI, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { renderMark } from './mark'

/** How far the light behind the tile wanders, as a fraction of the banner's height. */
const DRIFT = 0.16

/** How far the second, fainter light wanders, as a fraction of the banner's height. */
const FAR_DRIFT = 0.24

/** How the banner is sized for the surface it is being drawn for. */
interface BannerMetrics {
  /** Margin between the content and the edge of the plate. */
  insetPx: number
  /** Side of the tile the mark sits in. */
  tilePx: number
  /** Font size of the prefix over the name. */
  prefixPx: number
  /** Font size of the name. */
  namePx: number
  /** Font size of the tagline. */
  taglinePx: number
  /** Font size of a facet pill. */
  facetPx: number
}

/**
 * Size the banner for the surface it is being drawn for.
 *
 * Everything scales from the height, because a banner is a strip and the
 * strip's height is the one dimension a readme column does not decide.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function bannerMetrics(profile: MediaProfile): BannerMetrics {
  const unit = profile.height / 180
  return {
    insetPx: round(26 * unit),
    tilePx: round(72 * unit),
    prefixPx: round(14 * unit),
    namePx: round(31 * unit),
    taglinePx: round(13.5 * unit),
    facetPx: round(11.5 * unit),
  }
}

/**
 * Build the stylesheet for one banner, with its theme resolved into it.
 *
 * @param config - The banner as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this banner.
 */
function bannerStyles(config: BannerConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = bannerMetrics(profile)
  const nameWidth = profile.width - metrics.insetPx * 2 - metrics.tilePx - round(metrics.insetPx * 0.8)
  // why: a long name at the full size would run off the strip, so the size steps down with the length rather than the name wrapping or clipping
  const namePx = config.name.length > 18 ? round(metrics.namePx * 0.84) : metrics.namePx
  return `
/* why: a wash of the package's accent behind the tile is the one place the banner is allowed some depth; it sits inside the plate, so a transparent canvas is never asked to blend it */
.bn-glow {
  position: absolute;
  width: ${round(profile.height * 1.9)}px;
  height: ${round(profile.height * 1.9)}px;
  margin-left: -${round(profile.height * 0.95)}px;
  margin-top: -${round(profile.height * 0.95)}px;
  border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, ${theme.accent} 16%, transparent) 0%, transparent 100%);
}
.bn-glow--far {
  width: ${round(profile.height * 2.4)}px;
  height: ${round(profile.height * 2.4)}px;
  margin-left: -${round(profile.height * 1.2)}px;
  margin-top: -${round(profile.height * 1.2)}px;
  background: radial-gradient(closest-side, ${theme.accentSoft} 0%, transparent 100%);
}
.bn-frame {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  align-items: center;
  gap: ${round(metrics.insetPx * 0.8)}px;
}
.bn-tile {
  flex: none;
  width: ${metrics.tilePx}px;
  height: ${metrics.tilePx}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${round(metrics.tilePx * 0.24)}px;
  background: ${theme.surfaceRaised};
  border: 1px solid ${theme.border};
  color: ${theme.accent};
  box-shadow: ${theme.shadow};
}
.bn-mark { width: ${round(metrics.tilePx * 0.58)}px; height: ${round(metrics.tilePx * 0.58)}px; }
.bn-text { flex: 1 1 auto; min-width: 0; max-width: ${nameWidth}px; display: flex; flex-direction: column; }
.bn-prefix {
  font-size: ${metrics.prefixPx}px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: ${theme.text.muted};
  font-family: ${theme.fonts.mono};
}
.bn-name {
  font-size: ${namePx}px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: ${theme.text.strong};
  white-space: nowrap;
}
.bn-tagline {
  margin-top: ${round(metrics.taglinePx * 0.55)}px;
  font-size: ${metrics.taglinePx}px;
  line-height: 1.4;
  color: ${theme.text.plain};
  max-width: ${round(nameWidth * 0.78)}px;
}
.bn-facets { display: flex; gap: ${round(metrics.facetPx * 0.6)}px; margin-top: ${round(metrics.taglinePx * 0.9)}px; }
.bn-facet {
  font-size: ${metrics.facetPx}px;
  line-height: 1;
  padding: ${round(metrics.facetPx * 0.45)}px ${round(metrics.facetPx * 0.8)}px;
  border-radius: 999px;
  border: 1px solid ${theme.border};
  background: ${theme.surface};
  color: ${theme.text.muted};
  font-family: ${theme.fonts.mono};
  white-space: nowrap;
}
`
}

/**
 * Where the two lights behind the tile are at one instant.
 *
 * Each rides a closed path of its own, one slow ellipse, and the two are
 * out of step so the ground never looks like it is swaying. A full turn takes
 * the scene's loop, which is what makes the last frame lead back into the
 * first.
 *
 * @param config - The banner as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param atMs - Offset from the start of the timeline.
 * @returns Inline styles positioning the near light and the far light.
 */
function lightsAt(config: BannerConfig, profile: MediaProfile, atMs: number): readonly [string, string] {
  const phase = (2 * PI * atMs) / config.loopMs
  const metrics = bannerMetrics(profile)
  const nearX = metrics.insetPx + metrics.tilePx * 0.5 + profile.height * DRIFT * cos(phase)
  const nearY = profile.height * 0.5 + profile.height * DRIFT * 0.6 * sin(phase)
  const farX = profile.width * 0.72 - profile.height * FAR_DRIFT * cos(phase + PI / 3)
  const farY = profile.height * 0.15 + profile.height * FAR_DRIFT * 0.5 * sin(phase + PI / 3)
  return [`left:${nearX.toFixed(1)}px; top:${nearY.toFixed(1)}px;`, `left:${farX.toFixed(1)}px; top:${farY.toFixed(1)}px;`]
}

/**
 * A package's identity, as one strip for the top of its readme.
 *
 * The mark in a tile, the name set large under its scope, one line saying
 * what the package is for, and a few short facts as pills. Nothing here is a
 * control: a banner is an image, and an image that looks like a toolbar is a
 * promise the readme cannot keep, so the links live in the markdown beside it.
 *
 * The one thing that moves is the light behind the tile, which drifts so
 * slowly that the strip reads as still until a reader has looked at it for a
 * while. It rides a closed path, so the loop has no seam.
 */
export const bannerStage: Stage<BannerConfig> = defineStage<BannerConfig>({
  id: 'banner',

  styles: bannerStyles,

  durationMs(config: BannerConfig): number {
    return config.loopMs
  },

  frame({ config, profile, atMs }): string {
    const facets = config.facets.map((facet) => `<span class="bn-facet">${escapeHtml(facet)}</span>`).join('')
    const [near, far] = lightsAt(config, profile, atMs)
    return `<div class="bn-glow bn-glow--far" style="${far}"></div><div class="bn-glow" style="${near}"></div><div class="bn-frame">
      <div class="bn-tile">${renderMark(config.mark, 'bn-mark')}</div>
      <div class="bn-text">
        <div class="bn-prefix">${escapeHtml(config.prefix)}</div>
        <div class="bn-name">${escapeHtml(config.name)}</div>
        <div class="bn-tagline">${escapeHtml(config.tagline)}</div>
        ${facets === '' ? '' : `<div class="bn-facets">${facets}</div>`}
      </div>
    </div>`
  },
})
