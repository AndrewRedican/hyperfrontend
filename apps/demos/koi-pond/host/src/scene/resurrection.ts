/**
 * The resurrection policy: brings a koi back after its frame dies mid-run.
 *
 * A frame the browser has killed makes no announcement. Its beats simply stop,
 * and the watchdog's verdict cannot say whether the koi is dead or merely mute,
 * so the pond answers with patience instead of certainty: it waits out the
 * grace a live frame would use to speak again, and only an absence that
 * persists is treated as a death worth acting on. Then the session is opened
 * fresh, which tears down whatever the browser left in the old frame and
 * mounts a new one; the same framework means the same seed, so the same koi
 * swims back into its own place.
 *
 * Each successive death inside one episode waits longer than the last and the
 * attempts are capped, because a device that kills the frame every time it
 * returns is telling the pond something no amount of insistence will change.
 * A koi that then stays for a while earns the full budget back: losing a frame
 * to a backgrounded tab is ordinary life on a phone, not a verdict on the koi.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'

/** How long a verdict must stand before the first reopen, in milliseconds. */
const REVIVE_DELAY_MS = 4000

/** How much longer each further reopen in the same episode waits. */
const REVIVE_BACKOFF = 3

/** How many reopens one episode may spend before the pond stops insisting. */
const REVIVE_ATTEMPTS = 3

/** How long a revived koi must stay before its attempt budget is restored, in milliseconds. */
const REVIVE_STABLE_MS = 60_000

/** What the policy just did for one koi, spoken to whoever is listening. */
export type ResurrectionNote = 'scheduled' | 'deferred' | 'recovered' | 'reopened' | 'exhausted'

/** What the resurrection policy needs from the pond. */
export interface ResurrectionOptions {
  /** Whether a koi's session is answering right now. */
  isPresent(framework: KoiFramework): boolean
  /** Opens a koi's session again; the shell replaces the dead mount itself. */
  reopen(framework: KoiFramework): void
  /** Hears what the policy decided, for the diagnostics log. */
  note?(framework: KoiFramework, kind: ResurrectionNote, detail: string): void
}

/** The resurrection policy, wired into the pond's session events. */
export interface Resurrection {
  /** A koi's session stopped answering; considers bringing it back. */
  frameDied(framework: KoiFramework): void
  /** A koi's session opened; arms the stability window that restores its budget. */
  opened(framework: KoiFramework): void
  /** Stops every pending timer and stands the policy down. */
  dispose(): void
}

/** What the policy tracks for one koi. */
interface FishRecord {
  attempts: number
  timer: number | null
  stability: number | null
  waitingForVisible: boolean
}

/**
 * Creates the resurrection policy.
 *
 * @param options - The pond seams the policy acts through.
 * @returns The policy.
 *
 * @example Reviving a koi whose frame the browser killed
 * ```typescript
 * const resurrection = createResurrection({
 *   isPresent: (framework) => present.has(framework),
 *   reopen: (framework) => shellFor(framework).open(),
 * })
 * shell.on('error', (data) => {
 *   if (data?.reason === 'unresponsive') {
 *     resurrection.frameDied(framework)
 *   }
 * })
 * ```
 */
export function createResurrection(options: ResurrectionOptions): Resurrection {
  const fishes = new Map<KoiFramework, FishRecord>()

  const recordFor = (framework: KoiFramework): FishRecord => {
    let record = fishes.get(framework)
    if (record === undefined) {
      record = { attempts: 0, timer: null, stability: null, waitingForVisible: false }
      fishes.set(framework, record)
    }
    return record
  }

  const attempt = (framework: KoiFramework, record: FishRecord): void => {
    record.attempts += 1
    options.note?.(framework, 'reopened', `attempt ${record.attempts} of ${REVIVE_ATTEMPTS}`)
    options.reopen(framework)
  }

  const armStability = (record: FishRecord): void => {
    if (record.stability !== null) {
      window.clearTimeout(record.stability)
    }
    record.stability = window.setTimeout(() => {
      record.stability = null
      record.attempts = 0
    }, REVIVE_STABLE_MS)
  }

  const fire = (framework: KoiFramework): void => {
    const record = recordFor(framework)
    record.timer = null
    if (options.isPresent(framework)) {
      // why: The frame spoke again on its own during the grace — the verdict was a stall, not a death, and a reopen now would tear down a live session under its visitor. The budget comes back only once the koi has stayed, exactly as it would after a reopen.
      armStability(record)
      options.note?.(framework, 'recovered', 'answered during the grace')
      return
    }
    if (document.hidden) {
      // why: Reopening into a hidden page races throttled timers against the handshake deadline for a scene nobody is watching; the attempt keeps until the visitor returns.
      record.waitingForVisible = true
      options.note?.(framework, 'deferred', 'until the page is visible')
      return
    }
    attempt(framework, record)
  }

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      return
    }
    for (const [framework, record] of fishes) {
      if (!record.waitingForVisible) {
        continue
      }
      record.waitingForVisible = false
      // why: A frame that recovered while hidden has not been allowed to say so — the watchdog grants no health until the page can watch it beat again. The grace runs once more from here, and only an absence that survives it is acted on.
      record.timer = window.setTimeout(() => {
        fire(framework)
      }, REVIVE_DELAY_MS)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  return {
    frameDied(framework) {
      const record = recordFor(framework)
      // why: A death inside the stability window belongs to the same episode — the budget keeps counting instead of resetting.
      if (record.stability !== null) {
        window.clearTimeout(record.stability)
        record.stability = null
      }
      if (record.timer !== null || record.waitingForVisible) {
        return
      }
      if (record.attempts >= REVIVE_ATTEMPTS) {
        options.note?.(framework, 'exhausted', `${REVIVE_ATTEMPTS} reopens spent`)
        return
      }
      const delay = REVIVE_DELAY_MS * REVIVE_BACKOFF ** record.attempts
      options.note?.(framework, 'scheduled', `reopen in ${Math.round(delay / 1000)}s`)
      record.timer = window.setTimeout(() => {
        fire(framework)
      }, delay)
    },
    opened(framework) {
      const record = recordFor(framework)
      // why: A session that just opened supersedes any reopen still waiting — firing it would tear the fresh mount down again.
      if (record.timer !== null) {
        window.clearTimeout(record.timer)
        record.timer = null
      }
      record.waitingForVisible = false
      armStability(record)
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      for (const record of fishes.values()) {
        if (record.timer !== null) {
          window.clearTimeout(record.timer)
        }
        if (record.stability !== null) {
          window.clearTimeout(record.stability)
        }
      }
      fishes.clear()
    },
  }
}
