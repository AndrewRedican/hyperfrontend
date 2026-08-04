'use client'

import type { DemoManifestEntry } from '@/lib/demo-manifest'
import { useEffect, useRef, useState } from 'react'
import { createFeatureShell } from '@hyperfrontend/demo-clock-shell'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { DemoFallbackCard } from './demo-fallback-card'

/** The shell handle type, inferred from the vendored shell's factory. */
export type ClockShell = ReturnType<typeof createFeatureShell>

/** Liveness of the embedded feature. */
export type EmbedStatus = 'connecting' | 'live' | 'offline'

/** Milliseconds of silence tolerated before degrading to the fallback card. */
const LIVENESS_TIMEOUT_MS = 6000

/** Props for {@link ClockEmbed}. */
export interface ClockEmbedProps {
  /** The clock's manifest entry; must carry a `featureUrl`. */
  entry: DemoManifestEntry
  /** Extra classes for the mount container. */
  className?: string
  /** Notified whenever the embed's liveness changes. */
  onStatus?: (status: EmbedStatus) => void
  /** Receives the live shell handle after mount, and `null` when it is torn down. */
  onShell?: (shell: ClockShell | null) => void
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
 * Embeds the live clock feature through its vendored shell package, degrading
 * gracefully to the demo's themed fallback card.
 *
 * The fallback card renders immediately and the feature iframe mounts
 * invisible on top. Liveness is read straight off the shell's own session
 * signals: the first `tick` (post-open product traffic, so the app has
 * rendered) crossfades the iframe in, the four-state `status` watchdog demotes
 * a suspect or gone session, and a re-arming silence deadline covers the
 * never-connected case — an unreachable or outdated origin simply leaves the
 * card up, so an error page is never shown to visitors. A feature reload
 * surfaces as `close` then a fresh `tick`, passing through `connecting`
 * truthfully along the way.
 * @param root0
 * @param root0.entry
 * @param root0.className
 * @param root0.onStatus
 * @param root0.onShell
 */
export function ClockEmbed({ entry, className, onStatus, onShell }: ClockEmbedProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<EmbedStatus>('connecting')
  const notify = useRef(onStatus)
  notify.current = onStatus
  const notifyShell = useRef(onShell)
  notifyShell.current = onShell
  const featureUrl = entry.featureUrl ?? ''

  useEffect(() => {
    const element = container.current
    if (!element || featureUrl === '') {
      return
    }
    let disposed = false

    const apply = (next: EmbedStatus) => {
      if (!disposed) {
        setStatus(next)
        notify.current?.(next)
      }
    }

    // how: One re-arming deadline serves connect-timeout and mid-session death alike — every proof of life pushes it out, so only real silence fires it.
    let deadline: ReturnType<typeof setTimeout> | null = null
    const armDeadline = () => {
      if (deadline !== null) {
        clearTimeout(deadline)
      }
      deadline = setTimeout(() => apply('offline'), LIVENESS_TIMEOUT_MS)
    }

    const shell = createFeatureShell({ container: element, url: featureUrl })
    const subscriptions = [
      // why: The first tick is post-open product traffic — the app is rendering, so the crossfade never reveals a blank frame.
      shell.on('tick', () => {
        armDeadline()
        apply('live')
      }),
      // why: The status payload is the watchdog snapshot object, not a bare state string.
      shell.on('status', (data) => {
        const state = isRecord(data) ? data['state'] : undefined
        if (state === 'healthy') {
          armDeadline()
          apply('live')
        } else if (state === 'suspect' || state === 'gone') {
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
    notifyShell.current?.(shell)

    return () => {
      disposed = true
      if (deadline !== null) {
        clearTimeout(deadline)
      }
      subscriptions.forEach((unsubscribe) => unsubscribe())
      notifyShell.current?.(null)
      shell.destroy()
    }
  }, [featureUrl])

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* note: The fallback card stays under the invisible iframe until proof of life, so a dead origin's error page is never visible. */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${status === 'live' ? 'opacity-0' : 'opacity-100'}`}>
        <DemoFallbackCard entry={entry} status={status === 'offline' ? 'offline' : 'connecting'} />
      </div>
      <div
        ref={container}
        aria-label="Live clock demo"
        className={`absolute inset-0 transition-opacity duration-700 ${status === 'live' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
    </div>
  )
}
