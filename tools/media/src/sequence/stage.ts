import type { MediaProfile } from '../models/profile'
import type { SequenceConfig, SequencePlacement, SequenceSegment } from '../models/sequence'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { scopeCss } from './scope-css'
import { chaptersAt, placeSegments, railPosition, transitionOf } from './timeline'

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How the frame is sized for the surface it is being drawn for. */
interface SequenceMetrics {
  /** Height of the rail along the top, or 0 when there is none. */
  railPx: number
  /** Margin between the rail and the edge of the frame. */
  insetPx: number
  /** Font size of a chapter's label on the rail. */
  labelPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @param rail - Whether the rail is drawn.
 * @returns Every measurement the renderer needs.
 */
function sequenceMetrics(profile: MediaProfile, rail: boolean): SequenceMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    railPx: rail ? (wide ? 34 : 28) : 0,
    insetPx: wide ? 28 : 18,
    labelPx: wide ? 13 : 12,
  }
}

/**
 * The profile a chapter is composed against: the frame less the rail.
 *
 * @param profile - The sequence's own profile.
 * @param metrics - The sequence's measurements.
 * @returns A profile the chapter lays itself out in.
 */
function chapterProfile(profile: MediaProfile, metrics: SequenceMetrics): MediaProfile {
  return { ...profile, height: profile.height - metrics.railPx }
}

/**
 * The class that confines one chapter's markup and stylesheet.
 *
 * @param index - The chapter's position in the sequence.
 * @returns A selector unique to that chapter.
 */
function chapterScope(index: number): string {
  return `.seq-chapter--${index}`
}

/**
 * Draw the rail naming every chapter, with the running one lit.
 *
 * @param config - The sequence as the scene configured it.
 * @param placements - The chapters on the timeline.
 * @param atMs - Offset from the start of the sequence.
 * @returns Markup for the rail.
 */
function renderRail(config: SequenceConfig, placements: readonly SequencePlacement[], atMs: number): string {
  const { current, progress } = railPosition(placements, atMs)
  const items = config.segments
    .map((segment, index) => {
      const state = index < current ? 'done' : index === current ? 'now' : 'next'
      return `<span class="seq-step seq-step--${state}"><span class="seq-index">${index + 1}</span>${escapeHtml(segment.label)}</span>`
    })
    .join('')
  const width = ((current + progress) / max(1, config.segments.length)) * 100
  return `<div class="seq-rail">${items}<div class="seq-progress"><div class="seq-progress-fill" style="width:${width.toFixed(2)}%"></div></div></div>`
}

/**
 * Build the stylesheet for one sequence, every chapter's confined to its own element.
 *
 * @param config - The sequence as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this sequence.
 */
function sequenceStyles(config: SequenceConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = sequenceMetrics(profile, config.rail !== false)
  const inner = chapterProfile(profile, metrics)
  const chapters = config.segments.map((segment, index) => scopeCss(segment.styles(inner, theme), chapterScope(index))).join('\n')
  return `
.seq-chapter {
  position: absolute;
  left: 0;
  right: 0;
  top: ${metrics.railPx}px;
  bottom: 0;
  overflow: hidden;
}
.seq-rail {
  position: absolute;
  left: ${metrics.insetPx}px;
  right: ${metrics.insetPx}px;
  top: ${round(metrics.insetPx * 0.55)}px;
  height: ${metrics.railPx}px;
  display: flex;
  align-items: flex-start;
  gap: ${round(metrics.labelPx * 1.6)}px;
  font-size: ${metrics.labelPx}px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: ${theme.text.faint};
}
.seq-step { display: inline-flex; align-items: center; gap: ${round(metrics.labelPx * 0.55)}px; white-space: nowrap; }
.seq-step--now { color: ${theme.text.strong}; }
.seq-step--done { color: ${theme.text.muted}; }
.seq-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${round(metrics.labelPx * 1.45)}px;
  height: ${round(metrics.labelPx * 1.45)}px;
  border-radius: 50%;
  font-size: ${round(metrics.labelPx * 0.8)}px;
  font-family: ${theme.fonts.mono};
  background: ${theme.surfaceRaised};
  border: 1px solid ${theme.border};
  color: ${theme.text.muted};
}
.seq-step--now .seq-index { background: ${theme.accent}; border-color: ${theme.accent}; color: ${theme.transparent ? theme.plate : '#ffffff'}; }
.seq-step--done .seq-index { color: ${theme.tones.success}; border-color: ${theme.tones.success}; }
.seq-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: ${theme.rule};
  overflow: hidden;
}
.seq-progress-fill { height: 100%; background: ${theme.accent}; }
${chapters}
`
}

