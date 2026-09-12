import type { LifecycleConfig, LifecyclePanel } from '../models/lifecycle'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { ceil, floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** The part of a cycle the widget is on the page for. */
const MOUNTED_SHARE = 0.58

/** How long the widget takes to appear or vanish. */
const FADE_MS = 160

/** How long the closing caption takes to arrive after the last cycle. */
const CAPTION_DELAY_MS = 300

/** When the first mount happens if the scene names no moment. */
const DEFAULT_START_MS = 400

/** The eye a resize observer is drawn as. */
const EYE = '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'

/** The bolt a listener is drawn as. */
const BOLT = '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>'

/** How the frame is sized for the surface it is being drawn for. */
interface LifecycleMetrics {
  /** Margin between the content and the edge of the frame. */
  insetPx: number
  /** Gap between the pages. */
  gapPx: number
  /** Padding inside a page. */
  padPx: number
  /** Height of the head tray. */
  trayPx: number
  /** Side of a chip in the tray. */
  chipPx: number
  /** Side of a glyph. */
  glyphPx: number
  /** Height of the widget card. */
  widgetPx: number
  /** Font size of a page's title. */
  titlePx: number
  /** Font size of the counts line. */
  countPx: number
  /** Font size of the note under a page. */
  notePx: number
  /** Font size of the heading. */
  headingPx: number
  /** Font size of the caption. */
  captionPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function lifecycleMetrics(profile: MediaProfile): LifecycleMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    gapPx: wide ? 18 : 14,
    padPx: wide ? 12 : 10,
    trayPx: wide ? 30 : 26,
    chipPx: wide ? 20 : 17,
    glyphPx: wide ? 18 : 16,
    widgetPx: wide ? 64 : 54,
    titlePx: wide ? 12 : 11,
    countPx: wide ? 12 : 11,
    notePx: wide ? 12 : 11,
    headingPx: wide ? 15 : 14,
    captionPx: wide ? 14 : 12.5,
  }
}

/** What one page holds at one instant. */
interface PageState {
  /** How many mounts have begun. */
  mounts: number
  /** How visible the widget is, from 0 to 1. */
  widget: number
  /** How many stylesheets are in the head. */
  styles: number
  /** How many observers are alive. */
  observers: number
  /** How many listeners are attached. */
  listeners: number
}

/**
 * Work out what a page holds at one instant.
 *
 * A page that calls its teardowns holds one of everything while the widget is
 * mounted and nothing when it is not. A page that does not holds one of
 * everything per mount so far, whether or not the widget is still there,
 * because nothing in it was ever given the means to let go.
 *
 * @param panel - The page.
 * @param config - The frame as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The counts and the widget's visibility.
 */
function stateAt(panel: LifecyclePanel, config: LifecycleConfig, atMs: number): PageState {
  const elapsed = atMs - (config.startMs ?? DEFAULT_START_MS)
  if (elapsed < 0) {
    return { mounts: 0, widget: 0, styles: 0, observers: 0, listeners: 0 }
  }
  const cycle = min(config.cycles - 1, floor(elapsed / config.cycleMs))
  const within = elapsed - cycle * config.cycleMs
  const mountedMs = config.cycleMs * MOUNTED_SHARE
  const mounted = cycle < config.cycles && within < mountedMs && elapsed < config.cycles * config.cycleMs
  const widget = mounted ? min(1, within / FADE_MS) : max(0, 1 - (within - mountedMs) / FADE_MS)
  const mounts = cycle + 1
  const alive = panel.teardown ? (mounted ? 1 : 0) : mounts
  return { mounts, widget, styles: alive, observers: alive, listeners: alive * config.listenersPerMount }
}

/**
 * When the last unmount has happened and nothing is still moving.
 *
 * @param config - The frame as the scene configured it.
 * @returns The offset at which the last cycle ends.
 */
function settledAt(config: LifecycleConfig): number {
  return (config.startMs ?? DEFAULT_START_MS) + config.cycles * config.cycleMs
}

/**
 * Draw one page at one instant.
 *
 * @param panel - The page.
 * @param config - The frame as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the page.
 */
