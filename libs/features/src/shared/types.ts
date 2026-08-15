import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Supported ways a host can surface an embedded feature.
 *
 * The host selects the mode; a feature declares which modes it supports in its
 * `feature.config.*` `display.modes`, and the generated shell composes exactly
 * those.
 */
export const DisplayMode = freeze(<const>{
  /** Inline inside a host-provided container element; the iframe fills the container. */
  Embedded: 'embedded',
  /** Full-viewport transparent overlay pane; the feature draws its dialog box (and backdrop) inside it. */
  Dialog: 'dialog',
  /** Separate sized browser popup window. */
  Popup: 'popup',
  /** Full browser tab/window opened via `_blank`. */
  Standalone: 'standalone',
})

/**
 * Union of the supported display-mode values.
 */
export type DisplayMode = (typeof DisplayMode)[keyof typeof DisplayMode]

/**
 * How the host reacts when the feature reports a pointer interaction on the
 * dialog backdrop (the transparent area outside the feature's dialog box).
 *
 * `close` (the default) treats the interaction as a close request and starts
 * the polite teardown; `event` surfaces it as a `dismiss` event for the host
 * consumer to handle; `none` ignores it.
 */
export type BackdropBehavior = 'close' | 'event' | 'none'

/**
 * Where a hostee dismiss signal originated: a pointer interaction on the
 * dialog backdrop, or the Escape key pressed inside the feature's document.
 */
export type DismissSource = 'backdrop' | 'escape'

/**
 * Where a positioned box sits inside its available area: the dialog inner box
 * within the full-viewport pane, or the popup window on the screen.
 *
 * `center` (the default) centers on both axes; the compound values anchor to
 * an edge or corner of the area.
 */
export type BoxPosition =
  | 'center'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/**
 * Union of the supported security envelope selectors.
 *
 * `none` is the local default (opt-in security); production builds must pick
 * `v1` or `v2`.
 */
export type SecurityProtocol = 'none' | 'v1' | 'v2'

/**
 * A Permissions-Policy feature name the host can delegate to the feature frame.
 *
 * Browsers deny powerful features (camera, fullscreen, clipboard, …) to
 * cross-origin frames by default, so a feature that needs one only works when
 * the host delegates it. The union lists the common names for editor
 * completion; any string the browser understands is accepted.
 */
export type FeaturePermission =
  | 'accelerometer'
  | 'autoplay'
  | 'camera'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'display-capture'
  | 'encrypted-media'
  | 'fullscreen'
  | 'gamepad'
  | 'geolocation'
  | 'gyroscope'
  | 'magnetometer'
  | 'microphone'
  | 'midi'
  | 'payment'
  | 'picture-in-picture'
  | 'publickey-credentials-get'
  | 'screen-wake-lock'
  | 'usb'
  | 'web-share'
  | 'xr-spatial-tracking'
  | (string & {})

/**
 * Containment opt-ins for a sandboxed feature frame.
 *
 * Enabling {@link ShellOptions.sandbox} starts the frame from the browser's
 * deny-all sandbox and returns capabilities selectively. Two tokens are managed
 * by the SDK and are not configurable: `allow-scripts` is always present (the
 * feature runtime is JavaScript, so a script-less frame can never connect), and
 * `allow-same-origin` is granted only when the feature URL resolves to a
 * different origin than the host page — a same-origin frame holding both
 * tokens could remove its own sandbox, so that pairing cannot be expressed.
 * A sandboxed same-origin feature therefore runs with an opaque origin (no
 * cookies or storage); the messaging protocol still connects. Every opt-in
 * below defaults to `false` (denied).
 */
export interface SandboxOptions {
  /** Allow the feature to submit forms; defaults to `false`. */
  forms?: boolean
  /** Allow the feature to open popup windows; defaults to `false`. */
  popups?: boolean
  /** Allow the feature to open modal dialogs (`alert`, `confirm`, `print`); defaults to `false`. */
  modals?: boolean
  /** Allow the feature to trigger file downloads; defaults to `false`. */
  downloads?: boolean
  /**
   * Allow the feature to navigate the top-level page in response to a user
   * activation (e.g. a clicked link targeting `_top`); defaults to `false`.
   * Unrestricted top-level navigation is deliberately not offered — it enables
   * an entire class of takeover incidents that user-activation gating avoids.
   */
  topNavigationByUserActivation?: boolean
}

/**
 * Context passed to an {@link UnresponsivePolicy} callback when a feature stops beating.
 */
