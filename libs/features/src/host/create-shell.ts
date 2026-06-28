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
 * Reports whether a char code is slug-worthy (an ASCII alphanumeric).
 *
 * Everything else is treated as a separator and collapsed to a single dash.
 *
 * @param code - The UTF-16 code unit to test.
 * @returns True for `0-9`, `A-Z`, or `a-z`.
 */
function isSlugChar(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

/**
 * Strips a leading `scheme://` prefix so a url slugs from its host, not its protocol.
 *
 * Only an all-alphabetic scheme is stripped; anything else is left untouched so
 * the source still slugs predictably.
 *
 * @param source - The raw identity string.
 * @returns The string with any leading `scheme://` removed.
 */
function stripScheme(source: string): string {
  const marker = '://'
  const index = source.indexOf(marker)
  if (index <= 0) {
    return source
  }
  for (let cursor = 0; cursor < index; cursor += 1) {
    const code = source.charCodeAt(cursor)
    if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122))) {
      return source
    }
  }
  return source.slice(index + marker.length)
}

/**
 * Lowercases a string into a dash-separated slug.
 *
 * Collapses every run of non-alphanumeric characters into a single dash and
 * trims leading and trailing dashes. Linear scan with no backtracking, so it
 * stays fast on adversarial input (e.g. long runs of separators).
 *
 * @param source - The raw identity string to slug.
 * @returns The lowercased slug, or an empty string when nothing slug-worthy remains.
 */
function slugify(source: string): string {
  const stripped = stripScheme(source)
  let slug = ''
  let pendingDash = false
  for (let index = 0; index < stripped.length; index += 1) {
    const code = stripped.charCodeAt(index)
    if (isSlugChar(code)) {
      if (pendingDash && slug.length > 0) {
        slug += '-'
      }
      pendingDash = false
      slug += stripped[index].toLowerCase()
    } else {
      pendingDash = true
    }
  }
  return slug
}

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
  const slug = slugify(source)
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
