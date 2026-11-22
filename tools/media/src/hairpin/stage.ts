import type { HairpinConfig } from '../models/hairpin'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { HairpinFrame } from './render'
import type { Token } from './token'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { progress } from '../lib/motion'
import { apiChipStyles, renderApiChip, renderForeignLabel } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { hairpinLayout } from './layout'
import { afterglowAt, liveAt, renderGround, renderLanes, renderPanes, renderShell, renderSupervisor, renderTokens } from './render'
import { DARK_STAGGER_MS, hairpinTimeline } from './timeline'
import { tokenAt } from './token'

/** How strongly a step's chip is drawn once the process has ended, as a percentage. */
const DARK_CHIP = 42

/** How long the signal's name takes to appear before the signal sets off. */
const NAME_MS = 220

/**
 * Build the stylesheet for the hairpin, with the theme resolved into it.
 *
 * Nothing in HTML carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. A chip dims by mixing its colours, driven by the `--hp-on` property its
 * slot sets.
 *
 * @param config - The service as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function hairpinStyles(config: HairpinConfig, profile: MediaProfile, theme: MediaTheme): string {
  const layout = hairpinLayout(config, profile)
  return `
${apiChipStyles(theme, layout.chipPx)}
.hp-frame { position: absolute; inset: 0; }
.hp-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.hp-slot { position: absolute; display: flex; align-items: center; justify-content: center; }
.hp-slot--end { justify-content: flex-end; }
.hp-slot .api-chip {
  color: color-mix(in srgb, ${theme.tones.accent} var(--hp-on), transparent);
  border-color: color-mix(in srgb, ${theme.accentSoft} var(--hp-on), transparent);
  background: color-mix(in srgb, ${theme.accentSoft} var(--hp-on), transparent);
}
.hp-slot .api-chip__mark { color: color-mix(in srgb, ${theme.accent} var(--hp-on), transparent); }
.hp-slot .api-foreign { color: color-mix(in srgb, ${theme.text.muted} var(--hp-on), transparent); }
.hp-plate { display: inline-flex; border-radius: 999px; background: ${theme.surfaceRaised}; }
.hp-code { font-family: ${theme.fonts.mono}; font-size: ${round(layout.chipPx * 1.3)}px; font-weight: 700; fill: ${theme.tones.success}; }
`
}

/**
 * Place a chip or a label in a slot of its own.
 *
 * @param markup - The chip or label.
 * @param centreX - Horizontal centre of the slot, or its right edge when the slot is end-aligned.
 * @param centreY - Vertical centre of the slot.
 * @param on - How strongly the content is drawn, from 0 to 1.
 * @param end - Whether the content is aligned to the slot's right edge.
 * @returns HTML for the slot.
 */
function slot(markup: string, centreX: number, centreY: number, on: number, end = false): string {
  const width = 180
  const height = 28
  const left = end ? centreX - width : centreX - width / 2
  return `<div class="hp-slot${end ? ' hp-slot--end' : ''}" style="left: ${left.toFixed(1)}px; top: ${(centreY - height / 2).toFixed(1)}px; width: ${width}px; height: ${height}px; --hp-on: ${round(on * 100)}%">${markup}</div>`
}

/**
 * Draw the names: a chip over each step, the runner's chip on the edge of the process, and the signal's name beside the wire.
 *
 * @param frame - The instant being drawn.
 * @returns HTML for the chips and the label.
 */
function renderNames(frame: HairpinFrame): string {
  const { config, layout, timeline, atMs } = frame
  const steps = layout.panes
    .map((pane, index) => {
      const live = liveAt(timeline, atMs, (layout.panes.length - 1 - index) * DARK_STAGGER_MS)
      return slot(
        renderApiChip(config.steps[index]?.name ?? '', config.mark),
        pane.centreX,
        layout.chipY,
        (DARK_CHIP + (100 - DARK_CHIP) * live) / 100
      )
    })
    .join('')
  const named = max(afterglowAt(atMs), progress(atMs, timeline.signalAt - NAME_MS, NAME_MS))
  return `${steps}
    ${slot(`<span class="hp-plate">${renderApiChip(config.runner, config.mark)}</span>`, layout.runner.x, layout.runner.y, 1)}
    ${slot(renderForeignLabel(config.signal), layout.wireTop.x - 8 * layout.unit, (layout.wireTop.y + layout.wireFoot.y) / 2, named, true)}`
}

/**
 * A service as a hairpin, inside a process that ends on request.
 *
 * The process is a shell with two openings in its wall. Its steps stand
 * inside as panes, outermost first, and two lanes cross every one of them: a
 * lane in along the top and a lane out along the bottom, joined inside each
 * pane by a turn. A request comes in as a hollow ring, passes through the
 * panes until it reaches the step that answers it, comes round that step's
 * turn and sets off back as a solid value; a step it passes on the way back
 * may close a band round it. A request the first step answers never reaches
 * the others. Then a signal climbs the wire to the runner: the way in swings
 * shut, a request that arrives after that stops against it and fades, the
 * ones already inside come round and leave through the way out, and only
 * when the last has left do the panes go dark and the exit code come down
 * the wire into the slot it was read from.
 */
export const hairpinStage: Stage<HairpinConfig> = defineStage<HairpinConfig>({
  id: 'hairpin',

  styles: hairpinStyles,

  durationMs(config: HairpinConfig, profile: MediaProfile): number {
    return hairpinTimeline(config, hairpinLayout(config, profile)).settledAt + (config.restMs ?? 1_000)
  },

  frame({ config, profile, theme, atMs }): string {
    const layout = hairpinLayout(config, profile)
    const timeline = hairpinTimeline(config, layout)
    const tokens = timeline.trips
      .map((trip) => tokenAt(trip, config, layout, timeline, atMs))
      .filter((token): token is Token => token !== undefined)
    const frame: HairpinFrame = { config, layout, timeline, theme, atMs, tokens }
    return `<div class="hp-frame">
      <svg class="hp-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderGround(frame)}
        ${renderPanes(frame)}
        ${renderLanes(frame)}
        ${renderShell(frame)}
        ${renderTokens(frame)}
        ${renderSupervisor(frame)}
      </svg>
      ${renderNames(frame)}
    </div>`
  },
})
