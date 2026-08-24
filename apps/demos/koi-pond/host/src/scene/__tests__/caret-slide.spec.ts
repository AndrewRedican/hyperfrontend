import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createInteractionsPainter } from '../interactions'
import { CARET_SLIDE_RAD_S } from '../sliding-caret'
import { STEP_S, caretAngle, frameOf, recordingOverlay } from './overlay-recorder'

/** What the caret, the decision, and the body were doing on one painted frame. */
interface TurnFrame {
  /** Where the caret was riding, in radians. */
  caret: number
  /** The heading the koi had committed to, in radians. */
  committed: number
  /** The heading the koi's body was on, in radians. */
  heading: number
}

/** The nose-to-tail length the scripted koi reports, in pond pixels. */
const BODY_PX = 140

/** The half-width the scripted koi reports at every spine sample, in pond pixels. */
const GIRTH_PX = 8

/** How fast the scripted koi travels, in pond pixels per second. */
const SPEED_PX_S = 210

/** How far ahead the scripted koi is anticipating, in pond pixels. */
const REACH_PX = 260

/** How near a neighbour has to pass the scripted koi to matter, in pond pixels. */
const CLEARANCE_PX = 90

/** Where the scripted koi holds its nose while its heading winds, in pond space. */
const NOSE: Vec2 = { x: 600, y: 400 }

/** How many samples the scripted koi reports its spine as. */
const SPINE_SAMPLES = 5

/** How far around the scripted koi commits, in radians. */
const COMMIT_RAD = 1.2

/** How fast the scripted koi's body swings onto its commitment, in radians per second, inside anything a koi's own helm manages. */
const TURN_RAD_S = 0.6

/** How many frames the scripted koi holds its settled course before it decides otherwise. */
const SETTLED_FRAMES = 6

/** How many frames the turn is painted over, long enough for the body to finish swinging onto the decision. */
const SCRIPT_FRAMES = 160

/** How much slop an angle read back off drawn coordinates carries, in radians, which is also how near counts as arrived. */
const READBACK_RAD = 1e-9

/**
 * A koi holding a straight pose, reporting the heading it is on and the one it has committed to.
 *
 * The nose is pinned while the heading winds, so what these specs read is the
 * gap between the two headings and nothing about where the koi would have swum
 * to by the time it decided.
 *
 * @param heading - The heading the koi reports, in radians.
 * @param committed - The heading it reports it has committed to, in radians.
 * @returns The koi's reported outline.
 */
function poised(heading: number, committed: number): KoiOutline {
  return {
    framework: 'vanilla',
    spine: Array.from({ length: SPINE_SAMPLES }, (_unused, index) => ({
      x: NOSE.x - (Math.cos(heading) * BODY_PX * index) / (SPINE_SAMPLES - 1),
      y: NOSE.y - (Math.sin(heading) * BODY_PX * index) / (SPINE_SAMPLES - 1),
    })),
    girth: Array.from({ length: SPINE_SAMPLES }, () => GIRTH_PX),
    heading,
    speed: SPEED_PX_S,
    depth: 2,
    phase: 'turning',
    intent: {
      kind: 'travel',
      heading: committed,
      gain: 1,
      target: { x: NOSE.x + Math.cos(committed) * REACH_PX, y: NOSE.y + Math.sin(committed) * REACH_PX },
      reachPx: REACH_PX,
      clearancePx: CLEARANCE_PX,
    },
  }
}

/**
 * Paints a koi through a commitment its body has yet to swing onto.
 *
 * The koi holds a settled course, then names a waypoint well off it and starts
 * turning for it no faster than its own helm could. Everything the caret exists
 * for happens in the gap between those two.
 *
 * @returns What every painted frame drew.
 */
function scriptedTurn(): TurnFrame[] {
  const overlay = recordingOverlay()
  const painter = createInteractionsPainter(overlay.canvas)
  const run: TurnFrame[] = []
  let heading = 0

  for (let frame = 0; frame < SCRIPT_FRAMES; frame += 1) {
    // why: The koi is settled on its old course before it decides, so the slide these specs read is the whole of the caret's answer to the decision.
    const committing = frame >= SETTLED_FRAMES
    const committed = committing ? COMMIT_RAD : 0
    const outline = poised(heading, committed)
    painter.paint(frameOf(outline))
    run.push({ caret: caretAngle(overlay.strokes, outline), committed, heading })
    if (committing) {
      heading = Math.min(COMMIT_RAD, heading + TURN_RAD_S * STEP_S)
    }
  }
  return run
}

/**
 * Reads one frame of a scripted turn, refusing a run that never painted it.
 *
 * @param run - The painted frames.
 * @param index - Which frame to read.
 * @returns The frame.
 */
function turnFrame(run: readonly TurnFrame[], index: number): TurnFrame {
  const frame = run[index]
  if (frame === undefined) {
    throw new Error(`the scripted turn painted no frame ${index}`)
  }
  return frame
}

describe('the caret through a scripted turn', () => {
  it('never slides a caret further in one frame than its rate allows', () => {
    const run = scriptedTurn()
    const steps = run.slice(1).map((frame, index) => Math.abs(wrapAngle(frame.caret - turnFrame(run, index).caret)))
    expect(Math.max(...steps)).toBeLessThanOrEqual(CARET_SLIDE_RAD_S * STEP_S + READBACK_RAD)
  })

  it('leaves the caret on the settled course the frame a decision lands', () => {
    const landed = turnFrame(scriptedTurn(), SETTLED_FRAMES)
    expect(Math.abs(wrapAngle(landed.caret - landed.committed))).toBeGreaterThan(COMMIT_RAD * 0.9)
  })

  it('arrives on the committed heading before the body does', () => {
    // why: The run is read from the decision on, because before it the caret and the body are both already sitting on the settled course.
    const decided = scriptedTurn().slice(SETTLED_FRAMES)
    const caretArrived = decided.findIndex((frame) => Math.abs(wrapAngle(frame.caret - frame.committed)) < READBACK_RAD)
    const bodyArrived = decided.findIndex((frame) => Math.abs(wrapAngle(frame.heading - frame.committed)) < READBACK_RAD)
    expect([caretArrived > 0, caretArrived < bodyArrived]).toEqual([true, true])
  })

  it('closes the gap between the nose and the caret all the way to nothing', () => {
    const decided = scriptedTurn().slice(SETTLED_FRAMES)
    const gaps = decided.map((frame) => Math.abs(wrapAngle(frame.caret - frame.heading)))
    const opened = Math.max(...gaps)
    // why: The whole point of the mark is that a visitor watches the koi converge on it; a caret that held a constant offset would be a compass pinned beside the fish rather than a heading it is steering for. The gap peaks short of the whole commitment because the body is already swinging while the caret is still sliding out to meet it.
    expect(opened).toBeGreaterThan(COMMIT_RAD * 0.6)
    expect(gaps[gaps.length - 1]).toBeLessThan(READBACK_RAD)
    const closing = gaps.slice(gaps.indexOf(opened))
    expect(closing).toEqual([...closing].sort((first, second) => second - first))
  })
})