export interface UnresponsiveInfo {
  /** Consecutive missed beats that tripped the watchdog. */
  missedBeats: number
  /** Timestamp (ms) of the last beat received, or `null` if none ever arrived. */
  lastBeatAt: number | null
  /** The display mode the unresponsive feature was using. */
  displayMode: DisplayMode
  /** Closes the feature gracefully. */
  close(): void
  /** Closes the feature and releases all resources. */
  destroy(): void
}

/**
 * What the host does when a feature misses too many heartbeats while visible.
 *
 * `emit` (the default) emits an `error` carrying `{ reason: 'unresponsive', missedBeats, lastBeatAt, displayMode }`;
 * `unmount` also tears the feature down after emitting the same error; a
 * callback takes over handling entirely with the {@link UnresponsiveInfo}.
 * The policy runs once per `suspect` episode: a recovering beat returns the feature
 * to `healthy` and re-arms it. While either page is hidden the watchdog pauses
 * instead (`unobservable`) — throttled timers make silence weak evidence.
 */
export type UnresponsivePolicy = 'emit' | 'unmount' | ((info: UnresponsiveInfo) => void)

/**
 * Description of a single action a feature can emit or accept.
 *
 * Structurally compatible with nexus's channel contract action shape so the
 * same contract can drive both messaging and the shell type generator.
 */
export interface ActionDescription {
  /** Wire type string that identifies the action. */
  type: string
  /** Human-readable explanation of the action, surfaced in tooling. */
  description?: string
  /** Optional JSON-schema-like shape describing the action payload. */
  schema?: object
  /** When this action is used as a request, the type of the action in the other direction that answers it. */
  respondsWith?: string
  /**
   * Marks an accepted action as essential for correct operation: the
   * connection is denied at handshake time unless the counterpart emits this
   * type. Only meaningful on `accepted` entries. Unflagged actions never gate
   * the connection, so additive contract evolution stays non-breaking.
   */
  required?: boolean
}

/**
 * The set of actions a feature emits to, and accepts from, its counterpart.
 *
 * This is the same shape the on-disk `*.contract.json` files and the shell
 * generator consume.
 */
export interface FeatureContract {
  /** Actions this side sends to the other side. */
  emitted: ActionDescription[]
  /** Actions this side handles from the other side. */
  accepted: ActionDescription[]
  /**
   * Optional semver version announcing the contract cut this side holds.
   * Builds canonicalize and bake it into the generated shell; the two sides compare
   * their announcements during the connection handshake and incompatible cuts
   * are denied before the channel opens. Absent on either side, the check
   * passes, so unversioned peers keep connecting.
   */
  version?: string
}

/**
 * Context handed to an {@link ExperiencePlugin} around a feature's mount lifecycle.
 */
export interface ExperiencePluginContext {
  /**
   * The in-document root the display mode mounted: the iframe for `embedded`,
   * the dialog container for `dialog`, and `null` for `popup` and
   * `standalone`, which open a separate window with no in-document element.
   */
  element: HTMLElement | null
  /** The display mode the feature was surfaced in. */
  displayMode: DisplayMode
}

/**
 * Opt-in extension that decorates a feature's mount lifecycle (e.g. transitions, animations).
 *
 * Register plugins through {@link ShellOptions.plugins}. After each successful
 * mount the shell calls `onMount` on every plugin in registration order; before
 * each unmount it calls `onUnmount` one plugin at a time in reverse
 * registration order, awaiting any returned promise, then runs the teardowns
 * returned by `onMount` (also in reverse registration order) and finally
 * removes the feature. The SDK ships no built-in plugins.
 *
 * @example Registering a fade-out plugin on a shell
 * ```typescript
 * const shell = createShell({
 *   container: '#shell',
 *   plugins: [
 *     {
 *       name: 'fade',
 *       onUnmount: ({ element }) => (element ? animateFadeOut(element) : undefined),
 *     },
 *   ],
 * })
 * ```
 */
export interface ExperiencePlugin {
  /** Unique plugin name, surfaced in debug logs. */
  name: string
  /**
   * Runs after the feature mounts; may animate it in and return a teardown.
   *
   * A thrown error surfaces as an `error` event on the shell and does not
   * stop the remaining plugins from mounting.
   *
   * @param context - The mounted element and its display mode.
   * @returns An optional teardown invoked on unmount, after every `onUnmount` has settled.
   */
  onMount?(context: ExperiencePluginContext): void | (() => void)
  /**
   * Runs before the feature unmounts; may return a promise to defer teardown until an exit animation finishes.
   *
   * A rejected promise (or thrown error) surfaces as an `error` event on the
   * shell and teardown continues with the remaining plugins.
   *
   * @param context - The mounted element and its display mode.
   * @returns Optionally a promise the shell awaits before tearing down.
   */
  onUnmount?(context: ExperiencePluginContext): void | Promise<void>
}

