import type { ActionDescription, FeatureContract } from '../../shared/types'
import { schemaToType } from './schema-type'
import { formatKey } from './source-literal'

// note: The generated declarations are structural (no type imports from the SDK), so the connector's d.ts stays fully usable for consumers who install nothing but the packed tarball.
const STATIC_TYPES = `/** How the feature is surfaced by the host. */
export type FeatureDisplayMode = 'embedded' | 'dialog' | 'popup' | 'standalone'

/** Security envelope selector negotiated between host and feature. */
export type FeatureSecurityProtocol = 'none' | 'v1' | 'v2'

/** Context handed to an experience plugin around the feature's mount lifecycle. */
export interface FeaturePluginContext {
  /** In-document root the display mode mounted, or \`null\` for windowed modes. */
  element: HTMLElement | null
  /** The display mode the feature was surfaced in. */
  displayMode: FeatureDisplayMode
}

/** Opt-in extension that decorates the feature's mount lifecycle (e.g. transitions). */
export interface FeatureExperiencePlugin {
  /** Unique plugin name, surfaced in debug logs. */
  name: string
  /**
   * Runs after the feature mounts; may animate it in and return a teardown.
   *
   * @param context - The mounted element and its display mode.
   * @returns An optional teardown invoked on unmount.
   */
  onMount?(context: FeaturePluginContext): void | (() => void)
  /**
   * Runs before the feature unmounts; may defer teardown until an exit animation finishes.
   *
   * @param context - The mounted element and its display mode.
   * @returns Optionally a promise the shell awaits before tearing down.
   */
  onUnmount?(context: FeaturePluginContext): void | Promise<void>
}

/** Details handed to an unresponsive-feature callback when the feature stops responding. */
export interface FeatureUnresponsiveInfo {
  /** Consecutive missed heartbeats that tripped the watchdog. */
  missedBeats: number
  /** Timestamp (ms) of the last heartbeat received, or \`null\` if none ever arrived. */
  lastBeatAt: number | null
  /** The display mode the unresponsive feature was using. */
  displayMode: FeatureDisplayMode
  /** Closes the feature gracefully. */
  close(): void
  /** Closes the feature and releases all resources. */
  destroy(): void
}

/**
 * Options accepted by \`createFeatureShell\`; anything omitted falls back to the
 * defaults baked in from the feature's build.
 */
export interface FeatureShellOptions {
  /** Target element (or CSS selector) the embedded feature mounts into. */
  container: string | HTMLElement
  /** Stable identifier for the feature; seeds the broker name surfaced in debug logs. */
  name?: string
  /** How the feature should be surfaced; defaults to \`embedded\`. */
  displayMode?: FeatureDisplayMode
  /** URL of the feature app to load; defaults to the URL baked in from the feature config. */
  url?: string
  /** How an embedded feature is sized; defaults to \`fill\` (the iframe fills its container). */
  embedSizing?: 'fill' | 'content'
  /** How the host reacts when the feature stops responding; defaults to \`emit\`. */
  onUnresponsive?: 'emit' | 'unmount' | ((info: FeatureUnresponsiveInfo) => void)
  /** Whether pressing Escape closes the shell; defaults to \`true\`. */
  closeOnEscape?: boolean
  /** Dialog width in pixels (dialog mode only). */
  dialogWidth?: number
  /** Dialog height in pixels (dialog mode only). */
  dialogHeight?: number
  /** Whether the dialog renders a dimmed backdrop; defaults to \`true\`. */
  dialogOverlay?: boolean
  /** Security envelope to negotiate; defaults to the protocol baked in from the feature's build. */
  protocol?: FeatureSecurityProtocol
  /** Pre-shared key used by the \`v2\` protocol; always supplied by the host, never baked into the connector. */
  sharedKey?: string
  /** Experience plugins wrapped around each mount/unmount. */
  plugins?: readonly FeatureExperiencePlugin[]
  /**
   * Milliseconds the shell waits for the feature to complete the connection
   * handshake before emitting an \`error\` with \`reason: 'open-timeout'\` and
   * tearing the mount down; defaults to 10000.
   *
   * Opening is asynchronous: \`isOpen\` stays \`false\` and the \`open\` event
   * fires only once the wire handshake completes. \`send\` calls issued in
   * between queue and flush on open.
   */
  openTimeoutMs?: number
}

/** Error payload emitted when the feature never completes the connection handshake. */
export interface FeatureOpenTimeoutError {
  /** Discriminates the open-timeout error from other \`error\` payloads. */
  reason: 'open-timeout'
  /** Milliseconds the shell waited before giving up. */
  elapsedMs: number
  /** The display mode the feature was being surfaced in. */
  displayMode: FeatureDisplayMode
}

/** Handle returned by \`createFeatureShell\`, narrowed to the feature's contract. */
export interface FeatureShellHandle {
  /**
   * Mounts the feature using the merged baked defaults and call-time options.
   *
   * @param options - Per-open overrides layered over the baked and create-time options.
   */
  open(options?: Partial<FeatureShellOptions>): void
  /** Closes the feature gracefully, disconnecting the messaging channel. */
  close(): void
  /** Closes the feature and releases all resources (channel and DOM). */
  destroy(): void
  /**
   * Sends a contract action to the feature.
   *
   * @param type - Action type from the feature contract's accepted list.
   * @param data - Payload matching the action's schema.
   */
  send<T extends HostSendType>(type: T, data?: HostSendPayloads[T]): void
  /**
   * Subscribes to a feature event with its contract-typed payload.
   *
   * @param event - Event type from the feature contract's emitted list.
   * @param handler - Callback invoked with the typed event payload.
   * @returns A function that removes this subscription.
   */
  on<T extends HostEventType>(event: T, handler: (data: HostEventPayloads[T]) => void): () => void
  /**
   * Subscribes to a shell lifecycle event.
   *
   * @param event - Lifecycle event name.
   * @param handler - Callback invoked when the event fires.
   * @returns A function that removes this subscription.
   */
  on(event: 'open' | 'close' | 'error', handler: (data?: unknown) => void): () => void
  /** Whether the feature channel is currently open (\`true\` while connected). */
  readonly isOpen: boolean
}
`