function renderPanel(panel: LifecyclePanel, config: LifecycleConfig, metrics: LifecycleMetrics, theme: MediaTheme, atMs: number): string {
  const state = stateAt(panel, config, atMs)
  const leak = !panel.teardown
  const chips: string[] = []
  for (let index = 0; index < state.styles; index += 1) {
    chips.push(`<span class="lc-chip">&lt;style&gt;</span>`)
  }
  const glyph = (path: string, className: string): string =>
    `<svg class="lc-glyph ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
  // why: everything a mount left behind that is no longer attached to a widget is drawn as a ghost, so the leak is a thing on the page rather than a number under it
  const ghosts: string[] = []
  const stranded = leak ? state.observers - (state.widget > 0 ? 1 : 0) : 0
  for (let index = 0; index < stranded; index += 1) {
    ghosts.push(glyph(EYE, 'lc-glyph--ghost'))
    ghosts.push(glyph(BOLT, 'lc-glyph--ghost'))
  }
  const attached = state.widget > 0 ? `${glyph(EYE, 'lc-glyph--live')}${glyph(BOLT, 'lc-glyph--live')}` : ''
  const widgetStyle = `opacity:${state.widget.toFixed(3)}; transform: scale(${(0.92 + 0.08 * state.widget).toFixed(3)});`
  const tone = leak && state.mounts > 1 ? theme.tones.danger : theme.tones.success
  return `<div class="lc-page-wrap">
    <div class="lc-title">${escapeHtml(panel.title)}</div>
    <div class="lc-page">
      <div class="lc-tray"><span class="lc-tray-label">&lt;head&gt;</span>${chips.join('')}</div>
      <div class="lc-body">
        <div class="lc-widget" style="${widgetStyle}"><span class="lc-widget-label">widget</span>${attached}</div>
        <div class="lc-ghosts">${ghosts.join('')}</div>
      </div>
    </div>
    <div class="lc-counts" style="color:${tone}">&lt;style&gt; ${state.styles} · observers ${state.observers} · listeners ${state.listeners}</div>
    <div class="lc-note">${escapeHtml(panel.note)}</div>
  </div>`
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this frame.
 */
function lifecycleStyles(config: LifecycleConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = lifecycleMetrics(profile)
  return `
.lc-frame { position: absolute; inset: ${metrics.insetPx}px; display: flex; flex-direction: column; gap: ${metrics.gapPx * 0.8}px; }
.lc-heading { flex: none; font-size: ${metrics.headingPx}px; font-weight: 600; letter-spacing: -0.01em; color: ${theme.text.strong}; }
.lc-pages { flex: 1 1 auto; min-height: 0; display: flex; gap: ${metrics.gapPx}px; }
.lc-page-wrap { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: ${ceil(metrics.padPx * 0.6)}px; }
.lc-title { font-size: ${metrics.titlePx}px; font-weight: 600; letter-spacing: 0.02em; color: ${theme.text.muted}; }
.lc-page { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; border: 1px solid ${theme.border}; border-radius: 10px; background: ${theme.surface}; box-shadow: ${theme.shadow}; overflow: hidden; }
/* why: the tray grows to a second row rather than clipping, because the pile spilling over is the picture */
.lc-tray { flex: none; min-height: ${metrics.trayPx}px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px ${metrics.padPx}px; background: ${theme.chrome.bar}; border-bottom: 1px solid ${theme.rule}; font-family: ${theme.fonts.mono}; font-size: ${metrics.countPx - 1}px; }
.lc-tray-label { color: ${theme.text.faint}; margin-right: 4px; }
.lc-chip { display: inline-block; height: ${metrics.chipPx}px; line-height: ${metrics.chipPx}px; padding: 0 6px; border-radius: 5px; background: ${theme.accentSoft}; color: ${theme.accent}; font-size: ${metrics.countPx - 2}px; }
.lc-body { flex: 1 1 auto; min-height: 0; position: relative; padding: ${metrics.padPx}px; display: flex; flex-direction: column; gap: ${metrics.padPx}px; }
.lc-widget { height: ${metrics.widgetPx}px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px dashed ${theme.borderActive}; border-radius: 8px; background: ${theme.accentSoft}; color: ${theme.text.plain}; font-size: ${metrics.countPx}px; transform-origin: center; }
.lc-widget-label { font-family: ${theme.fonts.mono}; }
.lc-glyph { width: ${metrics.glyphPx}px; height: ${metrics.glyphPx}px; }
.lc-glyph--live { color: ${theme.accent}; }
.lc-glyph--ghost { color: ${theme.tones.danger}; opacity: 0.75; }
.lc-ghosts { flex: 1 1 auto; min-height: 0; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px; }
.lc-counts { font-family: ${theme.fonts.mono}; font-size: ${metrics.countPx}px; font-weight: 600; white-space: nowrap; }
.lc-note { font-size: ${metrics.notePx}px; color: ${theme.text.muted}; }
.lc-caption { flex: none; min-height: ${ceil(metrics.captionPx * 1.3)}px; font-size: ${metrics.captionPx}px; color: ${theme.tones.success}; }
`
}

/**
 * The same widget mounted and unmounted, on a page that lets go and one that
 * cannot.
 *
 * Both pages show the widget arriving and leaving, the stylesheet it put in
 * the head, and the observer and listener it attached. On one page those
 * leave with it. On the other they stay: the chips pile up in the head and
 * the observers and listeners are left on the page as ghosts, watching an
 * element that is gone. Six cycles is enough for the pile to be the picture.
 */
export const lifecycleStage: Stage<LifecycleConfig> = defineStage<LifecycleConfig>({
  id: 'lifecycle',

  styles: lifecycleStyles,

  durationMs(config: LifecycleConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = lifecycleMetrics(profile)
    const settled = settledAt(config)
    const pages = config.panels.map((panel) => renderPanel(panel, config, metrics, theme, atMs)).join('')
    const heading = config.heading === undefined ? '' : `<div class="lc-heading">${escapeHtml(config.heading)}</div>`
    const caption =
      config.caption === undefined
        ? ''
        : `<div class="lc-caption">${atMs >= settled + CAPTION_DELAY_MS ? escapeHtml(config.caption) : ''}</div>`
    return `<div class="lc-frame">${heading}<div class="lc-pages">${pages}</div>${caption}</div>`
  },
})
