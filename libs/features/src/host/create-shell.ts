import type { FeatureContract, ShellOptions } from '../shared/types'
import type { ShellHandle } from './types'
import { DEFAULT_CONTRACT, createBroker } from '@hyperfrontend/nexus'
import { withControlContract } from '../shared/control'
import { createEventEmitter } from '../shared/event-emitter'
import { selectMount } from './display-modes/registry'
import { createHeartbeatMonitor } from './heartbeat'
import { createShellHandle } from './lifecycle'
import { registerSecurity } from './security'

// note: One broker per shell, each caching its own channels.
let shellCount = 0

/**
 * Builds a human-readable broker name from a shell's options.
 *
 * Slugs the most identifying option (explicit `name`, else feature URL host,
 * else container selector) so a broker reads as e.g. `shell-clock-1` in debug
 * logs rather than a bare counter; the sequence keeps the name unique per shell.
 *
 * @param options - The shell options to derive an identity from.
 * @param sequence - Monotonic counter ensuring uniqueness across shells.
 * @returns A slugged, unique broker name.
 *
 * @example Naming a shell from its url
 * ```typescript
 * deriveShellName({ container: '#clock', url: 'https://clock.example.com' }, 1) // 'shell-clock-example-com-1'
 * ```
 */
export function deriveShellName(options: ShellOptions, sequence: number): string {
  const source = options.name ?? options.url ?? (typeof options.container === 'string' ? options.container : '')
  const slug = source
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug.length > 0 ? `shell-${slug}-${sequence}` : `shell-${sequence}`
}

/**
 * Creates a host-side shell for embedding a feature.
 *
 * Provisions a nexus broker and returns a handle whose `open` mounts the feature
 * in the requested display mode.
 *
 * @param options - Create-time shell options, overridable per `open` call.
 * @returns A handle exposing `open`, `close`, `destroy`, `send`, `on`, and `isOpen`.
 *
 * @example Embedding a clock feature
 * ```typescript
 * const clock = createShell({ container: '#clock', url: 'https://clock.example.com' })
 * clock.open({ displayMode: DisplayMode.Dialog, dialogWidth: 530 })
 * clock.on('timeUpdated', (data) => console.log(data))
 * ```
 */
export function createShell(options: ShellOptions): ShellHandle {
  const emitter = createEventEmitter()
  const contract = withControlContract(<FeatureContract>(options.contract ?? DEFAULT_CONTRACT))
  const broker = createBroker({ name: deriveShellName(options, (shellCount += 1)), contract })
  return createShellHandle(broker, options, emitter, { selectMount, registerSecurity, createHeartbeatMonitor })
}