/**
 * Escapes a contract description for safe embedding inside a JSDoc comment.
 *
 * @param description - The raw description text.
 * @returns The text with any comment terminator defused.
 */
function escapeDoc(description: string): string {
  return description.split('*/').join('*\\/')
}

/**
 * Renders one payload-map member for an action, with its description as JSDoc.
 *
 * @param action - The contract action to render.
 * @returns The interface member source.
 */
function buildMember(action: ActionDescription): string {
  const doc = action.description === undefined ? '' : `  /** ${escapeDoc(action.description)} */\n`
  return `${doc}  ${formatKey(action.type)}: ${schemaToType(action.schema, '  ')}`
}

/**
 * Renders a payload-map interface keyed by action type.
 *
 * @param name - The interface identifier.
 * @param doc - The single-line JSDoc summary.
 * @param actions - The contract actions projected into members.
 * @returns The interface declaration source.
 */
function buildPayloadInterface(name: string, doc: string, actions: ActionDescription[]): string {
  const body = actions.length === 0 ? '' : `\n${actions.map(buildMember).join('\n')}\n`
  return `/** ${doc} */\nexport interface ${name} {${body}}`
}

/**
 * Builds the connector's full generated type surface for a feature contract.
 *
 * Emits payload maps and literal action-name unions projected from the
 * contract, plus structural shell option and handle types, so the connector's
 * declarations resolve with no dependencies beyond the DOM lib.
 *
 * @param contract - The feature contract driving the projected types.
 * @returns The type declaration block for the connector entry.
 *
 * @example Projecting the clock contract
 * ```typescript
 * buildConnectorTypes({ emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] })
 * // => source containing "export interface HostSendPayloads { setTimezone: unknown }"
 * ```
 */
export function buildConnectorTypes(contract: FeatureContract): string {
  return `${buildPayloadInterface('HostSendPayloads', 'Payloads for actions the host can send, keyed by action type from the feature contract.', contract.accepted)}

${buildPayloadInterface('HostEventPayloads', 'Payloads for events the feature emits to the host, keyed by event type from the feature contract.', contract.emitted)}

/** Action types the host can send to the feature. */
export type HostSendType = keyof HostSendPayloads

/** Event types the feature emits to the host. */
export type HostEventType = keyof HostEventPayloads

${STATIC_TYPES}`
}
