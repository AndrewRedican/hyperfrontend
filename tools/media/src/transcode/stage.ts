import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { TranscodeConfig } from '../models/transcode'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { apiChipStyles, renderApiChip, renderForeignLabel } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { renderBytes, renderCharacters } from './bytes'
import { transcodeLayout, transcodeMetrics } from './layout'
import { renderBands, renderFunnels, renderGhost, renderResults } from './results'
import { presence } from './tile'
import { FADE_MS, FOLD_MS, transcodeTimeline } from './timeline'

/**
 * Build the stylesheet for one crossing, with its theme resolved into it.
 *
 * @param config - The crossing as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function transcodeStyles(config: TranscodeConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = transcodeMetrics(profile)
  const layout = transcodeLayout(config, metrics, profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.tc-frame { position: absolute; inset: 0; }
.tc-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.tc-label { position: absolute; display: flex; align-items: center; justify-content: flex-end; transform: translateY(-50%); }
.tc-label--encode { right: ${round(profile.width - layout.resultsLeft + metrics.chipGapPx)}px; top: ${metrics.rowCY}px; }
.tc-label--foreign { right: ${round(profile.width - layout.bytesLeft + metrics.chipGapPx)}px; top: ${metrics.rowBY}px; }
.tc-char { font-family: ${theme.fonts.sans}; font-size: ${metrics.charFontPx}px; font-weight: 600; }
.tc-hex { font-family: ${theme.fonts.mono}; font-size: ${metrics.byteFontPx}px; font-weight: 600; }
.tc-result { font-family: ${theme.fonts.mono}; font-size: ${metrics.resultFontPx}px; font-weight: 700; }
`
}

/**
 * One value crossing its representations and coming back.
 *
 * The text sits as character tiles. Each character drops the bytes it is
 * written as, and a two-byte character drops two. The bytes close up into
 * threes, a funnel opens under each three, and four characters of the
 * encoding are drawn out of every funnel; a dashed slot stands in for the
 * byte the last three is short of, and the padding character comes out of
 * it. Then the platform's encoder has a turn at the same tiles: the two
 * bytes it cannot tell apart flash, collapse into one wrong byte, and a copy
 * of the result peels off from under the package's with a different tail,
 * struck through. The copy fades, and the package's decoder folds the
 * encoding back into its bytes and the bytes back into the text.
 */
export const transcodeStage: Stage<TranscodeConfig> = defineStage<TranscodeConfig>({
  id: 'transcode',

  styles: transcodeStyles,

  durationMs(config: TranscodeConfig): number {
    return transcodeTimeline(config).settledAt + (config.restMs ?? 900)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = transcodeMetrics(profile)
    const layout = transcodeLayout(config, metrics, profile)
    const timeline = transcodeTimeline(config)
    const context = { config, layout, metrics, theme, timeline, atMs }
    // why: the two chips share one spot, so the encode chip is gone before the decode chip arrives rather than the two names crossing over each other
    const encode = presence(timeline.encodeChipAt, timeline.decodeChipAt - FADE_MS, FADE_MS, atMs)
    const decode = easeOut(progress(atMs, timeline.decodeChipAt, FADE_MS))
    // why: the decode chip climbs with the fold, so it ends beside the text it gave back rather than beside a row that is no longer there
    const climbed = easeInOut(progress(atMs, timeline.foldCAt, timeline.foldBAt + FOLD_MS - timeline.foldCAt))
    const decodeTop = lerp(metrics.rowCY, metrics.rowAY, climbed)
    const decodeRight = lerp(
      profile.width - layout.resultsLeft + metrics.chipGapPx,
      profile.width - layout.charsLeft + metrics.chipGapPx,
      climbed
    )
    const foreign = presence(timeline.foreignAt, timeline.ghostOutAt, FADE_MS, atMs)
    return `<div class="tc-frame">
      <svg class="tc-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderBands(context)}
        ${renderFunnels(context)}
        ${renderBytes(context)}
        ${renderCharacters(context)}
        ${renderGhost(context)}
        ${renderResults(context)}
      </svg>
      <div class="tc-label tc-label--encode" style="opacity:${encode.toFixed(3)}">${renderApiChip(config.api.encode, config.api.mark)}</div>
      <div class="tc-label tc-label--decode" style="opacity:${decode.toFixed(3)};top:${decodeTop.toFixed(1)}px;right:${decodeRight.toFixed(1)}px">${renderApiChip(config.api.decode, config.api.mark)}</div>
      <div class="tc-label tc-label--foreign" style="opacity:${foreign.toFixed(3)}">${renderForeignLabel(config.foreign.name)}</div>
    </div>`
  },
})
