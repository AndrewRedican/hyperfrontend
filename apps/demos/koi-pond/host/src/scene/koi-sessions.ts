/**
 * Seven shells, one per koi.
 *
 * There is no broadcast in the SDK and none is wanted: each koi is a separate
 * application on its own channel, and the host fans out by looping. Every frame
 * one of these is a different conversation — different neighbours, a different
 * depth, a different answer about whether the pointer is on it.
 *
 * Each session mounts embedded into a container the *host* created. That is the
 * whole reason embedded is right here and dialog is not: dialog pins every
 * instance to the same maximum z-index and appends above the host's water
 * layer, and the z-order is the depth model.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import type { ShellHandle } from '@hyperfrontend/features/host'
import type { FeatureContract } from '@hyperfrontend/features/hostee'
import { KOI_FRAMEWORKS, koiSeed } from '@hyperfrontend/demo-koi-lib'
import { koiFishContract } from '@hyperfrontend/demo-koi-lib/contract'
import { createShell, mountEmbedded } from '@hyperfrontend/features/host'

/** How long the host waits for a koi's handshake before giving up on it. */
const OPEN_TIMEOUT_MS = 20_000

/** One live koi: its host-owned layer and the shell driving its channel. */
export interface KoiSession {
  /** The framework slug rendering it, also its deployed sub-path. */
  framework: KoiFramework
  /** The host-owned container its frame mounts into. */
  layer: HTMLElement
  /** The shell driving its channel. */
  shell: ShellHandle
}

/**
 * The URL the pond actually loads one koi's frame from.
 *
 * The pond deploys as a single origin with the host at `/` and each koi at
 * `/fish-<name>/`, so the URL is always resolved against wherever the pond
 * itself is being served from — no environment variable, no origin list.
 *
 * `index.html` is spelled out because the SDK's dev server does not resolve a
 * directory to its index (F-009); every static host serves both forms, so this
 * costs the deployed pond nothing. Use {@link fishHomeUrl} for anything a
 * visitor reads.
 *
 * @param framework - Which koi.
 * @returns The absolute URL of its frame.
 */
export function fishUrl(framework: KoiFramework): string {
  return new URL(`fish-${framework}/index.html`, window.location.href).toString()
}

/**
 * The URL of one koi's app as a visitor should see it.
 *
 * @param framework - Which koi.
 * @returns Its absolute app URL, without the index file spelled out.
 */
export function fishHomeUrl(framework: KoiFramework): string {
  return new URL(`fish-${framework}/`, window.location.href).toString()
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
    const shell = createShell({
      // why: Only embedded is ever mounted, so the other three display modes tree-shake out of the host bundle.
      modes: { embedded: mountEmbedded },
      // why: The feature-authored contract goes across verbatim; createShell inverts it so the host sends what the koi accepts.
      contract: <FeatureContract>koiFishContract,
      name: `@hyperfrontend/demo-koi-fish-${framework}`,
      url: fishUrl(framework),
      container: layer,
      // why: No security protocol on purpose - these channels are same-origin inside one deploy, so the envelope deters nothing, and its per-message key derivation collapses delivery when seven channels share one page. The gallery-facing channel keeps its envelope; that one crosses sites.
      // why: Seven handshakes queue behind one another on a cold load, and the ten-second default times the last of them out.
      openTimeoutMs: OPEN_TIMEOUT_MS,
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
