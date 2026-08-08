'use client'

import { createFeatureShell as createClockShell } from '@hyperfrontend/demo-clock-shell'
import { createFeatureShell as createHeartbeatShell } from '@hyperfrontend/demo-heartbeat-shell'
import { createFeatureShell as createKoiPondShell } from '@hyperfrontend/demo-koi-pond-shell'

/** Per-request settings accepted by a demo shell request. */
export interface DemoRequestOptions {
  /** Milliseconds to wait for the response before rejecting. */
  timeoutMs?: number
}

/**
 * Structural surface of a generated demo shell handle — the members the
 * gallery drives on every demo, regardless of which contract the shell was
 * generated from. Demo-specific code narrows `send`/`request`/`on` types by
 * knowing its own contract.
 */
export interface DemoShell {
  /** Mounts the feature and starts the wire handshake. */
  open(): void
  /** Closes the feature gracefully through the polite close exchange. */
  close(): void
  /** Closes the feature and releases all resources. */
  destroy(): void
  /** Sends a contract action to the feature. */
  send(type: string, data?: unknown): void
  /** Sends a contract request and resolves with the feature's response. */
  request(type: string, data?: unknown, options?: DemoRequestOptions): Promise<unknown>
  /** Subscribes to a feature or lifecycle event; returns the unsubscribe. */
  on(event: string, handler: (data?: unknown) => void): () => void
  /** Whether the feature channel is currently open. */
  readonly isOpen: boolean
}

/** Options the gallery passes when creating a demo shell session. */
export interface DemoShellMountOptions {
  /** Element the embedded feature mounts into. */
  container: HTMLElement
  /** URL of the deployed feature app. */
  url: string
  /** Windowed display mode for extra console sessions; omitted for the embedded default. */
  displayMode?: 'dialog' | 'popup'
}

/** Per-demo wiring: how the gallery creates and reads a demo's generated shell. */
export interface DemoWiring {
  /** Creates a shell session against the demo's deployed feature app. */
  createShell(options: DemoShellMountOptions): DemoShell
  /** Contract-and-protocol pill copy for the host console. */
  contractLabel: string
  /** Feature events that prove the app is rendering — the embed crossfades in on the first one. */
  proofEvents: readonly string[]
  /** Milliseconds of product-event silence tolerated before the embed degrades to the fallback card. */
  silenceTimeoutMs: number
  /** Host-owned stage effects reacting to the demo's contract events, drawn on the embed's overlay layer; returns the teardown. */
  attachEffects?(shell: DemoShell, layer: HTMLElement): () => void
}

/**
 * Narrows an unknown event payload to a plain record.
 *
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Horizontal drop positions the heart sprites cycle through, as percentages of the stage width. */
const HEART_SPRITE_LANES = [32, 56, 44, 66, 24]

/**
 * The heartbeat demo's host-side stage effects: every visitor-triggered beat
 * floats a heart sprite up the stage, and a flatline materialises a skull that
 * any returning beat dispels — the host reacting to the hostee's contract
 * events, exactly as the demo's own host page does.
 *
 * @param shell - The heartbeat demo's live shell handle.
 * @param layer - The overlay element the sprites are drawn on.
 * @returns The teardown removing subscriptions and any lingering sprite.
 */
function attachHeartbeatEffects(shell: DemoShell, layer: HTMLElement): () => void {
  let lane = 0
  let skull: HTMLSpanElement | null = null
  const hideSkull = () => {
    skull?.remove()
    skull = null
  }
  const showSkull = () => {
    if (skull) {
      return
    }
    skull = document.createElement('span')
    skull.textContent = '💀'
    skull.style.cssText = 'position:absolute;left:50%;top:42%;font-size:72px;line-height:1;'
    layer.append(skull)
    skull.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0.9 },
      ],
      { duration: 900, easing: 'ease-out', fill: 'forwards' }
    )
  }
  const spawnHeart = () => {
    const sprite = document.createElement('span')
    sprite.textContent = '❤️'
    sprite.style.cssText = `position:absolute;bottom:34%;font-size:26px;line-height:1;left:${HEART_SPRITE_LANES[(lane += 1) % HEART_SPRITE_LANES.length]}%;`
    layer.append(sprite)
    const float = sprite.animate(
      [
        { transform: 'translateY(0) scale(0.6)', opacity: 1 },
        { transform: 'translateY(-130px) scale(1.35)', opacity: 0 },
      ],
      { duration: 1100, easing: 'ease-out' }
    )
    float.onfinish = () => sprite.remove()
  }
  const subscriptions = [
    shell.on('beat', (data) => {
      // why: A beat of any source is life — it dispels the skull; only visitor-triggered extras earn a sprite.
      hideSkull()
      if (isRecord(data) && data['source'] === 'user') {
        spawnHeart()
      }
    }),
    shell.on('rhythm', (data) => {
      if (isRecord(data) && data['state'] === 'flatline') {
        showSkull()
      } else if (isRecord(data) && (data['state'] === 'beating' || data['state'] === 'recovering')) {
        hideSkull()
      }
    }),
  ]
  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe())
    hideSkull()
  }
}

/** One wiring per live demo slug — a manifest entry gains a live embed by landing its vendored shell here. */
const WIRINGS: Record<string, DemoWiring | undefined> = {
  clock: {
    createShell: (options) => createClockShell(options),
    contractLabel: 'contract 0.3.0 · protocol v1',
    // why: The clock streams a tick at 1 Hz from open, so the first tick proves the app renders.
    proofEvents: ['tick'],
    silenceTimeoutMs: 6000,
  },
  'koi-pond': {
    createShell: (options) => createKoiPondShell(options),
    contractLabel: 'contract 0.1.0 · protocol v1',
    // why: The pond reports its connected shoal as each koi lands, so the first `shoal` proves the scene is assembling behind the frame.
    proofEvents: ['shoal'],
    // why: An undisturbed pond is silent by design — it only speaks when the shoal changes or a scatter unwinds, so the budget must outlast a long calm.
    silenceTimeoutMs: 30000,
  },
  heartbeat: {
    createShell: (options) => createHeartbeatShell(options),
    contractLabel: 'contract 0.2.0 · protocol v1',
    // why: Every contraction crosses as a beat and every state change as a rhythm — either one proves the heart renders.
    proofEvents: ['beat', 'rhythm'],
    // why: A visitor holding the heart to flatline silences product traffic on purpose; the budget must outlast any plausible hold.
    silenceTimeoutMs: 20000,
    attachEffects: attachHeartbeatEffects,
  },
}

/**
 * Resolves the gallery wiring for a demo slug.
 *
 * @param slug - The demo's manifest slug.
 * @returns The demo's wiring, or `undefined` while it has no vendored shell.
 */
export function demoWiringFor(slug: string): DemoWiring | undefined {
  return WIRINGS[slug]
}
