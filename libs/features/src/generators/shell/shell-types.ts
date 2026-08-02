import type { ActionDescription, DisplayMode, FeatureContract } from '../../shared/types'
import { schemaToType } from './schema-type'
import { formatKey } from './source-literal'

// note: The generated declarations are structural (no type imports from the SDK), so the shell's d.ts stays fully usable for consumers who install nothing but the packed tarball. Everything mode-specific is emitted only when the feature declared the mode — undeclared modes are absent from the types just as they are absent from the bundle.

const SANDBOX_TYPES = `/**
 * Containment opt-ins for a sandboxed feature frame.
 *
 * Enabling \`sandbox\` starts the frame from the browser's deny-all sandbox.
 * The SDK always returns \`allow-scripts\` (the feature runtime is JavaScript)
 * and grants \`allow-same-origin\` only to cross-origin feature URLs — a
 * same-origin frame holding both tokens could remove its own sandbox, so that
 * pairing cannot be expressed. Every opt-in defaults to \`false\` (denied).
 */
export interface FeatureSandboxOptions {
  /** Allow the feature to submit forms; defaults to \`false\`. */
  forms?: boolean
  /** Allow the feature to open popup windows; defaults to \`false\`. */
  popups?: boolean
  /** Allow the feature to open modal dialogs (\`alert\`, \`confirm\`, \`print\`); defaults to \`false\`. */
  modals?: boolean
  /** Allow the feature to trigger file downloads; defaults to \`false\`. */
  downloads?: boolean
  /** Allow user-activated top-level navigation; unrestricted top navigation is deliberately not offered. */
  topNavigationByUserActivation?: boolean
}`

const PLUGIN_TYPES = `/** Context handed to an experience plugin around the feature's mount lifecycle. */
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
}`

/**
 * The set of mode-dependent facts the type builders branch on.
 */
interface ModeFlags {
  /** The declared modes, in declaration order. */
  modes: DisplayMode[]
  /** Whether the embedded mode is declared. */
  embedded: boolean
  /** Whether the dialog mode is declared. */
  dialog: boolean
  /** Whether the popup mode is declared. */
  popup: boolean
  /** Whether any iframe mode (embedded or dialog) is declared. */
  framed: boolean
}

/**
 * Derives the {@link ModeFlags} for a declared mode list.
 *
 * @param modes - The declared modes.
 * @returns The flags the builders branch on.
 */
function deriveModeFlags(modes: DisplayMode[]): ModeFlags {
  const embedded = modes.includes('embedded')
  const dialog = modes.includes('dialog')
  return { modes, embedded, dialog, popup: modes.includes('popup'), framed: embedded || dialog }
}

/**
 * Renders the `FeatureShellOptions` members for the declared modes.
 *
 * @param flags - The declared-mode flags.
 * @returns The member lines of the options interface.
 */
function buildOptionMembers(flags: ModeFlags): string[] {
  const members: string[] = []
  if (flags.embedded) {
    members.push(
      `  /** Anchor element (or CSS selector) the embedded feature mounts into; required by embedded mode. */
  container${flags.modes[0] === 'embedded' ? '' : '?'}: string | HTMLElement`,
      `  /** Fixed embedded width in pixels; with \`embedHeight\`, the iframe receives exactly these dimensions instead of filling its container. */
  embedWidth?: number`,
      `  /** Fixed embedded height in pixels; see \`embedWidth\`. */
  embedHeight?: number`
    )
  }
  members.push(
    `  /** Stable identifier for the feature; seeds the broker name surfaced in debug logs. */
  name?: string`,
    `  /** How the feature should be surfaced; defaults to \`${flags.modes[0]}\`. */
  displayMode?: FeatureDisplayMode`,
    `  /** URL of the feature app to load; defaults to the URL baked in from the feature config. */
  url?: string`
  )
  if (flags.dialog) {
    members.push(
      `  /** Width in pixels of the feature's inner dialog box, applied by the feature inside the full-viewport dialog pane; when absent, derived from the viewport. */
  dialogWidth?: number`,
      `  /** Height in pixels of the feature's inner dialog box; see \`dialogWidth\`. */
  dialogHeight?: number`,
      `  /** Where the inner dialog box sits inside the pane; defaults to \`center\`. */
  dialogPosition?: FeatureBoxPosition`,
      `  /** How the shell reacts to a pointer interaction on the dialog backdrop; defaults to \`close\`. */
  dialogBackdrop?: 'close' | 'event' | 'none'`,
      `  /** Whether Escape closes the dialog (enforced on both sides of the boundary); defaults to \`true\`. */
  closeOnEscape?: boolean`
    )
  }
  if (flags.popup) {
    members.push(
      `  /** Popup window width in pixels; when absent, derived from the viewport. */
  popupWidth?: number`,
      `  /** Popup window height in pixels; see \`popupWidth\`. */
  popupHeight?: number`,
      `  /** Where the popup window sits on the screen; defaults to \`center\`. */
  popupPosition?: FeatureBoxPosition`
    )
  }
  if (flags.framed) {
    members.push(
      `  /**
   * Permissions-Policy features delegated to the feature frame (the iframe
   * \`allow\` attribute). Defaults to the needs the feature declared at build
   * time; a host-supplied list replaces the baked one entirely. Only the
   * iframe modes apply it.
   */
  permissions?: readonly string[]`,
      `  /**
   * Containment posture for the feature frame; \`true\` (or an opt-in object)
   * starts from the browser's deny-all sandbox. Host-decreed, never baked.
   * Only the iframe modes can be sandboxed — a windowed mode with a sandbox
   * set throws.
   */
  sandbox?: boolean | FeatureSandboxOptions`
    )
  }
  members.push(
    `  /** How the host reacts when the feature stops responding; defaults to \`emit\`. */
  onUnresponsive?: 'emit' | 'unmount' | ((info: FeatureUnresponsiveInfo) => void)`,
    `  /** Security envelope to negotiate; defaults to the protocol baked in from the feature's build. */
  protocol?: FeatureSecurityProtocol`,
    `  /** Pre-shared key used by the \`v2\` protocol; always supplied by the host, never baked into the shell. */
  sharedKey?: string`,
    `  /** Experience plugins wrapped around each mount/unmount. */
  plugins?: readonly FeatureExperiencePlugin[]`,
    `  /**
   * Milliseconds the shell waits for the feature to complete the connection
   * handshake before emitting an \`error\` with \`reason: 'open-timeout'\` and
   * tearing the mount down; defaults to 10000.
   *
   * Opening is asynchronous: \`isOpen\` stays \`false\` and the \`open\` event
   * fires only once the wire handshake completes. \`send\` calls issued in
   * between queue and flush on open.
   */
  openTimeoutMs?: number`
  )
  return members
}

