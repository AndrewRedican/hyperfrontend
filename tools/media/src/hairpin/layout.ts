import type { HairpinConfig } from '../models/hairpin'
import type { MediaProfile } from '../models/profile'
import type { Point, Rect } from '../stage/geometry'
import { cos, max, min, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Width of the frame every measurement below is stated at. */
const COMPACT_WIDTH = 640

/** How much larger than the compact frame the type is ever drawn. */
const MAX_TYPE_SCALE = 1.15

/** One step of the service, placed. */
export interface PaneLayout {
  /** The pane's outline. */
  rect: Rect
  /** Horizontal centre of the pane, where its chip sits and a returning value is marked. */
  centreX: number
  /** Where the turn inside the pane leaves the way in and rejoins the way out. */
  turnX: number
}

/** Where everything on the stage sits, in CSS pixels of the frame. */
export interface HairpinLayout {
  /** How many frame pixels one compact pixel is. */
  unit: number
  /** Font size of the chips and labels. */
  chipPx: number
  /** The outline of the process. */
  shell: Rect
  /** Corner radius of the process. */
  shellRadius: number
  /** Height of the lane a request travels in on. */
  inY: number
  /** Height of the lane a response travels out on. */
  outY: number
  /** Radius of the turn that joins the two lanes. */
  turnR: number
  /** Half the height of each opening in the wall of the process. */
  doorHalf: number
  /** The steps, outermost first. */
  panes: readonly PaneLayout[]
  /** Vertical centre of the row of step chips. */
  chipY: number
  /** Where a request enters the frame and a response leaves it. */
  edgeX: number
  /** Where a refused request comes to rest, outside the closed way in. */
  haltX: number
  /** Centre of the runner's chip, on the lower edge of the process. */
  runner: Point
  /** The top of the wire between the process and whoever supervises it. */
  wireTop: Point
  /** The foot of that wire, where a signal sets off and the exit code lands. */
  wireFoot: Point
  /** The slot the exit code lands in. */
  slot: Rect
  /** Radius of a request or a response. */
  tokenR: number
}

/**
 * Place the process, its steps and the wire it is supervised over.
 *
 * Every measurement is stated for the compact frame and scaled with the
 * frame's width, so the picture keeps its proportions at any size; only the
 * type stops growing early, because a chip twice as large says nothing more.
 *
 * @param config - The service as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns Where everything sits.
 */
export function hairpinLayout(config: HairpinConfig, profile: MediaProfile): HairpinLayout {
  const unit = profile.width / COMPACT_WIDTH
  const shell: Rect = { x: 118 * unit, y: 36 * unit, w: 500 * unit, h: 228 * unit }
  const inY = 124 * unit
  const outY = 196 * unit
  const paneW = 76 * unit
  const count = max(1, config.steps.length)
  // why: the panes share the room between the way in and the far wall evenly, with a margin either side wide enough for a value to be seen leaving the first pane
  const firstX = shell.x + 122 * unit
  const lastX = shell.x + shell.w - 114 * unit
  const panes = config.steps.map((_step, index) => {
    const centreX = count === 1 ? lastX : firstX + ((lastX - firstX) * index) / (count - 1)
    return {
      rect: { x: centreX - paneW / 2, y: 86 * unit, w: paneW, h: 148 * unit },
      centreX,
      turnX: centreX - 12 * unit,
    }
  })
  const runner: Point = { x: shell.x + shell.w - 82 * unit, y: shell.y + shell.h }
  const slotSide = 30 * unit
  const slotTop = runner.y + 47 * unit
  return {
    unit,
    chipPx: 12 * min(unit, MAX_TYPE_SCALE),
    shell,
    shellRadius: 22 * unit,
    inY,
    outY,
    turnR: (outY - inY) / 2,
    doorHalf: 14 * unit,
    panes,
    chipY: 61 * unit,
    edgeX: -14 * unit,
    haltX: shell.x - 19 * unit,
    runner,
    wireTop: { x: runner.x, y: runner.y + 13 * unit },
    wireFoot: { x: runner.x, y: slotTop },
    slot: { x: runner.x - slotSide / 2, y: slotTop, w: slotSide, h: slotSide },
    tokenR: 7.5 * unit,
  }
}

/**
 * A point on the turn inside a pane.
 *
 * The turn is half a circle that leaves the way in heading away from the
 * door, reaches its head at the far side, and rejoins the way out heading
 * back, so a request never reverses on the spot: it comes round.
 *
 * @param layout - Where everything sits.
 * @param turnX - Where this pane's turn leaves the way in.
 * @param t - How far round the turn, from 0 at the way in to 1 at the way out.
 * @returns The point on the turn.
 */
export function onTurn(layout: HairpinLayout, turnX: number, t: number): Point {
  const angle = -PI / 2 + PI * t
  return { x: turnX + layout.turnR * cos(angle), y: (layout.inY + layout.outY) / 2 + layout.turnR * sin(angle) }
}

/**
 * The path of the turn inside a pane.
 *
 * @param layout - Where everything sits.
 * @param turnX - Where this pane's turn leaves the way in.
 * @returns The `d` attribute of the half circle.
 */
export function turnPath(layout: HairpinLayout, turnX: number): string {
  const r = layout.turnR.toFixed(1)
  return `M ${turnX.toFixed(1)} ${layout.inY.toFixed(1)} A ${r} ${r} 0 0 1 ${turnX.toFixed(1)} ${layout.outY.toFixed(1)}`
}

/**
 * The outline of the process, with an opening in its wall at each lane.
 *
 * @param layout - Where everything sits.
 * @returns The `d` attribute of the wall: the long run from the foot of the way in round to the foot of the way out, then the short run between the two openings.
 */
export function shellPath(layout: HairpinLayout): string {
  const { shell, doorHalf, inY, outY } = layout
  const r = layout.shellRadius
  const left = shell.x
  const right = shell.x + shell.w
  const top = shell.y
  const bottom = shell.y + shell.h
  const arc = `A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1`
  return [
    `M ${left.toFixed(1)} ${(inY - doorHalf).toFixed(1)}`,
    `L ${left.toFixed(1)} ${(top + r).toFixed(1)}`,
    `${arc} ${(left + r).toFixed(1)} ${top.toFixed(1)}`,
    `L ${(right - r).toFixed(1)} ${top.toFixed(1)}`,
    `${arc} ${right.toFixed(1)} ${(top + r).toFixed(1)}`,
    `L ${right.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `${arc} ${(right - r).toFixed(1)} ${bottom.toFixed(1)}`,
    `L ${(left + r).toFixed(1)} ${bottom.toFixed(1)}`,
    `${arc} ${left.toFixed(1)} ${(bottom - r).toFixed(1)}`,
    `L ${left.toFixed(1)} ${(outY + doorHalf).toFixed(1)}`,
    `M ${left.toFixed(1)} ${(outY - doorHalf).toFixed(1)}`,
    `L ${left.toFixed(1)} ${(inY + doorHalf).toFixed(1)}`,
  ].join(' ')
}
