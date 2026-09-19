import type { EcosystemChip, EcosystemCluster, EcosystemConfig } from '../models/ecosystem'
import type { MediaProfile } from '../models/profile'
import type { Rect } from '../stage/geometry'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { figureMetrics } from '../stage/figure'

/** A chip placed in the frame. */
export interface ChipBox {
  /** The package the chip stands for. */
  chip: EcosystemChip
  /** Horizontal centre. */
  x: number
  /** Vertical centre. */
  y: number
  /** Width. */
  w: number
  /** Height. */
  h: number
  /** Whether this is the hub, drawn a size larger. */
  large: boolean
}

/** A cluster placed in the frame. */
export interface ClusterBox {
  /** The outline. */
  rect: Rect
  /** The small capitals at the outline's top left. */
  caption: string
  /** The chips inside it. */
  chips: readonly ChipBox[]
}

/** Where everything in the figure sits. */
export interface EcosystemLayout {
  /** The package at the centre. */
  hub: ChipBox
  /** The column under it. */
  spine: readonly ChipBox[]
  /** Vertical position of the small capitals under the spine. */
  spineCaptionY: number
  /** The cluster on the left. */
  left: ClusterBox
  /** The cluster on the right. */
  right: ClusterBox
  /** The cluster along the foot. */
  foot: ClusterBox
  /** Font size of a chip's name. */
  chipPx: number
  /** Font size of the hub's name. */
  hubPx: number
  /** Side of the mark inside a chip. */
  markPx: number
}

/** Height of a chip. */
const CHIP_H = 30

/** Height of the hub's chip. */
const HUB_H = 40

/** Horizontal gap between chips in a row. */
const ROW_GAP = 12

/** Vertical step between chips in a column, leaving room for a note under each. */
const COLUMN_STEP = 50

/**
 * How wide a chip is, from its name.
 *
 * The mono face advances six tenths of an em per character, so a chip's
 * width follows from its name's length without measuring anything.
 *
 * @param name - What the chip reads.
 * @param fontPx - Font size the name is set in.
 * @param markPx - Side of the mark beside it.
 * @returns Width in CSS pixels.
 */
function chipWidth(name: string, fontPx: number, markPx: number): number {
  return round(markPx + 6 + name.length * fontPx * 0.6 + 20)
}

/**
 * Place a cluster's chips in a column, centred in its outline.
 *
 * @param cluster - The chips and their caption.
 * @param rect - The outline they are placed inside.
 * @param chipPx - Font size of a chip's name.
 * @param markPx - Side of the mark inside a chip.
 * @returns The same chips, each with a position and a width.
 */
function placeColumn(cluster: EcosystemCluster, rect: Rect, chipPx: number, markPx: number): ClusterBox {
  const top = rect.y + 46
  return {
    rect,
    caption: cluster.caption,
    chips: cluster.chips.map((chip, index) => ({
      chip,
      x: rect.x + rect.w / 2,
      y: top + index * COLUMN_STEP + CHIP_H / 2,
      w: chipWidth(chip.name, chipPx, markPx),
      h: CHIP_H,
      large: false,
    })),
  }
}

/**
 * Place a cluster's chips in rows, each row centred in the outline and
 * filled greedily until the next chip would not fit.
 *
 * @param cluster - The chips and their caption.
 * @param rect - The outline they are placed inside.
 * @param chipPx - Font size of a chip's name.
 * @param markPx - Side of the mark inside a chip.
 * @returns The same chips, each with a position and a width.
 */
function placeRows(cluster: EcosystemCluster, rect: Rect, chipPx: number, markPx: number): ClusterBox {
  const widths = cluster.chips.map((chip) => chipWidth(chip.name, chipPx, markPx))
  const limit = rect.w - 32
  const rows: number[][] = []
  let row: number[] = []
  let used = 0
  widths.forEach((width, index) => {
    const next = used === 0 ? width : used + ROW_GAP + width
    if (next > limit && row.length > 0) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push(index)
    used = used === 0 ? width : used + ROW_GAP + width
  })
  if (row.length > 0) {
    rows.push(row)
  }
  const chips: ChipBox[] = []
  const rowStep = CHIP_H + 16
  const firstY = rect.y + 46 + CHIP_H / 2
  rows.forEach((indices, rowIndex) => {
    const total = indices.reduce((sum, index) => sum + (widths[index] ?? 0), 0) + (indices.length - 1) * ROW_GAP
    let x = rect.x + (rect.w - total) / 2
    for (const index of indices) {
      const chip = cluster.chips[index]
      const width = widths[index] ?? 0
      if (chip !== undefined) {
        chips.push({ chip, x: x + width / 2, y: firstY + rowIndex * rowStep, w: width, h: CHIP_H, large: false })
      }
      x += width + ROW_GAP
    }
  })
  return { rect, caption: cluster.caption, chips }
}

/**
 * Lay the figure out for one profile.
 *
 * The hub sits at the top centre with its spine hanging under it; the two
 * side clusters flank the spine at the same height; the foot cluster runs
 * the width of the frame under all of them, which is where a foundation
 * belongs.
 *
 * @param config - The ecosystem as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
export function ecosystemLayout(config: EcosystemConfig, profile: MediaProfile): EcosystemLayout {
  const metrics = figureMetrics(profile)
  const chipPx = metrics.monoPx + 0.5
  const hubPx = metrics.monoPx + 3
  const markPx = 16
  const centreX = profile.width / 2
  // why: a figure with no caption and no note has nothing above the hub to make room for, so the hub rises and the frame can be that much shorter
  const hubY = metrics.insetPx + (config.caption === '' && config.note === '' ? 44 : 98)
  const spineTop = hubY + HUB_H / 2 + 44
  const sideTop = hubY + 32
  const sideW = 262
  const sideH = 224
  const footTop = sideTop + sideH + 26
  const footH = profile.height - metrics.insetPx - footTop
  return {
    hub: { chip: config.hub, x: centreX, y: hubY, w: chipWidth(config.hub.name, hubPx, markPx + 6), h: HUB_H, large: true },
    spine: config.spine.map((chip, index) => ({
      chip,
      x: centreX,
      y: spineTop + index * (CHIP_H + 28) + CHIP_H / 2,
      w: chipWidth(chip.name, chipPx, markPx),
      h: CHIP_H,
      large: false,
    })),
    spineCaptionY: spineTop + config.spine.length * (CHIP_H + 28) + 6,
    left: placeColumn(config.left, { x: metrics.insetPx, y: sideTop, w: sideW, h: sideH }, chipPx, markPx),
    right: placeColumn(config.right, { x: profile.width - metrics.insetPx - sideW, y: sideTop, w: sideW, h: sideH }, chipPx, markPx),
    foot: placeRows(config.foot, { x: metrics.insetPx, y: footTop, w: profile.width - metrics.insetPx * 2, h: footH }, chipPx, markPx),
    chipPx,
    hubPx,
    markPx,
  }
}

/**
 * Find a placed chip by the package's name.
 *
 * @param layout - Where everything sits.
 * @param name - The package's name without its scope.
 * @returns The chip, or undefined when no cluster holds it.
 */
export function findChip(layout: EcosystemLayout, name: string): ChipBox | undefined {
  const all = [layout.hub, ...layout.spine, ...layout.left.chips, ...layout.right.chips, ...layout.foot.chips]
  return all.find((box) => box.chip.name === name)
}
