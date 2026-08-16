import type { SandboxOptions, ShellOptions } from '../shared/types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { createElement } from '@hyperfrontend/ui-utils/element'

// note: Borderless and transparent so the embedded feature blends into the host page.

/**
 * The capability options an iframe display mode applies to the frame it creates.
 */
export type FrameCapabilities = Pick<ShellOptions, 'permissions' | 'sandbox'>

/**
 * Resolves a container option to a concrete element.
 *
 * @param container - A CSS selector string or an element reference.
 * @returns The resolved host element.
 * @throws {Error} When no container was supplied or the selector matches nothing.
 *
 * @example Resolving a selector
 * ```typescript
 * const host = resolveContainer('#clock-container')
 * ```
 */
export function resolveContainer(container: string | HTMLElement | undefined): HTMLElement {
  if (container === undefined) {
    throw createError('The embedded display mode needs a "container" element or selector to mount into.')
  }
  if (typeof container !== 'string') {
    return container
  }
  const found = document.querySelector(container)
  if (found === null) {
    throw createError(`Shell container not found for selector "${container}".`)
  }
  return <HTMLElement>found
}

/**
 * Reports whether a feature URL resolves to an origin other than the host page's.
 *
 * An unparsable URL counts as same-origin: withholding `allow-same-origin` is
 * the safe direction (it only costs the frame its storage, never containment).
 *
 * @param url - The feature URL, absolute or relative to the document.
 * @returns True when the resolved origin differs from `window.location.origin`.
 */
function isCrossOrigin(url: string): boolean {
  try {
    return createURL(url, document.baseURI).origin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * Computes the sandbox token list for a feature frame.
 *
 * `allow-scripts` is unconditional: the feature runtime is JavaScript, so a
 * script-less frame could never connect. `allow-same-origin` is granted only
 * to cross-origin feature URLs, because a same-origin frame holding both
 * tokens could remove its own sandbox. Everything else maps from the explicit
 * opt-ins.
 *
 * @param url - The feature URL, used for the origin decision.
 * @param sandbox - The opt-in flags; `true` means no opt-ins.
 * @returns The space-joinable sandbox tokens.
 */
function buildSandboxTokens(url: string, sandbox: true | SandboxOptions): string[] {
  const optIns = sandbox === true ? <SandboxOptions>{} : sandbox
  const tokens = ['allow-scripts']
  if (isCrossOrigin(url)) {
    tokens.push('allow-same-origin')
  }
  if (optIns.forms === true) {
    tokens.push('allow-forms')
  }
  if (optIns.popups === true) {
    tokens.push('allow-popups')
  }
  if (optIns.modals === true) {
    tokens.push('allow-modals')
  }
  if (optIns.downloads === true) {
    tokens.push('allow-downloads')
  }
  if (optIns.topNavigationByUserActivation === true) {
    tokens.push('allow-top-navigation-by-user-activation')
  }
  return tokens
}

/**
 * Creates a borderless iframe pointing at the feature URL.
 *
 * When capabilities are supplied, `permissions` is applied as the frame's
 * `allow` attribute (delegating those Permissions-Policy features to the
 * frame's own origin) and `sandbox` as its sandbox tokens, both set before
 * the frame loads, which is the only moment they take effect.
 *
 * @param url - The feature app URL to load.
 * @param capabilities - Optional `permissions` and `sandbox` from the merged shell options.
 * @returns The configured iframe element (not yet attached to the DOM).
 *
 * @example Creating a feature iframe that may go fullscreen
 * ```typescript
 * const iframe = createFeatureIframe('https://clock.example.com', { permissions: ['fullscreen'] })
 * container.appendChild(iframe)
 * ```
 */
export function createFeatureIframe(url: string, capabilities?: FrameCapabilities): HTMLIFrameElement {
  // why: Browsers force an opaque canvas onto a frame whose used color-scheme differs from its embedder's; pinning the element to `normal` (paired with the same pin in the hostee's body reset) keeps the two sides matched so transparency survives end to end.
  // why: Hidden until the shell reveals it on session open — mounted is not displayed, so a connecting frame never paints or intercepts input.
  const iframe = createElement<HTMLIFrameElement>('iframe', {
    inlineStyle: { border: 'none', display: 'block', width: '100%', height: '100%', colorScheme: 'normal', visibility: 'hidden' },
  }).ref
  const permissions = capabilities?.permissions
  if (permissions !== undefined && permissions.length > 0) {
    iframe.setAttribute('allow', permissions.join('; '))
  }
  const sandbox = capabilities?.sandbox
  if (sandbox !== undefined && sandbox !== false) {
    iframe.setAttribute('sandbox', buildSandboxTokens(url, sandbox).join(' '))
  }
  iframe.src = url
  iframe.setAttribute('allowtransparency', 'true')
  return iframe
}

// why: A frame that never fires load (some browsers skip it for blocked or error documents) must still reach the handshake, whose own timeout then governs the failure.
const FRAME_LOAD_GRACE_MS = 10000

/** Mutable state of one handshake hold: the grace timer armed alongside the frame's load listener. */
interface FrameLoadHold {
  /** The armed grace timer, cleared once the frame loads or the hold is cancelled. */
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Builds the handshake-readiness hook for a feature iframe, or `undefined`
 * when the handshake may begin immediately.
 *
 * A cross-origin frame cannot receive origin-pinned messages until it has
 * navigated: every handshake ping sent before then dies against the initial
 * `about:blank` document with a browser-logged target-origin error. The hook
 * holds the handshake until the frame's `load` event (with a grace fallback
 * for frames that never report one). A same-origin frame needs no gate: the
 * initial document already matches the pinned origin.
 *
 * @param iframe - The feature frame created for this mount.
 * @param url - The feature URL the frame is navigating to.
 * @returns A {@link MountResult.whenReady} implementation, or `undefined` for same-origin frames.
 *
 * @example Gating an embedded mount's handshake on frame readiness
 * ```typescript
 * const iframe = createFeatureIframe(url, options)
 * return { target: iframe.contentWindow, whenReady: frameReadiness(iframe, url), ... }
 * ```
 */
export function frameReadiness(iframe: HTMLIFrameElement, url: string): ((begin: () => void) => () => void) | undefined {
  if (!isCrossOrigin(url)) {
    return undefined
  }
  return (begin: () => void) => {
    const state: FrameLoadHold = {}
    const start = () => {
      clearTimeout(state.timer)
      iframe.removeEventListener('load', start)
      begin()
    }
    iframe.addEventListener('load', start)
    state.timer = setTimeout(start, FRAME_LOAD_GRACE_MS)
    return () => {
      clearTimeout(state.timer)
      iframe.removeEventListener('load', start)
    }
  }
}
