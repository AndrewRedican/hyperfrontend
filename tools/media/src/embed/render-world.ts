import type { Mark } from '../models/banner'
import type { MediaTheme } from '../models/theme'
import type { EmbedLayout, Rect } from './layout'
import type { EmbedState } from './timeline'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, lerp } from '../lib/motion'
import { renderApiChip } from '../stage/api-chip'
import { lerpRect } from './layout'

/** Fraction of its content width the feature's bars take before the host announces the size. */
const GUESS_WIDTH = 0.42

/** Relative widths of the feature's three content bars once it has been told its size. */
const FEATURE_BAR_WIDTHS: readonly number[] = [0.92, 0.7, 0.82]

/** Padding inside the feature window's content. */
const FEATURE_PAD_PX = 8

/**
 * Format a length for an inline style.
 *
 * @param value - The length in CSS pixels.
 * @returns The length with one decimal and its unit.
 */
function px(value: number): string {
  return `${value.toFixed(1)}px`
}

/**
 * The inline style that places a window.
 *
 * @param rect - Where the window sits.
 * @returns A `left`, `top`, `width` and `height` declaration.
 */
function placement(rect: Rect): string {
  return `left:${px(rect.x)};top:${px(rect.y)};width:${px(rect.w)};height:${px(rect.h)}`
}

/**
 * The three chrome buttons every window carries.
 *
 * @returns Markup for the buttons.
 */
function renderDots(): string {
  return '<i class="em-dot em-dot--0"></i><i class="em-dot em-dot--1"></i><i class="em-dot em-dot--2"></i>'
}

/**
 * The eye in the feature's chrome that says whether its tab is visible.
 *
 * @param closed - Whether the tab is hidden.
 * @param reveal - How far the glyph has faded in.
 * @returns Inline SVG, or nothing before the first visibility change.
 */
function renderEye(closed: boolean, reveal: number): string {
  if (reveal <= 0) {
    return ''
  }
  const shape = closed
    ? '<path d="M1 4 Q7 10 13 4"/><path d="M3.5 7.2 L2.5 9.2 M7 8.4 V10.6 M10.5 7.2 L11.5 9.2"/>'
    : '<path d="M1 5 Q7 -1 13 5 Q7 11 1 5 Z"/><circle cx="7" cy="5" r="2" fill="currentColor" stroke="none"/>'
  return `<svg class="em-eye" viewBox="0 0 14 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="opacity:${reveal.toFixed(3)}" aria-hidden="true">${shape}</svg>`
}

/**
 * Draw the host page: chrome, placeholder content and, when the script closes, the close button.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @param mark - The package's mark, for the close chip.
 * @param closeApi - Name of the close call.
 * @returns Markup for the host window.
 */
export function renderHost(layout: EmbedLayout, state: EmbedState, theme: MediaTheme, mark: Mark, closeApi: string): string {
  const border = state.gate?.partial === true ? theme.tones.warning : theme.border
  const close = state.closeChip
    ? `<span class="em-close" style="transform:scale(${(1 - 0.1 * state.press).toFixed(3)})">${renderApiChip(closeApi, mark)}</span>`
    : ''
  const bars = layout.hostBars
    .map(
      (bar) => `<div class="em-bar" style="${placement({ x: bar.x - layout.host.x, y: bar.y - layout.host.y, w: bar.w, h: bar.h })}"></div>`
    )
    .join('')
  return `<div class="em-win em-host" style="${placement(layout.host)};border-color:${border}"><div class="em-chrome">${renderDots()}${close}</div>${bars}</div>`
}

/**
 * Draw the feature window wherever it is: at its origin, sliding, seated, dimmed or fading out.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @param mark - The package's mark, for the feature chip.
 * @param featureApi - Name of the feature-side factory.
 * @returns Markup for the feature window, or nothing once it has gone.
 */
export function renderFeature(layout: EmbedLayout, state: EmbedState, theme: MediaTheme, mark: Mark, featureApi: string): string {
  if (state.presence <= 0) {
    return ''
  }
  const rect = lerpRect(layout.origin, layout.seat, state.seat)
  const opacity = state.presence * (1 - 0.55 * state.dim)
  const border = state.ring?.danger === true ? theme.tones.danger : state.gate?.partial === true ? theme.tones.warning : theme.border
  const contentWidth = rect.w - 2 * FEATURE_PAD_PX
  const stretch = lerp(GUESS_WIDTH, 1, state.fit)
  const bars = FEATURE_BAR_WIDTHS.map(
    (base, index) =>
      `<div class="em-bar" style="${placement({ x: FEATURE_PAD_PX, y: layout.featureChromePx + 34 + index * 12, w: contentWidth * base * stretch, h: 5 })}"></div>`
  ).join('')
  return `<div class="em-win em-feature" style="${placement(rect)};opacity:${opacity.toFixed(3)};border-color:${border}"><div class="em-chrome em-chrome--sm">${renderDots()}${renderEye(state.eyeClosed, state.eye)}</div><div class="em-chip-row">${renderApiChip(featureApi, mark)}</div>${bars}</div>`
}