/**
 * Options accepted by the host-side {@link FeatureContract} consumer when
 * creating or opening a shell.
 */
export interface ShellOptions {
  /** Anchor element (or CSS selector) the embedded feature mounts into; required by (and only meaningful for) embedded mode. */
  container?: string | HTMLElement
  /** Stable identifier for the feature; seeds the broker name surfaced in debug logs. */
  name?: string
  /**
   * The feature's contract exactly as the feature authored it (`emitted` = what
   * the feature sends, `accepted` = what the feature handles). The shell
   * derives the host-side orientation itself — hand it the feature's contract,
   * never a pre-swapped copy. Replaces the generic default when provided.
   */
  contract?: FeatureContract
  /** How the feature should be surfaced; defaults to {@link DisplayMode.Embedded}. */
  displayMode?: DisplayMode
  /** URL of the feature app to load. */
  url?: string
  /**
   * Fixed embedded width in pixels. When both `embedWidth` and `embedHeight`
   * are set, the embedded iframe receives exactly those dimensions instead of
   * filling its container, and the host application is responsible for placing
   * the container somewhere the feature fits — the SDK never distorts or
   * reinterprets fixed dimensions. Setting only one of the pair throws.
   */
  embedWidth?: number
  /** Fixed embedded height in pixels; see {@link ShellOptions.embedWidth}. */
  embedHeight?: number
  /**
   * Permissions-Policy features delegated to the feature frame, applied as the
   * iframe `allow` attribute scoped to the frame's own origin. Shell builds
   * bake the feature's declared needs here; a host-supplied list
   * replaces the baked one entirely. Only the iframe modes (`embedded`,
   * `dialog`) apply it — `popup` and `standalone` open top-level windows,
   * which request these permissions from the user directly.
   */
  permissions?: readonly FeaturePermission[]
  /**
   * Containment posture for the feature frame. `true` (or an opt-in object)
   * starts the frame from the browser's deny-all sandbox; the SDK always
   * returns `allow-scripts`, grants `allow-same-origin` only to cross-origin
   * feature URLs, and denies everything else unless opted in — see
   * {@link SandboxOptions} for the managed tokens and why. Host-decreed and
   * never baked by a shell build. Only meaningful for the iframe modes:
   * opening `popup` or `standalone` with a sandbox set throws, because no
   * containment can apply to a top-level window.
   */
  sandbox?: boolean | SandboxOptions
  /** How the host reacts when the feature stops responding; defaults to `emit`. */
  onUnresponsive?: UnresponsivePolicy
  /**
   * Whether Escape closes the dialog; defaults to `true`. Enforced on both
   * sides of the boundary: the host listens in its own document, and the
   * feature reports an Escape pressed inside its frame as a dismiss signal the
   * host acts on (dialog mode only).
   */
  closeOnEscape?: boolean
  /**
   * Width in pixels of the feature's inner dialog box (dialog mode only).
   * Crosses the boundary at open and is applied by the hostee SDK inside the
   * full-viewport dialog pane; when absent, the hostee derives a size from the
   * viewport and its aspect ratio.
   */
  dialogWidth?: number
  /** Height in pixels of the feature's inner dialog box; see {@link ShellOptions.dialogWidth}. */
  dialogHeight?: number
  /** Where the inner dialog box sits inside the pane (dialog mode only); defaults to `center`. */
  dialogPosition?: BoxPosition
  /**
   * How the host reacts to a pointer interaction on the dialog backdrop —
   * the transparent area around the feature's dialog box; defaults to
   * `close`. See {@link BackdropBehavior}.
   */
  dialogBackdrop?: BackdropBehavior
  /** Popup window width in pixels (popup mode only); when absent, derived from the viewport. */
  popupWidth?: number
  /** Popup window height in pixels (popup mode only); when absent, derived from the viewport. */
  popupHeight?: number
  /** Where the popup window sits on the screen (popup mode only); defaults to `center`. */
  popupPosition?: BoxPosition
  /** Security envelope to negotiate; defaults to `none`. */
  protocol?: SecurityProtocol
  /** Pre-shared key used by the `v2` protocol. */
  sharedKey?: string
  /** Experience plugins wrapped around each mount/unmount; `onMount` runs in registration order, `onUnmount` in reverse. */
  plugins?: readonly ExperiencePlugin[]
  /**
   * Milliseconds the shell waits for the feature to complete the connection
   * handshake before emitting an `error` with `reason: 'open-timeout'` and
   * tearing the mount down; defaults to 10000.
   *
   * Opening is asynchronous: `isOpen` stays `false` and the `open` event fires
   * only once the wire handshake completes. `send`/`request` calls issued in
   * between queue on the channel and flush on open.
   */
  openTimeoutMs?: number
}

