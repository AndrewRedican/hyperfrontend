'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import type { DemoShell } from './demo-wiring'
import { trackDemoOpen } from '@/lib/analytics-events'
import { useEffect, useRef, useState } from 'react'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { DemoFallbackCard } from './demo-fallback-card'
import { demoWiringFor } from './demo-wiring'
import { createEmbedResurrection } from './embed-resurrection'

/** Liveness of the embedded feature. */
export type EmbedStatus = 'connecting' | 'live' | 'offline'

/** Props for {@link DemoEmbed}. */
export interface DemoEmbedProps {
  /** The demo's manifest entry; must carry a `featureUrl`. */
  entry: DemoManifestEntry
  /** Extra classes for the mount container. */
  className?: string
  /** `true` while the embed is presented as a viewport overlay — square corners, no card contour. */
  frameless?: boolean
  /** Notified whenever the embed's liveness changes. */
  onStatus?: (status: EmbedStatus) => void
  /** Receives the live shell handle after mount, and `null` when it is torn down. */
  onShell?: (shell: DemoShell | null) => void
}

/**
 * Narrows an unknown event payload to a plain record.
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Embeds a live demo through its vendored shell package, degrading gracefully
 * to the demo's themed fallback card.
 *
 * The fallback card renders immediately and the feature iframe mounts
 * invisible on top. Liveness is read straight off the shell's own session
 * signals: the demo's first proof-of-life event (post-open product traffic,
 * so the app has rendered) crossfades the iframe in, the four-state `status`
 * watchdog demotes a suspect or gone session, and a re-arming silence
 * deadline covers the never-connected case — an unreachable or outdated
 * origin simply leaves the card up, so an error page is never shown to
 * visitors. A feature reload surfaces as `close` then fresh proof of life,
 * passing through `connecting` truthfully along the way. A frame the browser
 * kills is healed rather than left mounted: the unresponsive verdict buys the
 * grace a merely starved frame would need to speak again, and an absence that
 * survives it empties the mount and opens the session in its place, on a
 * bounded budget behind a card that keeps the space when the device will not
 * keep the frame. Unmounting destroys the session, so a demo that loses the
 * stage tears down gracefully.
 * @param root0
 * @param root0.entry
 * @param root0.className
 * @param root0.frameless
 * @param root0.onStatus
 * @param root0.onShell
 */
