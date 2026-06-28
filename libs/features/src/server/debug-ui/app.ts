import type { SecurityProtocol } from '../../shared/types'
import type { DevManifest } from '../dev-server'
import type { MessageLogHandle } from './message-log'
import { assign } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { createElement, div, span } from '@hyperfrontend/ui-utils/element'
import { DisplayMode } from '../../shared/types'
import { createControls } from './controls'
import { createMessageLog } from './message-log'
import { labelStyle, panelStyle, rootStyle } from './styles'

// note: Starting iframe footprint; the resize controls drive it live from here.
const DEFAULT_WIDTH = 480
const DEFAULT_HEIGHT = 360

/**
 * Extracts the origin of a served app's url, used as a trusted message sender.
 *
 * @param url - The app url from the manifest.
 * @returns The url's origin, or null when the url cannot be parsed.
 */
function originOf(url: string): string | null {
  try {
    return createURL(url).origin
  } catch {
    return null
  }
}

/** Injectable boundaries for {@link mountDebugUi}, defaulted to the page globals. */
export interface MountDebugUiDeps {
  /** The window the message listener attaches to; defaults to the global `window`. */
  readonly window?: Window
}

/** The mounted debug UI plus its teardown. */
export interface DebugUiHandle {
  /** The mount root the UI was rendered into. */
  readonly element: HTMLElement
  /** Detaches listeners and clears the rendered UI. */
  cleanup(): void
}

/**
 * Mounts the debug UI into a root element: a controls panel, an app iframe whose
 * size and display mode the controls drive, an optional message log fed by the
 * window's `message` events, and an optional security-protocol readout.
 *
 * @param root - The element the UI renders into.
 * @param manifest - The running-apps manifest the dev server serves.
 * @param deps - Optional window override for the message listener.
 * @returns A handle exposing the root element and a `cleanup` teardown.
 *
 * @example Mounting against the served manifest
 * ```typescript
 * const handle = mountDebugUi(document.getElementById('hf-debug-root'), manifest)
 * ```
 */
export function mountDebugUi(root: HTMLElement, manifest: DevManifest, deps: MountDebugUiDeps = {}): DebugUiHandle {
  const view = deps.window ?? window
  assign(root.style, rootStyle)

  const iframe = createElement<HTMLIFrameElement>('iframe', {
    inlineStyle: { border: 'none', width: `${DEFAULT_WIDTH}px`, height: `${DEFAULT_HEIGHT}px`, background: '#fff' },
  }).ref
  const firstApp = manifest.apps[0]
  if (firstApp !== undefined) {
    iframe.src = firstApp.url
  }

  let securityReadout: HTMLElement | undefined
  if (manifest.debug.securityView) {
    const security = div({ inlineStyle: labelStyle })
    const readout = span()
    readout.ref.textContent = 'protocol: none'
    security.addChild(readout)
    securityReadout = readout.ref
    root.appendChild(security.ref)
  }

  const controls = createControls({
    displayMode: DisplayMode.Embedded,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    protocol: 'none',
    onDisplayModeChange: (mode: DisplayMode) => iframe.setAttribute('data-display-mode', mode),
    onResize: ({ width, height }) => {
      iframe.style.width = `${width}px`
      iframe.style.height = `${height}px`
    },
    onProtocolChange: (protocol: SecurityProtocol) => {
      if (securityReadout !== undefined) {
        securityReadout.textContent = `protocol: ${protocol}`
      }
    },
  })
  root.appendChild(controls.element)

  const stage = div({ inlineStyle: { ...panelStyle, flex: '1', display: 'flex', minHeight: '0', overflow: 'auto' } })
  stage.ref.appendChild(iframe)
  root.appendChild(stage.ref)

  let log: MessageLogHandle | undefined
  if (manifest.debug.messageLog) {
    log = createMessageLog()
    root.appendChild(log.element)
  }

  const allowedOrigins = manifest.apps.map((app) => originOf(app.url)).filter((origin): origin is string => origin !== null)

  const onMessage = (event: MessageEvent) => {
    // why: Verify the message comes from a served app's origin; an untrusted window may post here too.
    if (!allowedOrigins.includes(event.origin)) {
      return
    }
    controls.setConnected(true)
    log?.append({ direction: 'incoming', raw: event.data })
  }
  view.addEventListener('message', onMessage)

  return {
    element: root,
    cleanup: () => {
      view.removeEventListener('message', onMessage)
      root.textContent = ''
    },
  }
}
