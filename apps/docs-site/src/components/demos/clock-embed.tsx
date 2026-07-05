'use client'

import type { createFeatureShell } from '@hyperfrontend/demo-clock-shell'
import { useEffect, useRef, useState } from 'react'
import { defineProperty } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

/** The shell handle type, inferred from the vendored connector's factory. */
type ClockShell = ReturnType<typeof createFeatureShell>

/** Liveness of the embedded feature. */
export type EmbedStatus = 'connecting' | 'live' | 'offline'

/** Milliseconds to wait for proof of life before degrading to the poster. */
const LIVENESS_TIMEOUT_MS = 6000

/** Props for {@link ClockEmbed}. */
export interface ClockEmbedProps {
  /** URL the clock feature app is served from. */
  featureUrl: string
  /** Committed poster shown until the feature proves it is alive (and as the offline fallback). */
  poster: string
  /** Extra classes for the mount container. */
  className?: string
  /** Notified whenever the embed's liveness changes. */
  onStatus?: (status: EmbedStatus) => void
}

/**
 * Embeds the live clock feature through its vendored shell package, degrading
 * gracefully to the committed poster.
 *
 * The poster renders immediately and the feature iframe mounts invisible on top.
 * A healthy feature emits `postMessage` traffic (heartbeats, size announcements,
 * ticks) within about a second, so the first message from the feature's origin
 * is treated as proof of life and crossfades the iframe in. If nothing arrives
 * before the timeout — origin not provisioned, service down — the poster simply
 * stays, so an error page (e.g. Railway's 404) is never shown to visitors.
 *
 * The shell is imported dynamically inside an effect because the host SDK touches
 * `window` at module scope, and `SharedArrayBuffer` is stubbed
 * first because the SDK's load-time code probes it with `instanceof` on pages
 * without cross-origin isolation.
 * @param root0
 * @param root0.featureUrl
 * @param root0.poster
 * @param root0.className
 * @param root0.onStatus
 */
export function ClockEmbed({ featureUrl, poster, className, onStatus }: ClockEmbedProps) {
  const container = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<EmbedStatus>('connecting')
  const notify = useRef(onStatus)
  notify.current = onStatus

  useEffect(() => {
    const element = container.current
    if (!element) {
      return
    }
    let shell: ClockShell | null = null
    let disposed = false
    let featureOrigin = ''
    try {
      featureOrigin = createURL(featureUrl, window.location.href).origin
    } catch {
      featureOrigin = ''
    }

    const apply = (next: EmbedStatus) => {
      if (!disposed) {
        setStatus(next)
        notify.current?.(next)
      }
    }

    // how: Proof of life — any message from the feature's origin means the app
    const onMessage = (event: MessageEvent) => {
      if (event.origin === featureOrigin) {
        apply('live')
      }
    }
    window.addEventListener('message', onMessage)
    const deadline = setTimeout(() => apply('offline'), LIVENESS_TIMEOUT_MS)

    // why: without this stub the shell module throws on load in any page that is not cross-origin isolated.
    if (!('SharedArrayBuffer' in globalThis)) {
      defineProperty(globalThis, 'SharedArrayBuffer', { value: class SharedArrayBuffer {}, configurable: true })
    }

    void import('@hyperfrontend/demo-clock-shell').then((module) => {
      if (disposed) {
        return
      }
      shell = module.createFeatureShell({ container: element, url: featureUrl })
      // note: the SDK drops heartbeats and misreports the live feature as unresponsive; swallow that lifecycle error.
      shell.on('error', () => undefined)
      shell.open()
    })

    return () => {
      disposed = true
      window.removeEventListener('message', onMessage)
      clearTimeout(deadline)
      shell?.destroy()
    }
  }, [featureUrl])

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* note: The poster stays under the invisible iframe until proof of life, so a dead origin's error page is never visible. */}
      <img
        src={poster}
        alt="Clock demo preview"
        draggable={false}
        className={`absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-700 ${status === 'live' ? 'opacity-0' : 'opacity-100'}`}
      />
      <div
        ref={container}
        aria-label="Live clock demo"
        className={`absolute inset-0 transition-opacity duration-700 ${status === 'live' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
    </div>
  )
}