/**
 * Options accepted by the hostee-side feature factory.
 */
export interface FeatureOptions {
  /** Stable identifier for the feature, used to name its messaging channel. */
  name: string
  /** Contract describing the actions the feature emits and accepts. */
  contract: FeatureContract
  /** Semver version of the contract cut this feature holds; takes precedence over `contract.version`. */
  version?: string
  /**
   * Whether to neutralize the feature page's `html`/`body`; defaults to `true`. Zeroes margin and padding, forces
   * `background: transparent`, and pins `color-scheme: normal` — on a standalone visit too, and injected late enough to outrank the
   * page's own `body` rules, so paint the feature's background on its root layout element instead.
   */
  resetBody?: boolean
  /**
   * The feature's root layout element (or a CSS selector for it); defaults to
   * the body's first element child. In dialog mode the hostee SDK centers this
   * element inside the full-viewport pane and applies the agreed inner dialog
   * box dimensions to it; the area around it is the backdrop.
   */
  root?: string | HTMLElement
  /** Security envelope to negotiate with the host; defaults to `none`. */
  protocol?: SecurityProtocol
  /** Pre-shared key used by the `v2` protocol. */
  sharedKey?: string
  /**
   * Milliseconds the feature waits for the host to complete the connection
   * handshake before `ready()` rejects and an `error` with
   * `reason: 'ready-timeout'` is emitted; defaults to 10000.
   */
  readyTimeoutMs?: number
}

/**
 * Type-checked authoring shape for a `feature.config.*` file.
 *
 * The tiered loader and CLI flag parity live in the CLI; the SDK only exports
 * the type and the {@link defineConfig} identity helper. Beyond the three
 * identity keys, the build also reads the optional `url`, `protocol`,
 * `display`, and `permissions` keys declared here.
 */
export interface FeatureConfig {
  /** Published feature name. */
  name: string
  /** Feature version string. */
  version: string
  /** Path to the `*.contract.{json,ts,js}` file. */
  contract: string
  /** URL of the feature app the generated shell loads by default; defaults to `/`. */
  url?: string
  /** Security envelope baked into the generated shell; `hf build` requires an explicit choice. */
  protocol?: SecurityProtocol
  /** Display modes and per-mode defaults baked into the generated shell. */
  display?: DisplayConfig
  /** Permissions-Policy features the shell delegates to the feature frame. */
  permissions?: FeaturePermission[]
}

/**
 * Fixed embedded footprint a feature declares in its config: the iframe
 * receives exactly these dimensions and the host application places the
 * feature somewhere it fits.
 */
export interface FixedEmbedSize {
  /** Exact iframe width in pixels. */
  width: number
  /** Exact iframe height in pixels. */
  height: number
}

/**
 * Inner dialog box configuration a feature declares for dialog mode.
 */
export interface DialogBoxConfig {
  /** Inner dialog box width in pixels; when absent, derived from the viewport. */
  width?: number
  /** Inner dialog box height in pixels; when absent, derived from the viewport. */
  height?: number
  /** Where the inner box sits inside the pane; defaults to `center`. */
  position?: BoxPosition
  /** How the host reacts to a backdrop interaction; defaults to `close`. */
  backdrop?: BackdropBehavior
}

/**
 * Popup window footprint a feature declares for popup mode.
 */
export interface PopupWindowConfig {
  /** Popup window width in pixels; when absent, derived from the viewport. */
  width?: number
  /** Popup window height in pixels; when absent, derived from the viewport. */
  height?: number
  /** Where the window sits on the screen; defaults to `center`. */
  position?: BoxPosition
}

/**
 * Presentation agreement a feature declares in its `feature.config.*` `display`
 * key: the display modes it supports and the per-mode defaults.
 *
 * Builds bake this into the generated shell — the shell composes exactly the
 * declared modes (undeclared modes ship no code and are excluded from the
 * generated types) and merges the per-mode defaults under host-supplied
 * options, so the host still controls presentation within the declared set.
 */