export function DemoEmbed({ entry, className, frameless, onStatus, onShell }: DemoEmbedProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const effectsLayer = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<EmbedStatus>('connecting')
  const notify = useRef(onStatus)
  notify.current = onStatus
  const notifyShell = useRef(onShell)
  notifyShell.current = onShell
  const featureUrl = entry.featureUrl ?? ''
  const slug = entry.slug

  useEffect(() => {
    const element = container.current
    const wiring = demoWiringFor(slug)
    if (!element || !wiring || featureUrl === '') {
      return
    }
    let disposed = false

    const apply = (next: EmbedStatus) => {
      if (!disposed) {
        if (next === 'live') {
          // note: Deduped centrally — carousel remounts and reconnects stay one open per page life.
          trackDemoOpen(slug, 'embedded')
        }
        setStatus(next)
        notify.current?.(next)
      }
    }

    // ref: [guide:embed-a-shipped-feature/silence-deadline] start
    // how: One re-arming deadline serves connect-timeout and mid-session death alike — every proof of life pushes it out, so only real silence fires it.
    let deadline: ReturnType<typeof setTimeout> | null = null
    const armDeadline = () => {
      if (deadline !== null) {
        clearTimeout(deadline)
      }
      deadline = setTimeout(() => apply('offline'), wiring.silenceTimeoutMs)
    }
    // ref: [guide:embed-a-shipped-feature/silence-deadline] end

    // why: A fresh mount owes its host the honest in-between state — the previous demo's liveness must not linger on the caption.
    apply('connecting')

    // ref: [guide:embed-a-shipped-feature/open-and-observe] start
    const shell = wiring.createShell({ container: element, url: featureUrl })
    const subscriptions = [
      // why: A proof event is post-open product traffic — the app is rendering, so the crossfade never reveals a blank frame.
      ...wiring.proofEvents.map((proof) =>
        shell.on(proof, () => {
          armDeadline()
          apply('live')
        })
      ),
      // why: The status payload is the watchdog snapshot object, not a bare state string.
      // why: `suspect` alone never demotes — a session whose product traffic still flows is visibly alive, and demoting on it makes the embed blink out for one beat interval before the next proof event restores it.
      shell.on('status', (data) => {
        const state = isRecord(data) ? data['state'] : undefined
        if (state === 'healthy') {
          armDeadline()
          apply('live')
        } else if (state === 'gone') {
          apply('offline')
        }
      }),
      // why: A close mid-session is usually a feature reload; the SDK re-adopts the new document, so report the honest in-between state and re-arm.
      shell.on('close', () => {
        apply('connecting')
        armDeadline()
      }),
      shell.on('error', (data) => {
        if (isRecord(data) && data['reason'] === 'open-timeout') {
          apply('offline')
        }
      }),
    ]
    armDeadline()
    shell.open()
    // ref: [guide:embed-a-shipped-feature/open-and-observe] end

    // why: The browser may kill any frame it likes on a phone, and it leaves the corpse mounted under its own crash tile. The healing rides on its own subscriptions so the liveness above stays about what the visitor is shown, and this stays about whether the session is answering at all.
    let answering = false
    const resurrection = createEmbedResurrection({
      isPresent: () => answering,
      // why: Read at the moment it is asked rather than latched from an announcement, so a return the browser never announced cannot hold a reopen for a page the visitor is looking at.
      isHidden: () => document.visibilityState === 'hidden',
      destroy: () => shell.destroy(),
      open: () => {
        // why: The replacement is unproven, so the card comes back up and the silence budget starts over from the reopen rather than from the beat the dead frame last sent.
        apply('connecting')
        armDeadline()
        shell.open()
      },
      gaveUp: () => apply('offline'),
    })
    const watchVisibility = () => {
      if (document.visibilityState !== 'hidden') {
        resurrection.pageVisible()
      }
    }
    document.addEventListener('visibilitychange', watchVisibility)
    subscriptions.push(
      // why: A handshake that landed is the frame answering for itself, whatever the app has rendered yet.
      shell.on('open', () => {
        answering = true
        resurrection.opened()
      }),
      // why: Product traffic is a frame answering too — a demo the visitor can watch working is never torn down over a beat the watchdog missed.
      ...wiring.proofEvents.map((proof) =>
        shell.on(proof, () => {
          answering = true
        })
      ),
      // why: Only a beat earns `healthy` back, so this is the one signal that says a frame the watchdog stood down is alive after all.
      shell.on('status', (data) => {
        if (isRecord(data) && data['state'] === 'healthy') {
          answering = true
        }
      }),
      // why: The verdict cannot tell a dead frame from a starved one, so nothing visible changes here — the policy owes a live frame the grace to speak again first.
      shell.on('error', (data) => {
        if (isRecord(data) && data['reason'] === 'unresponsive') {
          answering = false
          resurrection.frameDied()
        }
      }),
      // why: Registered among the unsubscribes so the policy's timers and the page listener are released on exactly the teardown that ends the session.
      () => {
        document.removeEventListener('visibilitychange', watchVisibility)
        resurrection.dispose()
      }
    )
    notifyShell.current?.(shell)
    const overlay = effectsLayer.current
    const detachEffects = overlay ? wiring.attachEffects?.(shell, overlay) : undefined

    // ref: [guide:embed-a-shipped-feature/teardown] start
    return () => {
      disposed = true
      if (deadline !== null) {
        clearTimeout(deadline)
      }
      detachEffects?.()
      subscriptions.forEach((unsubscribe) => unsubscribe())
      notifyShell.current?.(null)
      shell.destroy()
    }
    // ref: [guide:embed-a-shipped-feature/teardown] end
  }, [featureUrl, slug])

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* note: The fallback card stays under the invisible iframe until proof of life, so a dead origin's error page is never visible. */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${status === 'live' ? 'opacity-0' : 'opacity-100'}`}>
        <DemoFallbackCard entry={entry} status={status === 'offline' ? 'offline' : 'connecting'} />
      </div>
      {/* note: overflow-hidden + the card radius clip the feature frame to the same corner contours as every fallback card; an overlay drops the contour and lets the frame run to the edges. */}
      <div
        ref={container}
        aria-label={`Live ${entry.title} demo`}
        className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${frameless ? '' : 'rounded-2xl'} ${status === 'live' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      {/* note: Host-owned stage effects paint above the frame without intercepting the visitor's presses on it. */}
      <div
        ref={effectsLayer}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700 ${frameless ? '' : 'rounded-2xl'} ${status === 'live' ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
