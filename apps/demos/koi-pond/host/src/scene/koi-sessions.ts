/**
 * Eight shells, one per koi.
 *
 * Every koi ships as an independent feature with its own vendored shell
 * package; the host opens one session per shell into a container it owns.
 * There is no broadcast in the SDK and none is wanted: each koi is a separate
 * application on its own channel, and the host fans out by looping. Every frame
 * one of these is a different conversation — different neighbours, a different
 * depth, a different answer about whether the pointer is on it.
 *
 * Each session mounts embedded into a layer the *host* created. That is the
 * whole reason embedded is right here and dialog is not: dialog pins every
 * instance to the same maximum z-index and appends above the host's water
 * layer, and the z-order is the depth model.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import { createFeatureShell as createAngularKoiShell } from '@hyperfrontend/demo-koi-fish-angular-shell'
import { createFeatureShell as createLitKoiShell } from '@hyperfrontend/demo-koi-fish-lit-shell'
import { createFeatureShell as createPreactKoiShell } from '@hyperfrontend/demo-koi-fish-preact-shell'
import { createFeatureShell as createReactKoiShell } from '@hyperfrontend/demo-koi-fish-react-shell'
import { createFeatureShell as createSolidKoiShell } from '@hyperfrontend/demo-koi-fish-solid-shell'
import { createFeatureShell as createSvelteKoiShell } from '@hyperfrontend/demo-koi-fish-svelte-shell'
import { createFeatureShell as createVanillaKoiShell } from '@hyperfrontend/demo-koi-fish-vanilla-shell'
import { createFeatureShell as createVueKoiShell } from '@hyperfrontend/demo-koi-fish-vue-shell'
import { KOI_FRAMEWORKS, koiSeed } from '@hyperfrontend/demo-koi-lib'

/** How long the host waits for a koi's handshake before giving up on it. */
const OPEN_TIMEOUT_MS = 20_000

/**
 * Whether the pond is deployed composed: one origin serving the host at `/`
 * and every koi at `/fish-<name>/`. While composed, each shell's baked
 * cross-origin URL is overridden with the sub-path the pond itself serves.
 * Flip to `false` once the koi apps are provisioned on their own origins and
 * the shells' baked URLs take over.
 */
const COMPOSED_DEPLOYMENT: boolean = true

/**
 * The shell surface the pond drives, identical across the eight generated
 * shell packages.
 */
export interface KoiShell {
  /** Mounts the koi and starts the wire handshake. */
  open(): void
  /** Closes the koi gracefully through the polite close exchange. */
  close(): void
  /** Closes the koi and releases all resources. */
  destroy(): void
  /** Sends a contract action to the koi. */
  send(type: string, data?: unknown): void
  /** Subscribes to a koi or lifecycle event; returns the unsubscribe. */
  on(event: string, handler: (data?: unknown) => void): () => void
  /** Whether the koi's channel is currently open. */
  readonly isOpen: boolean
}

/** Options the pond passes when opening one koi's shell session. */
interface KoiShellMountOptions {
  /** The host-owned layer the koi's frame mounts into. */
  container: HTMLElement
  /** Milliseconds to wait for the koi's handshake before giving up. */
  openTimeoutMs: number
  /** Composed-deployment override of the shell's baked app URL. */
  url?: string
}

/** Creates one koi's shell session from its generated shell package. */
type KoiShellFactory = (options: KoiShellMountOptions) => KoiShell

/** One factory per koi, each from its own vendored shell package. */
const SHELL_FACTORIES: Record<KoiFramework, KoiShellFactory> = {
  vanilla: (options) => createVanillaKoiShell(options),
  react: (options) => createReactKoiShell(options),
  vue: (options) => createVueKoiShell(options),
  svelte: (options) => createSvelteKoiShell(options),
  solid: (options) => createSolidKoiShell(options),
  preact: (options) => createPreactKoiShell(options),
  lit: (options) => createLitKoiShell(options),
  angular: (options) => createAngularKoiShell(options),
}

/** One live koi: its host-owned layer and the shell driving its channel. */
export interface KoiSession {
  /** The framework slug rendering it, also its deployed sub-path. */
  framework: KoiFramework
  /** The host-owned container its frame mounts into. */
  layer: HTMLElement
  /** The shell driving its channel. */
  shell: KoiShell
}

/**
 * The URL of one koi's app: the identity a visitor reads, and — while the
 * pond is deployed composed — the URL its frame mounts from.
 *
 * While composed it resolves against wherever the pond itself is being served
 * from — no environment variable, no origin list. The directory form is the
 * only one a koi may be framed from: its assets are referenced relatively so
 * that one build serves both the composed sub-path and its own origin's root,
 * and a static host that rewrites `…/index.html` to an extensionless path
 * would leave the document one directory up, where every relative asset
 * misses.
 *
 * @param framework - Which koi.
 * @returns Its absolute app URL, without any index file spelled out.
 */
export function fishHomeUrl(framework: KoiFramework): string {
  if (COMPOSED_DEPLOYMENT) {
    return new URL(`fish-${framework}/`, window.location.href).toString()
  }
  // why: The koi services share one naming scheme, so the standalone app URL derives from the framework instead of a hand-kept origin list.
  return `https://demo-koi-fish-${framework}-production.up.railway.app/`
}

/**
 * Opens one embedded session per koi.
 *
 * @param layers - The host-owned containers, keyed by framework slug.
 * @returns One session per koi, in the pond's canonical order.
 *
 * @example Raising the shoal
 * ```typescript
 * const sessions = openShoal(stage.layers)
 * sessions.forEach((session) => session.shell.open())
 * ```
 */
export function openShoal(layers: ReadonlyMap<KoiFramework, HTMLElement>): KoiSession[] {
  const sessions: KoiSession[] = []
  for (const framework of KOI_FRAMEWORKS) {
    const layer = layers.get(framework)
    if (layer === undefined) {
      continue
    }
    const shell = SHELL_FACTORIES[framework]({
      container: layer,
      // why: Eight handshakes queue behind one another on a cold load, and the ten-second default times the last of them out.
      openTimeoutMs: OPEN_TIMEOUT_MS,
      ...(COMPOSED_DEPLOYMENT && { url: fishHomeUrl(framework) }),
    })
    sessions.push({ framework, layer, shell })
  }
  return sessions
}

/**
 * The identity payload a koi is sent as soon as its channel opens.
 *
 * @param framework - Which koi.
 * @param depth - The level the host is starting it at.
 * @returns The identity to send.
 */
export function identityFor(framework: KoiFramework, depth: number): { framework: KoiFramework; seed: number; url: string; depth: number } {
  return { framework, seed: koiSeed(framework), url: fishHomeUrl(framework), depth }
}
