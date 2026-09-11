import type { Page } from 'playwright-core'
import type { CapturedStill } from '../capture/record-video'
import type { MediaProfile } from '../models/profile'
import type { ScriptedScene, StillSpec } from '../models/scene'
import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { capturePng } from '../capture/screenshot'
import { STAGE_ELEMENT_ID, stageDocument } from './document'

/** Shortest display time a GIF frame is given, in milliseconds. */
const MIN_FRAME_DELAY_MS = 20

/** Resolution of a GIF's frame timing, in milliseconds. */
const DELAY_QUANTUM_MS = 10

/** Which moments of a timeline become frames, and how long each is held. */
export interface FramePlan {
  /** The moment each frame shows, in order. */
  atMs: readonly number[]
  /** Display time of each frame, index for index. */
  delaysMs: readonly number[]
}

/** The markup for one instant, and where in the page it is mounted. */
interface StageMount {
  /** Id of the element the stage draws into. */
  elementId: string
  /** Markup for the instant being shown. */
  markup: string
}

/** What one playback of a scripted scene produced. */
export interface PlayedStage {
  /** One captured PNG per frame of the animation, in order. */
  frames: readonly Buffer[]
  /** Display time of each frame, index for index. */
  delaysMs: readonly number[]
  /** Stills captured at the offsets the scene named. */
  stills: readonly CapturedStill[]
}

/**
 * Work out which moments of a timeline become frames, and how long each is held.
 *
 * Frames land on an even grid because the timeline is asked for moments rather
 * than watched in real time, so there is no ragged source rate to compensate
 * for. The hold is spent on the closing frame rather than on copies of it: a
 * still frame repeated is bytes a longer delay gets for free.
 *
 * @param durationMs - Length of the stage's timeline.
 * @param fps - Frames per second the animation runs at.
 * @param holdMs - Extra time to rest on the closing frame.
 * @returns The moment each frame shows and how long it stays.
 */
export function planTimeline(durationMs: number, fps: number, holdMs: number): FramePlan {
  const count = max(1, round((durationMs / 1000) * fps))
  const step = durationMs / count
  const atMs: number[] = []
  const delaysMs: number[] = []
  for (let index = 0; index < count; index += 1) {
    atMs.push(round(index * step))
    const own = round(step / DELAY_QUANTUM_MS) * DELAY_QUANTUM_MS
    const rest = index === count - 1 ? round(holdMs / DELAY_QUANTUM_MS) * DELAY_QUANTUM_MS : 0
    delaysMs.push(max(MIN_FRAME_DELAY_MS, own + rest))
  }
  return { atMs, delaysMs }
}

/**
 * Show one instant of a scene on an already mounted page.
 *
 * @param page - The page the stage is mounted on.
 * @param scene - The scene being played.
 * @param profile - The presentation target being composed for.
 * @param atMs - Offset from the start of the timeline.
 */
async function seek(page: Page, scene: ScriptedScene, profile: MediaProfile, atMs: number): Promise<void> {
  await page.evaluate(
    (mount: StageMount) => {
      const host = document.getElementById(mount.elementId)
      if (host !== null) {
        host.innerHTML = mount.markup
      }
    },
    { elementId: STAGE_ELEMENT_ID, markup: scene.frame(profile, atMs) }
  )
}

/**
 * Play a scripted scene through and capture every frame it is made of.
 *
 * Nothing here waits for the page: each frame is asked for, mounted, and
 * photographed before the next one is asked for at all, so the recording takes
 * however long the machine takes and the asset is identical either way. That is
 * the difference between this lane and recording a video, and it is the reason
 * a scripted scene needs no clock pinning, no settle time and no readiness gate.
 *
 * @param page - A page with the viewport already set to the profile's size.
 * @param scene - The scene to play.
 * @param profile - The presentation target being composed for.
 * @param stills - Stills to capture at their own offsets.
 * @returns The captured frames, their display times, and the stills.
 */
export async function playStage(
  page: Page,
  scene: ScriptedScene,
  profile: MediaProfile,
  stills: readonly StillSpec[]
): Promise<PlayedStage> {
  const durationMs = scene.durationMs(profile)
  await page.setContent(stageDocument(scene.styles(profile), profile), { waitUntil: 'load' })
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  const frames: Buffer[] = []
  const timeline = planTimeline(durationMs, scene.fps ?? profile.fps, scene.holdMs ?? 0)
  if (scene.outputs.includes('gif')) {
    for (const atMs of timeline.atMs) {
      await seek(page, scene, profile, atMs)
      frames.push(await capturePng(page, {}))
    }
  }

  const captured: CapturedStill[] = []
  for (const spec of [...stills].sort((left, right) => left.atMs - right.atMs)) {
    await seek(page, scene, profile, min(spec.atMs, durationMs))
    captured.push({ spec, png: await capturePng(page, spec) })
  }
  return { frames, delaysMs: timeline.delaysMs, stills: captured }
}
