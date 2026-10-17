import type { EcosystemChip, EcosystemCluster, EcosystemConfig } from '../models/ecosystem'
import type { MediaProfile } from '../models/profile'
import type { Rect } from '../stage/geometry'
import { ceil, floor, max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
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
  /** The cluster across the frame under the flanks, when the scene has one. */
  middle?: ClusterBox
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

/** Horizontal gap between chips in a row, and between columns in a grid. */
const ROW_GAP = 12

/** Vertical step between chips in a column, leaving room for a note under each. */
const COLUMN_STEP = 50

/** Vertical step between rows of a row-laid cluster, which carry no notes. */
const ROW_STEP = CHIP_H + 16

/** Room between a cluster's outline and the chips inside it, each side. */
const CLUSTER_PAD = 16

/** Room above a cluster's first chip, for its caption. */
const CLUSTER_HEAD = 46

/** Room under a cluster's last chip. */
const CLUSTER_FOOT = 18

/** The narrowest a flanking cluster is drawn, so a column of short names still reads as a region. */
const MIN_SIDE_W = 200

/** Vertical gap between stacked clusters. */
const CLUSTER_GAP = 26

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

/** A flanking cluster's chips arranged in columns, before they are placed. */
interface Grid {
  /** Width of each column: its widest chip. */
  columnWidths: readonly number[]
  /** Width of every chip, in cluster order. */
  widths: readonly number[]
  /** How many chips each column holds. */
  rows: number
  /** Width of the whole grid. */
  w: number
}

/**
 * Arrange a flanking cluster's chips in the columns it asks for, reading
 * down each column before moving to the next.
 *
 * @param cluster - The chips and how many columns they list in.
 * @param chipPx - Font size of a chip's name.
 * @param markPx - Side of the mark inside a chip.
 * @returns The columns and their widths.
 */
function gridOf(cluster: EcosystemCluster, chipPx: number, markPx: number): Grid {
  const columns = max(1, cluster.columns ?? 1)
  const rows = ceil(cluster.chips.length / columns)
  const widths = cluster.chips.map((chip) => chipWidth(chip.name, chipPx, markPx))
  const columnWidths: number[] = []
  widths.forEach((width, index) => {
    const column = floor(index / rows)
    columnWidths[column] = max(columnWidths[column] ?? 0, width)
  })
  const w = columnWidths.reduce((sum, width) => sum + width, 0) + (columnWidths.length - 1) * ROW_GAP
  return { columnWidths, widths, rows, w }
}

/**
 * How wide a flanking cluster's outline has to be for its grid.
 *
 * @param grid - The arranged columns.
 * @returns Width in CSS pixels.
 */
function sideWidth(grid: Grid): number {
  return max(MIN_SIDE_W, grid.w + CLUSTER_PAD * 2)
}

/**
 * How tall a flanking cluster's outline has to be for its grid.
 *
 * @param grid - The arranged columns.
 * @returns Height in CSS pixels.
 */
function sideHeight(grid: Grid): number {
  return CLUSTER_HEAD + grid.rows * COLUMN_STEP - (COLUMN_STEP - CHIP_H) + CLUSTER_FOOT
}

/**
 * Place a flanking cluster's chips in their columns, the grid centred in the
 * outline and each chip against the left of its column, so a column reads as
 * a list.
 *
 * @param cluster - The chips and their caption.
 * @param grid - The arranged columns.
 * @param rect - The outline they are placed inside.
 * @returns The same chips, each with a position and a width.
 */
function placeGrid(cluster: EcosystemCluster, grid: Grid, rect: Rect): ClusterBox {
  const top = rect.y + CLUSTER_HEAD
  let x = rect.x + (rect.w - grid.w) / 2
  const columnX: number[] = []
  for (const width of grid.columnWidths) {
    columnX.push(x)
    x += width + ROW_GAP
  }
  return {
    rect,
    caption: cluster.caption,
    chips: cluster.chips.map((chip, index) => {
      const column = floor(index / grid.rows)
      const width = grid.widths[index] ?? 0
      return {
        chip,
        x: (columnX[column] ?? rect.x) + width / 2,
        y: top + (index % grid.rows) * COLUMN_STEP + CHIP_H / 2,
        w: width,
        h: CHIP_H,
        large: false,
      }
    }),
  }
}

/**
 * Split chips into rows: as few as fit the width, then filled evenly, so a
 * cluster that needs two rows is drawn as two rows of the same length rather
 * than a full row with a straggler under it.
 *
 * @param widths - Width of every chip, in order.
 * @param limit - Width a row may fill.
 * @returns Chip indices, row by row.
 */
function balancedRows(widths: readonly number[], limit: number): number[][] {
  let count = 1
  let used = 0
  widths.forEach((width, index) => {
    const next = index === 0 ? width : used + ROW_GAP + width
    if (next > limit && used > 0) {
      count += 1
      used = width
    } else {
      used = next
    }
  })
  const perRow = ceil(widths.length / count)
  const rows: number[][] = []
  for (let start = 0; start < widths.length; start += perRow) {
    rows.push(widths.slice(start, start + perRow).map((_unused, offset) => start + offset))
  }
  return rows
}

/**
 * How tall a row-laid cluster's outline has to be for its rows.
 *
 * @param rows - How many rows it needs.
 * @returns Height in CSS pixels.
 */
function rowsHeight(rows: number): number {
  return CLUSTER_HEAD + rows * ROW_STEP - (ROW_STEP - CHIP_H) + CLUSTER_FOOT
}

/**
 * Place a cluster's chips in rows, each row centred in the outline.
 *
 * @param cluster - The chips and their caption.
 * @param rect - The outline they are placed inside.
 * @param chipPx - Font size of a chip's name.
 * @param markPx - Side of the mark inside a chip.
 * @returns The same chips, each with a position and a width.
 */
function placeRows(cluster: EcosystemCluster, rect: Rect, chipPx: number, markPx: number): ClusterBox {
  const widths = cluster.chips.map((chip) => chipWidth(chip.name, chipPx, markPx))
  const rows = balancedRows(widths, rect.w - CLUSTER_PAD * 2)
  const chips: ChipBox[] = []
  const firstY = rect.y + CLUSTER_HEAD + CHIP_H / 2
  rows.forEach((indices, rowIndex) => {
    const total = indices.reduce((sum, index) => sum + (widths[index] ?? 0), 0) + (indices.length - 1) * ROW_GAP
    let x = rect.x + (rect.w - total) / 2
    for (const index of indices) {
      const chip = cluster.chips[index]
      const width = widths[index] ?? 0
      if (chip !== undefined) {
        chips.push({ chip, x: x + width / 2, y: firstY + rowIndex * ROW_STEP, w: width, h: CHIP_H, large: false })
      }
      x += width + ROW_GAP
    }
  })
  return { rect, caption: cluster.caption, chips }
}

/**
 * How many rows a row-laid cluster needs across a width.
 *
 * @param cluster - The chips to lay out and their caption.
 * @param w - Width of the outline they are placed inside.
 * @param chipPx - Font size of a chip's name.
 * @param markPx - Side of the mark inside a chip.
 * @returns How many rows the chips take.
 */
function rowCount(cluster: EcosystemCluster, w: number, chipPx: number, markPx: number): number {
  return balancedRows(
    cluster.chips.map((chip) => chipWidth(chip.name, chipPx, markPx)),
    w - CLUSTER_PAD * 2
  ).length
}

/**
 * Lay the figure out for one profile.
 *
 * The two flanking clusters take the width their columns need and stand at
 * the same height, the taller of the two; the hub and its spine stand
 * centred in the room between them, so the column reads as theirs whatever
 * the flanks weigh. A middle cluster, when the scene has one, runs the width
 * of the frame under the flanks, and the foot cluster runs under everything,
 * which is where a foundation belongs.
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
  const inset = metrics.insetPx
  // why: a figure with no caption and no note has nothing above the hub to make room for, so the hub rises and the frame can be that much shorter
  const hubY = inset + (config.caption === '' && config.note === '' ? 44 : 98)
  const spineTop = hubY + HUB_H / 2 + 44
  const sideTop = hubY + 32
  const leftGrid = gridOf(config.left, chipPx, markPx)
  const rightGrid = gridOf(config.right, chipPx, markPx)
  const sideH = max(sideHeight(leftGrid), sideHeight(rightGrid))
  const leftRect = { x: inset, y: sideTop, w: sideWidth(leftGrid), h: sideH }
  const rightW = sideWidth(rightGrid)
  const rightRect = { x: profile.width - inset - rightW, y: sideTop, w: rightW, h: sideH }
  const centreX = round((leftRect.x + leftRect.w + rightRect.x) / 2)
  const fullW = profile.width - inset * 2
  let nextTop = sideTop + sideH + CLUSTER_GAP
  let middle: ClusterBox | undefined
  if (config.middle !== undefined) {
    const middleH = rowsHeight(rowCount(config.middle, fullW, chipPx, markPx))
    middle = placeRows(config.middle, { x: inset, y: nextTop, w: fullW, h: middleH }, chipPx, markPx)
    nextTop += middleH + CLUSTER_GAP
  }
  const footH = profile.height - inset - nextTop
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
    left: placeGrid(config.left, leftGrid, leftRect),
    right: placeGrid(config.right, rightGrid, rightRect),
    middle,
    foot: placeRows(config.foot, { x: inset, y: nextTop, w: fullW, h: footH }, chipPx, markPx),
    chipPx,
    hubPx,
    markPx,
  }
}

/**
 * The frame height a figure needs for its content, for a scene to size its
 * profile by rather than guess.
 *
 * @param config - The ecosystem as the scene configured it.
 * @param profile - The presentation target, whose width and inset decide the rows.
 * @returns Height in CSS pixels, inset included.
 * @example Sizing the readme figure to its content
 * ```ts
 * profile: readmeProfile(ecosystemHeight(config, readmeProfile(0)))
 * ```
 */
export function ecosystemHeight(config: EcosystemConfig, profile: MediaProfile): number {
  const metrics = figureMetrics(profile)
  const chipPx = metrics.monoPx + 0.5
  const markPx = 16
  const inset = metrics.insetPx
  const hubY = inset + (config.caption === '' && config.note === '' ? 44 : 98)
  const sideH = max(sideHeight(gridOf(config.left, chipPx, markPx)), sideHeight(gridOf(config.right, chipPx, markPx)))
  const fullW = profile.width - inset * 2
  let bottom = hubY + 32 + sideH
  if (config.middle !== undefined) {
    bottom += CLUSTER_GAP + rowsHeight(rowCount(config.middle, fullW, chipPx, markPx))
  }
  bottom += CLUSTER_GAP + rowsHeight(rowCount(config.foot, fullW, chipPx, markPx))
  return bottom + inset
}

/**
 * Find a placed chip by the package's name.
 *
 * @param layout - Where everything sits.
 * @param name - The package's name without its scope.
 * @returns The chip, or undefined when no cluster holds it.
 */
export function findChip(layout: EcosystemLayout, name: string): ChipBox | undefined {
  const all = [
    layout.hub,
    ...layout.spine,
    ...layout.left.chips,
    ...layout.right.chips,
    ...(layout.middle?.chips ?? []),
    ...layout.foot.chips,
  ]
  return all.find((box) => box.chip.name === name)
}