export interface DisplayConfig {
  /**
   * Display modes the feature supports; defaults to all four. The first
   * declared mode is the feature's default presentation — the one an `open()`
   * call without an explicit `displayMode` uses.
   */
  modes?: DisplayMode[]
  /** Fixed embedded dimensions; when absent, the embedded iframe fills its container. */
  embedded?: FixedEmbedSize
  /** Inner dialog box defaults for dialog mode. */
  dialog?: DialogBoxConfig
  /** Popup window defaults for popup mode. */
  popup?: PopupWindowConfig
  /** Whether Escape closes the dialog; defaults to `true`. */
  closeOnEscape?: boolean
}

/**
 * A fully-resolved feature configuration: the parsed config plus the values the
 * shell and feature-integration generators bake into their output.
 *
 * The CLI resolves this from the config file and flags; the generators receive
 * it ready to use and never read it from disk.
 */
export interface ResolvedFeatureConfig extends FeatureConfig {
  /** URL of the feature app the generated shell loads. */
  url: string
  /** Declared display modes and per-mode defaults baked into the generated shell. */
  display?: DisplayConfig
  /** Permissions-Policy features the feature declared it needs; baked into the generated shell as its default `permissions`. */
  permissions?: FeaturePermission[]
  /** Security envelope the build resolved; baked into the generated shell as its default. */
  protocol?: SecurityProtocol
}

/**
 * Shape of the `metadata.json` sidecar staged beside every built shell.
 *
 * Describes the feature so humans and registries can inspect it without
 * unpacking the bundle: identity, canonical version, feature URL, the full
 * contract, the baked security protocol, the declared browser permissions,
 * and the toolchain that produced it.
 */
export interface FeatureDescriptor {
  /** Published feature name. */
  name: string
  /** Canonical semver version of the feature the shell was built from. */
  version: string
  /** URL of the feature app the shell loads. */
  url: string
  /** The feature's contract exactly as the feature authored it. */
  contract: FeatureContract
  /** Display modes the generated shell composes; reviewable without unpacking the bundle. */
  modes: DisplayMode[]
  /** Security envelope baked into the shell, when one was resolved. */
  protocol?: SecurityProtocol
  /** Permissions-Policy features the feature declared it needs, when any; reviewable without unpacking the bundle. */
  permissions?: FeaturePermission[]
  /** Package name of the toolchain that generated the shell. */
  generatedBy: string
  /** Version of the `@hyperfrontend/features` SDK that generated the shell. */
  sdk: string
}

/**
 * A single feature app entry served by the dev server.
 */
export interface DevAppConfig {
  /** App name, matched against the feature name. */
  name: string
  /** Directory the built app is served from. */
  outputDir: string
  /** Port to serve the app on. */
  port?: number
}

/**
 * Debug-UI toggles for the dev server.
 */
export interface DevDebugConfig {
  /** Whether the debug UI is enabled. */
  enabled?: boolean
  /** Whether the message log panel is shown. */
  messageLog?: boolean
  /** Whether the security inspector panel is shown. */
  securityView?: boolean
  /** Port the debug UI's control server listens on; defaults to 4280, and the `--port` flag overrides it. */
  port?: number
}

/**
 * Type-checked authoring shape for an `hf-dev.config.*` file.
 */
export interface DevConfig {
  /** Feature apps the dev server serves. */
  apps: DevAppConfig[]
  /** Debug-UI toggles. */
  debug?: DevDebugConfig
}

/**
 * Identity helper that gives `feature.config.*` files type-checked authoring —
 * a pure inference-only function that returns its argument unchanged.
 *
 * @param config - The feature configuration object.
 * @returns The same configuration object, narrowed to {@link FeatureConfig}.
 *
 * @example Authoring a typed `feature.config.ts`
 * ```typescript
 * export default defineConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })
 * ```
 */
export const defineConfig = (config: FeatureConfig): FeatureConfig => config

/**
 * Identity helper that gives `hf-dev.config.*` files type-checked authoring.
 *
 * @param config - The dev-server configuration object.
 * @returns The same configuration object, narrowed to {@link DevConfig}.
 *
 * @example Authoring a typed `hf-dev.config.ts`
 * ```typescript
 * export default defineDevConfig({ apps: [{ name: 'clock', outputDir: 'dist/clock', port: 4200 }] })
 * ```
 */
export const defineDevConfig = (config: DevConfig): DevConfig => config
