import type { ComposeConfig, ComposeFeature } from '../models/compose'
import type { MediaTheme } from '../models/theme'
import type { Point, Rect } from '../stage/geometry'
import type { ComposeLayout } from './layout'
import type { ComposeState, DotState } from './timeline'
import { hypot } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMarkAt } from '../banner/mark'
import { alongPolyline, lerpRect } from '../embed/layout'
import { escapeHtml } from '../lib/escape-html'

/** Relative widths of a feature window's placeholder lines. */
const FEATURE_BAR_WIDTHS: readonly number[] = [0.58, 0.82, 0.4]

/** Padding inside a feature window's content. */
const FEATURE_PAD_PX = 8

/** Radius of a message dot. */
const DOT_R = 4.5

/** Radius of the hub. */
const HUB_R = 12

/** Font size of a message label, matching the stage's text size. */
const LABEL_PX = 10.5

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
  return '<i class="cp-dot cp-dot--0"></i><i class="cp-dot cp-dot--1"></i><i class="cp-dot cp-dot--2"></i>'
}

/**
 * Draw the host page: chrome, its own header, its rail, and the empty slots.
 *
 * @param layout - Where everything sits.
 * @param config - The composition as the scene configured it.
 * @param state - What is happening at this instant.
 * @returns Markup for the host window and its slots.
 */
export function renderHost(layout: ComposeLayout, config: ComposeConfig, state: ComposeState): string {
  const inside = (rect: Rect): Rect => ({ x: rect.x - layout.host.x, y: rect.y - layout.host.y, w: rect.w, h: rect.h })
  const bars = [layout.navBar, ...layout.railBars].map((bar) => `<div class="cp-bar" style="${placement(inside(bar))}"></div>`).join('')
  const slots = layout.slots
    .map((slot, index) => {
      const seated = (state.features[index]?.seat ?? 0) >= 1
      return `<div class="cp-slot${seated ? ' cp-slot--solid' : ''}" style="${placement(slot)}"></div>`
    })
    .join('')
  return `<div class="cp-win cp-host" style="${placement(layout.host)}"><div class="cp-chrome">${renderDots()}<span class="cp-pill">${escapeHtml(config.hostOrigin)}</span></div>${bars}</div>${slots}`
}

/**
 * Draw one feature window wherever it is: at its origin, sliding, or seated.
 *
 * @param layout - Where everything sits.
 * @param index - Which feature, in slot order.
 * @param feature - The feature as the scene configured it.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns Markup for the feature window.
 */
export function renderFeatureWindow(
  layout: ComposeLayout,
  index: number,
  feature: ComposeFeature,
  state: ComposeState,
  theme: MediaTheme
): string {
  const origin = layout.origins[index]
  const seat = layout.seats[index]
  const own = state.features[index]
  if (origin === undefined || seat === undefined || own === undefined) {
    return ''
  }
  const rect = lerpRect(origin, seat, own.seat)
  const contentWidth = rect.w - 2 * FEATURE_PAD_PX
  const bars = FEATURE_BAR_WIDTHS.map(
    (width, row) =>
      `<div class="cp-bar" style="${placement({ x: FEATURE_PAD_PX, y: layout.featureChromePx + 34 + row * 12, w: contentWidth * width, h: 5 })}"></div>`
  ).join('')
  const border = own.flash > 0 ? theme.borderActive : theme.border
  // why: the application is loaded into the host, not moved there, so once it starts to dock its origin keeps a faint outline saying it is still served from its own address
  const ghost =
    own.seat > 0
      ? `<div class="cp-ghost" style="${placement(origin)};opacity:${own.seat.toFixed(3)}"><span class="cp-pill cp-pill--ghost">${escapeHtml(feature.origin)}</span></div>`
      : ''
  return `${ghost}<div class="cp-win cp-feature" style="${placement(rect)};border-color:${border}"><div class="cp-chrome cp-chrome--sm">${renderDots()}<span class="cp-pill">${escapeHtml(feature.origin)}</span></div><span class="cp-tag">${escapeHtml(feature.framework)}</span>${bars}</div>`
}

/**
 * The part of a polyline drawn so far.
 *
 * @param points - The corners, in order.
 * @param fraction - How much of the total length is drawn, from 0 to 1.
 * @returns The `points` attribute of the drawn part, or an empty string for none.
 */
