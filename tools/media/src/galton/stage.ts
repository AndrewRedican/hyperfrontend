import type { GaltonConfig } from '../models/galton'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { apiChipStyles } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { boardGeometry, galtonMetrics } from './layout'
import { renderBoard, renderChip, renderFork, renderGrains, renderLabel } from './render'
import { grainsAt, settledAt } from './timeline'

/**
 * Build the stylesheet for the boards, with the theme resolved into it.
 *
 * @param config - The scene's configuration.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for the stage.
 */
function galtonStyles(config: GaltonConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = galtonMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.ga-frame { position: absolute; inset: 0; }
.ga-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.ga-chip { position: absolute; left: 50%; top: ${metrics.insetPx}px; transform: translateX(-50%); }
.ga-method {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.labelPx}px;
  line-height: 1;
  font-weight: 600;
  color: ${theme.tones.accent};
  white-space: nowrap;
}
.ga-axis { font-family: ${theme.fonts.mono}; font-size: ${metrics.axisPx}px; fill: ${theme.text.faint}; }
`
}

/**
 * Grains falling into place on two boards.
 *
 * One chip names the seeded stream; a fork leads from it to a method label
 * above each board. From the top of each board, single grains appear at the
 * column the stream's next draw fell into and drop onto the pile already
 * there. Early on the piles are ragged and say nothing; as hundreds land, one
 * board flattens into a plateau and the other rises into a bell. The shapes
 * are the distributions, drawn by accumulation rather than described, and the
 * chip says where every grain came from.
 */
export const galtonStage: Stage<GaltonConfig> = defineStage<GaltonConfig>({
  id: 'galton',

  styles: galtonStyles,

  durationMs(config: GaltonConfig): number {
    return settledAt(config) + config.restMs
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = galtonMetrics(profile)
    const geometries = config.boards.map((_, index) => boardGeometry(config, profile, metrics, index))
    const boards = config.boards
      .map((board, index) => {
        const geometry = geometries[index]
        if (geometry === undefined) {
          return ''
        }
        return (
          renderBoard(config, geometry, metrics, theme) +
          renderGrains(board, geometry, metrics, theme, grainsAt(config, board, metrics, atMs))
        )
      })
      .join('')
    const labels = config.boards
      .map((board, index) => {
        const geometry = geometries[index]
        return geometry === undefined ? '' : renderLabel(board, geometry, metrics)
      })
      .join('')
    return `<div class="ga-frame">
      <svg class="ga-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderFork(geometries, metrics, theme, profile.width / 2)}
        ${boards}
      </svg>
      ${renderChip(config)}
      ${labels}
    </div>`
  },
})
