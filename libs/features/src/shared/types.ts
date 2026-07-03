import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Supported ways a host can surface an embedded feature.
 *
 * All four modes are built into the SDK.
 */
export const DisplayMode = freeze(<const>{
  /** Inline inside a host-provided container element. */
  Embedded: 'embedded',
  /** Centered modal with an overlay and close button. */
  Dialog: 'dialog',
  /** Separate browser popup window sized like a dialog. */
  Popup: 'popup',
  /** Full browser tab/window opened via `_blank`. */
  Standalone: 'standalone',
})

/**
 * Union of the supported display-mode values.
 */
export type DisplayMode = (typeof DisplayMode)[keyof typeof DisplayMode]

/**
 * Union of the supported security envelope selectors.
 *
 * `none` is the local default (opt-in security); production builds must pick
 * `v1` or `v2`.
 */
export type SecurityProtocol = 'none' | 'v1' | 'v2'

/**
 * How the feature is laid out when the host surfaces it.
 */
export type EmbedSizing = 'fill' | 'content'

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
 * What the host does when a feature misses too many heartbeats.
 *
 * `emit` (the default) emits an `error`; `unmount` also tears the feature down;
 * a callback takes over handling entirely with the {@link UnresponsiveInfo}.
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
  /** Target element (or CSS selector) the embedded feature mounts into. */
  container: string | HTMLElement
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
  /** How an embedded feature is sized; defaults to `fill` (the iframe fills its container). */
  embedSizing?: EmbedSizing
  /** How the host reacts when the feature stops responding; defaults to `emit`. */
  onUnresponsive?: UnresponsivePolicy
  /** Whether pressing Escape closes the shell; defaults to `true`. */
  closeOnEscape?: boolean
  /** Dialog width in pixels (dialog mode only). */
  dialogWidth?: number
  /** Dialog height in pixels (dialog mode only). */
  dialogHeight?: number
  /** Whether the dialog renders a dimmed backdrop; defaults to `true`. */
  dialogOverlay?: boolean
  /** Security envelope to negotiate; defaults to `none`. */
  protocol?: SecurityProtocol
  /** Pre-shared key used by the `v2` protocol. */
  sharedKey?: string
  /** Experience plugins wrapped around each mount/unmount; `onMount` runs in registration order, `onUnmount` in reverse. */
  plugins?: readonly ExperiencePlugin[]
}

/**
 * Options accepted by the hostee-side feature factory.
 */
export interface FeatureOptions {
  /** Stable identifier for the feature, used to name its messaging channel. */
  name: string
  /** Contract describing the actions the feature emits and accepts. */
  contract: FeatureContract
  /** Whether to neutralize the feature page's body margins/padding; defaults to `true`. */
  resetBody?: boolean
}

/**
 * Type-checked authoring shape for a `feature.config.*` file.
 *
 * The tiered loader and CLI flag parity live in the CLI; the SDK only exports
 * the type and the {@link defineConfig} identity helper.
 */
export interface FeatureConfig {
  /** Published feature name. */
  name: string
  /** Feature version string. */
  version: string
  /** Path to the `*.contract.{json,ts,js}` file. */
  contract: string
}

/**
 * Display defaults baked into a generated connector as the feature's default
 * {@link ShellOptions}. The host still overrides these at runtime.
 */
export interface DisplayDefaults {
  /** Dialog width in pixels (dialog mode only). */
  dialogWidth?: number
  /** Dialog height in pixels (dialog mode only). */
  dialogHeight?: number
  /** Whether the dialog renders a dimmed backdrop; defaults to `true`. */
  dialogOverlay?: boolean
  /** Whether pressing Escape closes the shell; defaults to `true`. */
  closeOnEscape?: boolean
  /** How an embedded feature is sized; defaults to `fill`. */
  embedSizing?: EmbedSizing
}

/**
 * A fully-resolved feature configuration: the parsed config plus the values the
 * shell and feature-integration generators bake into their output.
 *
 * The CLI resolves this from the config file and flags; the generators receive
 * it ready to use and never read it from disk.
 */
export interface ResolvedFeatureConfig extends FeatureConfig {
  /** URL of the feature app the generated connector loads. */
  url: string
  /** Default display options baked into the connector as the feature's defaults. */
  display?: DisplayDefaults
  /** Security envelope the build resolved; baked into the generated connector as its default. */
  protocol?: SecurityProtocol
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
 * Identity helper that gives `feature.config.*` files type-checked authoring.
 *
 * This is a pure inference-only function — it returns its argument unchanged.
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
