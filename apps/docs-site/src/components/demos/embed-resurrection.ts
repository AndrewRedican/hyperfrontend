/**
 * The gallery's resurrection policy: brings an embedded demo back after the
 * browser kills its frame.
 *
 * A frame the browser has killed makes no announcement. Its beats simply stop,
 * and the watchdog's verdict cannot say whether the feature is dead or merely
 * starved, so the card answers with patience instead of certainty: it waits out
 * the grace a live frame would use to speak again, and only an absence that
 * survives it is treated as a death worth acting on. Nothing is torn down
 * before then, because a session that is only slow is still a session someone
 * is watching.
 *
 * When the absence does stand, the mount is destroyed before the session is
 * opened again. A killed frame is repainted by the browser with its own crash
 * tile, artwork no host page can style, and only taking the element out of the
 * page takes the tile with it.
 *
 * Each successive death inside one episode waits longer than the last and the
 * attempts are capped, because a device that kills the frame every time it
 * comes back is saying something no amount of insistence will change. A demo
 * that then stays a while earns the full budget back: losing a frame to a
 * backgrounded tab is ordinary life on a phone, not a verdict on the demo.
 *
 * Nothing is reopened into a hidden page. A backgrounded tab throttles the
 * timers a handshake depends on, and the watchdog grants no health there, so a
 * reopen would race a deadline for a card nobody is watching; the attempt is
 * held instead. The return to visibility restarts the grace rather than
 * reopening blind, since a frame that recovered while hidden has not been
 * allowed to say so. That return is read two ways, because an announcement has
 * to be delivered to be heard: the browser's event is the fast path, and a held
 * attempt re-reads the page's own visibility on every grace, so an undelivered
 * edge costs promptness rather than the whole recovery.
 */
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** How long a verdict must stand before the first reopen, in milliseconds. */
const REVIVE_DELAY_MS = 4000

/** How much longer each further reopen in the same episode waits. */
const REVIVE_BACKOFF = 3

/** How many reopens one episode may spend before the card stops insisting. */
const REVIVE_ATTEMPTS = 3

/** How long a revived embed must stay before its attempt budget is restored, in milliseconds. */
const REVIVE_STABLE_MS = 60_000

/** What the resurrection policy needs from the embed it heals. */
export interface EmbedResurrectionOptions {
  /** Whether the embedded session is answering right now. */
  isPresent(): boolean
  /** Whether the host page is hidden, read at the moment it is asked. */
  isHidden(): boolean
  /** Takes the mount out of the page, dead frame and all. */
  destroy(): void
  /** Opens the session again on the emptied mount. */
  open(): void
  /** The episode has spent its attempts; nothing further is tried this visit. */
  gaveUp(): void
}

/** The resurrection policy, wired into an embed's session events. */
export interface EmbedResurrection {
  /** The session stopped answering; considers bringing it back. */
  frameDied(): void
  /** The session opened; arms the stability window that restores the budget. */
  opened(): void
  /** The page can be watched again; releases an attempt held for it. */
  pageVisible(): void
  /** Stops every pending timer and stands the policy down. */
  dispose(): void
}

/**
 * Creates an embed's resurrection policy.
 *
 * @param options - The embed seams the policy acts through.
 * @returns The policy.
 *
 * @example Healing a card whose frame the browser killed
 * ```typescript
 * const resurrection = createEmbedResurrection({
 *   isPresent: () => present,
 *   isHidden: () => document.visibilityState === 'hidden',
 *   destroy: () => shell.destroy(),
 *   open: () => shell.open(),
 *   gaveUp: () => setStatus('offline'),
 * })
 * shell.on('open', () => resurrection.opened())
 * shell.on('error', (data) => {
 *   if (data?.reason === 'unresponsive') {
 *     resurrection.frameDied()
 *   }
 * })
 * ```
 */
export function createEmbedResurrection(options: EmbedResurrectionOptions): EmbedResurrection {
  let attempts = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let stability: ReturnType<typeof setTimeout> | undefined
  let held = false

  const clearPending = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const armStability = (): void => {
    clearTimeout(stability)
    stability = setTimeout(() => {
      stability = undefined
      attempts = 0
    }, REVIVE_STABLE_MS)
  }

  const fire = (): void => {
    timer = undefined
    const returned = held
    held = false
    if (options.isPresent()) {
      // why: The session spoke again on its own during the grace — the verdict was a stall, not a death, and tearing it down now would take a live feature away from whoever is watching it. The budget comes back only once the demo has stayed, exactly as it would after a reopen.
      armStability()
      return
    }
    if (options.isHidden()) {
      // why: The attempt keeps until the visitor returns, and the wait is re-armed rather than latched, so a return the browser never announces is still noticed on the next grace.
      held = true
      timer = setTimeout(fire, REVIVE_DELAY_MS)
      return
    }
    if (returned) {
      // why: A frame that recovered while hidden has had no chance to prove it — the watchdog grants no health to a page it cannot watch. The grace runs once more from the return, and only an absence that survives that is acted on.
      timer = setTimeout(fire, REVIVE_DELAY_MS)
      return
    }
    attempts += 1
    // why: The dead frame leaves the page before its replacement mounts, so the browser's crash tile goes with it and no second mount lands on top of the first.
    options.destroy()
    options.open()
  }

  return {
    frameDied() {
      // why: A death inside the stability window belongs to the same episode — the budget keeps counting instead of resetting.
      clearTimeout(stability)
      stability = undefined
      if (timer !== undefined) {
        return
      }
      if (attempts >= REVIVE_ATTEMPTS) {
        // why: The corpse is still mounted at this point; the card takes the space back rather than standing over a frame the device will not keep alive.
        options.destroy()
        options.gaveUp()
        return
      }
      timer = setTimeout(fire, REVIVE_DELAY_MS * REVIVE_BACKOFF ** attempts)
    },
    opened() {
      // why: A session that just opened supersedes any reopen still waiting — firing it would tear the fresh mount down again.
      clearPending()
      held = false
      armStability()
    },
    pageVisible() {
      if (!held) {
        return
      }
      held = false
      clearPending()
      timer = setTimeout(fire, REVIVE_DELAY_MS)
    },
    dispose() {
      clearPending()
      clearTimeout(stability)
      stability = undefined
      held = false
    },
  }
}
