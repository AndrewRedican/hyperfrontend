import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createInteractionsPainter } from '../interactions'
import { CARET_SLIDE_RAD_S, committedHeading } from '../sliding-caret'
import { STEP_S, anchorOf, caretAngle, frameOf, recordingOverlay } from './overlay-recorder'

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

/** Where the scripted koi holds its nose while its heading winds, in pond space. */
const NOSE: Vec2 = { x: 600, y: 400 }

/** How many samples the scripted koi reports its spine as. */
const SPINE_SAMPLES = 5

/** How far off the scripted koi's waypoints sit, in pond pixels: far enough that a bearing to one is the decision itself. */
const TARGET_PX = 3000

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
 * A koi holding a straight pose, reporting the heading it is on and the point it is steering for.
 *
 * The nose is pinned while the heading winds, because what the caret answers to
 * is a bearing taken from the head: pinning the body isolates the decision from
 * wherever the koi would have swum to by the time it made it.
 *
 * @param heading - The heading the koi reports, in radians.
 * @param target - The point it reports it is steering toward.
 * @returns The koi's reported outline.
 */
function poised(heading: number, target: Vec2): KoiOutline {
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
    intent: { kind: 'travel', target, reachPx: REACH_PX },
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
  const held = { x: NOSE.x + TARGET_PX, y: NOSE.y }
  const decided = { x: NOSE.x + Math.cos(COMMIT_RAD) * TARGET_PX, y: NOSE.y + Math.sin(COMMIT_RAD) * TARGET_PX }
  const run: TurnFrame[] = []
  let heading = 0

  for (let frame = 0; frame < SCRIPT_FRAMES; frame += 1) {
    // why: The koi is settled on its old course before it decides, so the slide these specs read is the whole of the caret's answer to the decision.
    const committing = frame >= SETTLED_FRAMES
    const outline = poised(heading, committing ? decided : held)
    painter.paint(frameOf(outline))
    run.push({ caret: caretAngle(overlay.strokes, outline), committed: committedHeading(outline, anchorOf(outline)), heading })
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
})