/**
 * Draw the slot: dashed while empty, solid while a feature is seated in it.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @returns Markup for the slot.
 */
export function renderSlot(layout: EmbedLayout, state: EmbedState): string {
  const solid = state.seat >= 1 && state.presence > 0.5
  return `<div class="em-slot${solid ? ' em-slot--solid' : ''}" style="${placement(layout.slot)}"></div>`
}

/**
 * Draw the host-side API chip above the slot.
 *
 * @param layout - Where everything sits.
 * @param mark - The package's mark.
 * @param shellApi - Name of the host-side factory.
 * @returns Markup for the chip.
 */
export function renderShellChip(layout: EmbedLayout, mark: Mark, shellApi: string): string {
  return `<div class="em-shell-chip" style="left:${px(layout.shellChip.x)};top:${px(layout.shellChip.y)}">${renderApiChip(shellApi, mark)}</div>`
}

/**
 * Draw the dimension bracket the host measures the slot with.
 *
 * A horizontal rule above the slot and a vertical one to its right draw
 * together, and the announced size lands above once they are most of the
 * way drawn.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the bracket, or nothing before the announcement.
 */
export function renderBracket(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  if (state.present === undefined || state.bracket <= 0) {
    return ''
  }
  const { seat, bracketY } = layout
  const p = state.bracket
  const xEnd = seat.x + seat.w * p
  const sideX = seat.x + seat.w + 9
  const yEnd = seat.y + seat.h * p
  const endTicks = p >= 1 ? `M ${xEnd.toFixed(1)} ${bracketY - 4} V ${bracketY + 4} M ${sideX - 4} ${yEnd.toFixed(1)} H ${sideX + 4}` : ''
  const d = `M ${seat.x} ${bracketY - 4} V ${bracketY + 4} M ${seat.x} ${bracketY} H ${xEnd.toFixed(1)} M ${sideX - 4} ${seat.y} H ${sideX + 4} M ${sideX} ${seat.y} V ${yEnd.toFixed(1)} ${endTicks}`
  const label = `${state.present.width} × ${state.present.height}`
  const labelOpacity = clamp01((p - 0.5) / 0.5)
  return `<path d="${d}" fill="none" stroke="${theme.text.muted}" stroke-width="1.5" stroke-linecap="round"/><text x="${seat.x + seat.w / 2}" y="${bracketY - 8}" class="em-text em-dim" text-anchor="middle" opacity="${labelOpacity.toFixed(3)}">${escapeHtml(label)}</text>`
}

/**
 * Draw the receipt that pops into the host when an application message lands.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the receipt, or nothing before one lands.
 */
export function renderReceipt(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  if (state.receipt <= 0) {
    return ''
  }
  const scale = 0.6 + 0.4 * state.receipt
  return `<g transform="translate(${layout.landing.x} ${layout.landing.y}) scale(${scale.toFixed(3)})" opacity="${state.receipt.toFixed(3)}"><rect x="-30" y="-19" width="60" height="38" rx="6" fill="${theme.surfaceRaised}" stroke="${theme.border}" stroke-width="1.5"/><path d="M -21 0 L -16 5 L -8 -5" fill="none" stroke="${theme.tones.success}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="0" y="-6" width="22" height="4" rx="2" fill="${theme.border}"/><rect x="0" y="2" width="15" height="4" rx="2" fill="${theme.border}"/></g>`
}

/**
 * Draw the active-border flash both windows give when the wire goes live.
 *
 * @param layout - Where everything sits.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the outlines, or nothing while there is no flash.
 */
export function renderFlash(layout: EmbedLayout, state: EmbedState, theme: MediaTheme): string {
  if (state.flash <= 0) {
    return ''
  }
  const outline = (rect: Rect): string =>
    `<rect x="${rect.x.toFixed(1)}" y="${rect.y.toFixed(1)}" width="${rect.w.toFixed(1)}" height="${rect.h.toFixed(1)}" rx="8" fill="none" stroke="${theme.borderActive}" stroke-width="2.5" opacity="${state.flash.toFixed(3)}"/>`
  return `${outline(layout.host)}${outline(lerpRect(layout.origin, layout.seat, state.seat))}`
}
