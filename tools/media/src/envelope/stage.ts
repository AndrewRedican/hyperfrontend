import type { EnvelopeConfig } from '../models/envelope'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { EnvelopeLayout, EnvelopeMetrics } from './layout'
import type { EnvelopeTimeline } from './timeline'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { renderKey } from './glyphs'
import { envelopeLayout, envelopeMetrics } from './layout'
import { renderRow } from './render'
import { envelopeTimeline, FADE_MS, JITTER_MS, KEY_MS } from './timeline'

/** How far the wrong key recoils, in pixels, while the strip shakes against it. */
const RECOIL_PX = 4

/**
 * Build the stylesheet for one strip pair, with its theme resolved into it.
 *
 * @param config - The strip as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function envelopeStyles(config: EnvelopeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = envelopeMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.env-frame { position: absolute; inset: 0; }
.env-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.env-chip { position: absolute; top: ${metrics.insetPx}px; }
.env-chip--encrypt { left: ${metrics.insetPx}px; }
.env-chip--decrypt { right: ${metrics.insetPx}px; }
.env-cell { font-family: ${theme.fonts.mono}; font-size: ${metrics.cellFontPx}px; font-weight: 600; }
.env-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; fill: ${theme.text.muted}; }
.env-sign { font-family: ${theme.fonts.mono}; font-size: ${metrics.signPx}px; font-weight: 600; fill: ${theme.text.muted}; }
`
}

/**
 * Draw one key on its way to, or resting against, a lock.
 *
 * @param layout - Where everything on the strip sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param y - Vertical centre of the strip the key is for.
 * @param setOffAt - When the key leaves the edge of the frame.
 * @param colour - What the key is drawn in.
 * @param recoilAt - When the key is pushed back by a strip that will not open, or undefined for a key that fits.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, or nothing before the key sets off.
 */
function renderTravellingKey(
  layout: EnvelopeLayout,
  metrics: EnvelopeMetrics,
  y: number,
  setOffAt: number,
  colour: string,
  recoilAt: number | undefined,
  atMs: number
): string {
  if (atMs < setOffAt) {
    return ''
  }
  const travelled = easeInOut(progress(atMs, setOffAt, KEY_MS))
  const recoil = recoilAt === undefined ? 0 : RECOIL_PX * pulse(atMs, recoilAt, JITTER_MS)
  const tipX = lerp(layout.keyStartX, layout.key.x, travelled) + recoil
  return renderKey(tipX, y, metrics.keyPx, colour)
}

/**
 * Draw the sign between the two sealed strips, over the salt they disagree on.
 *
 * @param layout - Where everything on the strip sits.
 * @param timeline - Every moment on the stage's timeline.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, or nothing before the second strip is sealed.
 */
function renderSign(layout: EnvelopeLayout, timeline: EnvelopeTimeline, atMs: number): string {
  const opacity = easeOut(progress(atMs, timeline.signAt, FADE_MS))
  if (opacity <= 0) {
    return ''
  }
  const x = layout.salt.x + layout.salt.width / 2
  return `<text x="${x.toFixed(1)}" y="${layout.signY}" class="env-sign" text-anchor="middle" dominant-baseline="central" opacity="${opacity.toFixed(3)}">&#8800;</text>`
}

/**
 * A secret sealed into an envelope twice, then opened once.
 *
 * The plain secret sits in its cells. `encrypt` writes random material to
 * its left, block by block, scrambles the cells into cipher, writes more
 * random material to its right and drops a lock shut on the end. The same
 * secret appears below and the same call runs again, and every block and
 * every glyph comes out different. Then `decrypt`: one key slides to the
 * first lock and fits, the lock opens, the random material fades and the
 * cells turn back into the secret; a second key slides to the second lock
 * and does not fit, the strip shakes, and the lock stays shut.
 */
export const envelopeStage: Stage<EnvelopeConfig> = defineStage<EnvelopeConfig>({
  id: 'envelope',

  styles: envelopeStyles,

  durationMs(config: EnvelopeConfig): number {
    return envelopeTimeline(config).settledAt + (config.restMs ?? 1_100)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = envelopeMetrics(profile)
    const layout = envelopeLayout(config, metrics, profile)
    const timeline = envelopeTimeline(config)
    const shared = { config, layout, metrics, theme, atMs }
    const rowA = renderRow({
      ...shared,
      row: { strip: 0, y: metrics.rowAY, schedule: timeline.a, plainAt: -1, openAt: timeline.openAAt, unsealAt: timeline.unsealAt },
    })
    const rowB = renderRow({
      ...shared,
      row: {
        strip: 1,
        y: metrics.rowBY,
        schedule: timeline.b,
        plainAt: timeline.plainBAt,
        jitterAt: timeline.jitterAt,
        refuseAt: timeline.refuseAt,
      },
    })
    const keyA = renderTravellingKey(layout, metrics, metrics.rowAY, timeline.keyAAt, theme.text.plain, undefined, atMs)
    const keyB = renderTravellingKey(layout, metrics, metrics.rowBY, timeline.keyBAt, theme.tones.danger, timeline.jitterAt, atMs)
    const decryptOpacity = easeOut(progress(atMs, timeline.decryptAt, FADE_MS))
    return `<div class="env-frame">
      <svg class="env-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${rowA}
        ${rowB}
        ${renderSign(layout, timeline, atMs)}
        ${keyA}
        ${keyB}
      </svg>
      <div class="env-chip env-chip--encrypt">${renderApiChip(config.api.encrypt, config.api.mark)}</div>
      <div class="env-chip env-chip--decrypt" style="opacity:${decryptOpacity.toFixed(3)};transform:translateY(${round(4 * (1 - decryptOpacity))}px)">${renderApiChip(config.api.decrypt, config.api.mark)}</div>
    </div>`
  },
})