/**
 * Two or three capabilities told as one story.
 *
 * Some packages are undersold by a single scene: the frame that shows what
 * they detect says nothing about what they can then safely do. A sequence
 * plays each chapter's own stage in turn, moves between them with a short
 * slide, and names them on a rail so a reader who arrives mid-loop still knows
 * where they are. The chapters share the frame, the theme and the rail, which
 * is what makes them one asset rather than three concatenated.
 *
 * Each chapter is composed against the frame less the rail, so a stage inside
 * a sequence lays itself out exactly as it would on its own at that size, and
 * each chapter's stylesheet is confined to its own element, so two chapters
 * drawn by the same stage cannot restyle each other.
 */
export const sequenceStage: Stage<SequenceConfig> = defineStage<SequenceConfig>({
  id: 'sequence',

  styles: sequenceStyles,

  durationMs(config: SequenceConfig, profile: MediaProfile): number {
    const metrics = sequenceMetrics(profile, config.rail !== false)
    return placeSegments(config, chapterProfile(profile, metrics)).reduce((end, placement) => max(end, placement.endMs), 0)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = sequenceMetrics(profile, config.rail !== false)
    const inner = chapterProfile(profile, metrics)
    const placements = placeSegments(config, inner)
    const chapters = chaptersAt(placements, transitionOf(config), atMs)
      .map((drawn) => {
        const style = `transform: translateX(${(drawn.shift * 100).toFixed(2)}%); opacity: ${drawn.opacity.toFixed(3)};`
        return `<div class="seq-chapter ${chapterScope(drawn.index).slice(1)}" style="${style}">${drawn.segment.frame(inner, theme, drawn.localMs)}</div>`
      })
      .join('')
    const rail = config.rail === false ? '' : renderRail(config, placements, atMs)
    return `${rail}${chapters}`
  },
})

/**
 * Run one of a chapter's stage functions, naming the chapter if it throws.
 *
 * @param label - The chapter's label, for the message.
 * @param call - The stage function, already bound to its arguments.
 * @returns Whatever the stage function returned.
 * @throws {Error} The stage's own error, prefixed with the chapter it came from.
 */
function inChapter<T>(label: string, call: () => T): T {
  try {
    return call()
  } catch (error) {
    throw createError(`Chapter "${label}": ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Bind a stage to the configuration a chapter hands it.
 *
 * The check that the configuration suits the stage happens here, where both
 * are named, and what comes back needs no type parameter for the sequence to
 * carry. A stage that throws while drawing its chapter does so under the
 * chapter's label, so a failure in a three-chapter scene says which third.
 *
 * @param label - A few words naming the capability this chapter shows.
 * @param stage - The stage that draws it.
 * @param config - What the chapter configures that stage with.
 * @param holdMs - Time held on the chapter's last frame before the next arrives.
 * @returns The chapter, ready for a sequence.
 * @example A two-chapter story
 * ```ts
 * config: {
 *   segments: [
 *     chapter('Detect', gaugeStage, { groups: [...] }, 900),
 *     chapter('Stage, then commit', panelStage, { panels: [...] }),
 *   ],
 * }
 * ```
 */
export function chapter<TConfig>(label: string, stage: Stage<TConfig>, config: TConfig, holdMs = 0): SequenceSegment {
  return {
    label,
    holdMs,
    styles: (profile, theme) => inChapter(label, () => stage.styles(config, profile, theme)),
    durationMs: (profile) => inChapter(label, () => stage.durationMs(config, profile)),
    frame: (profile, theme, atMs) => inChapter(label, () => stage.frame({ config, profile, theme, atMs })),
  }
}
