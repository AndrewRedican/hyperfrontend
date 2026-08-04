'use client'

import { createFeatureShell as createClockShell } from '@hyperfrontend/demo-clock-shell'
import { createFeatureShell as createHeartbeatShell } from '@hyperfrontend/demo-heartbeat-shell'

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
}

/** One wiring per live demo slug — a manifest entry gains a live embed by landing its vendored shell here. */
const WIRINGS: Record<string, DemoWiring | undefined> = {
  clock: {
    createShell: (options) => createClockShell(options),
    contractLabel: 'contract 0.2.0 · protocol v1',
    // why: The clock streams a tick at 1 Hz from open, so the first tick proves the app renders.
    proofEvents: ['tick'],
    silenceTimeoutMs: 6000,
  },
  heartbeat: {
    createShell: (options) => createHeartbeatShell(options),
    contractLabel: 'contract 0.1.0 · protocol none',
    // why: Every contraction crosses as a beat and every state change as a rhythm — either one proves the heart renders.
    proofEvents: ['beat', 'rhythm'],
    // why: A visitor holding the heart to flatline silences product traffic on purpose; the budget must outlast any plausible hold.
    silenceTimeoutMs: 20000,
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