function partialPolyline(points: readonly Point[], fraction: number): string {
  if (fraction <= 0) {
    return ''
  }
  const total = points.slice(1).reduce((sum, point, index) => {
    const previous = points[index] ?? point
    return sum + hypot(point.x - previous.x, point.y - previous.y)
  }, 0)
  let remaining = fraction * total
  const drawn: Point[] = []
  const first = points[0]
  if (first !== undefined) {
    drawn.push(first)
  }
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (start === undefined || end === undefined) {
      break
    }
    const length = hypot(end.x - start.x, end.y - start.y)
    if (remaining >= length) {
      drawn.push(end)
      remaining -= length
      continue
    }
    const t = length === 0 ? 1 : remaining / length
    drawn.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
    break
  }
  return drawn.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

/**
 * Draw a message dot and the action name beside it.
 *
 * @param layout - Where everything sits.
 * @param dot - The message and how far along it is.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the dot, or nothing when its wire is unplaced.
 */
function renderDot(layout: ComposeLayout, dot: DotState, theme: MediaTheme): string {
  const wire = layout.wires[dot.message.feature]
  if (wire === undefined) {
    return ''
  }
  const at = alongPolyline(wire, dot.message.direction === 'to-feature' ? dot.t : 1 - dot.t)
  const labelW = dot.message.label.length * LABEL_PX * 0.62 + 12
  const labelX = at.x + 9
  const labelY = at.y - 22
  // why: the label rides above the dot on a plate of its own, so it stays legible where the wire turns a corner under it
  const plate = `<rect x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" width="${labelW.toFixed(1)}" height="${LABEL_PX + 8}" rx="4" fill="${theme.surfaceRaised}" stroke="${theme.border}" stroke-width="1"/>`
  return `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${DOT_R * 2.2}" fill="${theme.accent}" opacity="0.18"/><circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${DOT_R}" fill="${theme.accent}"/>${plate}<text class="cp-text" x="${(labelX + 6).toFixed(1)}" y="${(labelY + LABEL_PX + 1).toFixed(1)}">${escapeHtml(dot.message.label)}</text>`
}

/**
 * Draw everything that runs over the windows: the wires, the hub, the dots and the flashes.
 *
 * @param layout - Where everything sits.
 * @param config - The composition as the scene configured it.
 * @param state - What is happening at this instant.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the overlay's contents.
 */
export function renderOverlay(layout: ComposeLayout, config: ComposeConfig, state: ComposeState, theme: MediaTheme): string {
  const wires = layout.wires
    .map((wire, index) => {
      const own = state.features[index]
      const points = partialPolyline(wire, own?.wire ?? 0)
      if (points === '') {
        return ''
      }
      const end = wire[wire.length - 1]
      const glow =
        own !== undefined && own.glow > 0 && end !== undefined
          ? `<circle cx="${end.x}" cy="${end.y}" r="${(6 + 8 * own.glow).toFixed(1)}" fill="${theme.accent}" opacity="${(0.35 * own.glow).toFixed(3)}"/>`
          : ''
      const socket =
        own !== undefined && own.wire >= 1 && end !== undefined
          ? `<circle cx="${end.x}" cy="${end.y}" r="4" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="1.8"/>`
          : ''
      return `<polyline points="${points}" fill="none" stroke="${theme.accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${glow}${socket}`
    })
    .join('')
  const flashes = layout.seats
    .map((seat, index) => {
      const flash = state.features[index]?.flash ?? 0
      return flash > 0
        ? `<rect x="${seat.x - 3}" y="${seat.y - 3}" width="${seat.w + 6}" height="${seat.h + 6}" rx="9" fill="none" stroke="${theme.borderActive}" stroke-width="2.5" opacity="${flash.toFixed(3)}"/>`
        : ''
    })
    .join('')
  const hubGlow =
    state.hubGlow > 0
      ? `<circle cx="${layout.hub.x}" cy="${layout.hub.y}" r="${(HUB_R + 10 * state.hubGlow).toFixed(1)}" fill="${theme.accent}" opacity="${(0.35 * state.hubGlow).toFixed(3)}"/>`
      : ''
  const hub = `${hubGlow}<circle cx="${layout.hub.x}" cy="${layout.hub.y}" r="${HUB_R}" fill="${theme.surfaceRaised}" stroke="${state.hubLive ? theme.accent : theme.border}" stroke-width="1.8"/>${renderMarkAt(config.mark, layout.hub.x, layout.hub.y, 14, state.hubLive ? theme.accent : theme.text.muted)}`
  const dots = state.dots.map((dot) => renderDot(layout, dot, theme)).join('')
  return `${wires}${hub}${flashes}${dots}`
}