/**
 * Renders the mode-dependent static type block.
 *
 * @param flags - The declared-mode flags.
 * @returns The static type declarations for the shell.
 */
function buildStaticTypes(flags: ModeFlags): string {
  const lifecycleEvents = ['open', 'closing', 'close', 'error', 'status', 'dirty-state', ...(flags.dialog ? ['dismiss'] : [])]
  const positionType = `/** Where a positioned box sits inside its available area; \`center\` is the default. */
export type FeatureBoxPosition =
  | 'center'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

`
  return `/** The display modes this feature declares; other modes are excluded from the generated shell. */
export type FeatureDisplayMode = ${flags.modes.map((mode) => `'${mode}'`).join(' | ')}

/** Security envelope selector negotiated between host and feature. */
export type FeatureSecurityProtocol = 'none' | 'v1' | 'v2'

${flags.dialog || flags.popup ? positionType : ''}${flags.framed ? `${SANDBOX_TYPES}\n\n` : ''}${PLUGIN_TYPES}

/**
 * Options accepted by \`createFeatureShell\`; anything omitted falls back to the
 * defaults baked in from the feature's build.
 */
export interface FeatureShellOptions {
${buildOptionMembers(flags).join('\n')}
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

/** Per-request settings accepted by \`request\`. */
export interface FeatureRequestOptions {
  /** Milliseconds to wait for the response before rejecting; defaults to 30000. */
  timeoutMs?: number
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
   * Sends a contract request to the feature and resolves with its response.
   *
   * @param type - Action type from the feature contract's accepted list.
   * @param data - Payload matching the action's schema.
   * @param options - Per-request settings such as \`timeoutMs\`.
   * @returns A promise settling with the feature's response payload.
   */
  request<T extends HostSendType>(type: T, data?: HostSendPayloads[T], options?: FeatureRequestOptions): Promise<unknown>
  /**
   * Registers the handler that answers feature requests of a given type.
   *
   * @param type - Request type from the feature contract's emitted list.
   * @param handler - Receives the typed request payload and returns the response value or a promise of it.
   * @returns A function that unregisters this handler.
   */
  handle<T extends HostEventType>(type: T, handler: (data: HostEventPayloads[T]) => unknown): () => void
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
  on(event: ${lifecycleEvents.map((event) => `'${event}'`).join(' | ')}, handler: (data?: unknown) => void): () => void
  /** Whether the feature channel is currently open (\`true\` while connected). */
  readonly isOpen: boolean
  /** Whether the feature has declared unsaved work; mirrors the feature's last dirty-state report. */
  readonly isDirty: boolean
}`
}

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
 * Builds the shell's full generated type surface for a feature contract
 * and its declared display modes.
 *
 * Emits payload maps and literal action-name unions projected from the
 * contract, plus structural shell option and handle types narrowed to the
 * declared modes, so the shell's declarations resolve with no dependencies
 * beyond the DOM lib and an undeclared mode is a type error before it is a
 * runtime one.
 *
 * @param contract - The feature contract driving the projected types.
 * @param modes - The display modes the feature declared, in declaration order.
 * @returns The type declaration block for the shell entry.
 *
 * @example Projecting the clock contract
 * ```typescript
 * buildShellTypes({ emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] }, ['embedded'])
 * // => source containing "export type FeatureDisplayMode = 'embedded'"
 * ```
 */
export function buildShellTypes(contract: FeatureContract, modes: DisplayMode[]): string {
  return `${buildPayloadInterface('HostSendPayloads', 'Payloads for actions the host can send, keyed by action type from the feature contract.', contract.accepted)}

${buildPayloadInterface('HostEventPayloads', 'Payloads for events the feature emits to the host, keyed by event type from the feature contract.', contract.emitted)}

/** Action types the host can send to the feature. */
export type HostSendType = keyof HostSendPayloads

/** Event types the feature emits to the host. */
export type HostEventType = keyof HostEventPayloads

${buildStaticTypes(deriveModeFlags(modes))}`
}
