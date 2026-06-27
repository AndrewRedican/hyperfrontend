import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { button, div } from '@hyperfrontend/ui-utils/element'
import { controlStyle, labelStyle, logStyle, messageEntryStyle, palette, panelStyle, toolbarStyle } from './styles'

// note: The three views surface the security envelope from the core SDK: `raw` is the on-wire payload, `decrypted` the v1/v2 plaintext, `pretty` an indented decrypted (or raw) payload.
const VIEWS: readonly LogView[] = ['raw', 'decrypted', 'pretty']

/** Which projection of a logged message is shown. */
export type LogView = 'raw' | 'decrypted' | 'pretty'

/** A single logged message between host and hostee. */
export interface LogMessage {
  /** Whether the message was received (`incoming`) or sent (`outgoing`). */
  readonly direction: 'incoming' | 'outgoing'
  /** The on-wire payload as delivered. */
  readonly raw: unknown
  /** The decrypted payload, when a security envelope was in use. */
  readonly decrypted?: unknown
  /** The channel the message travelled on, when known. */
  readonly channel?: string
}

/** The message-log panel and the imperative API for driving it. */
export interface MessageLogHandle {
  /** The panel root element. */
  readonly element: HTMLElement
  /** Appends a message to the log. */
  append(message: LogMessage): void
  /** Switches the active projection and re-renders. */
  setView(view: LogView): void
  /** Removes every logged message. */
  clear(): void
}

/**
 * Projects a logged message to text for the active view, noting when a decrypted
 * payload is unavailable so the encryption boundary stays visible.
 *
 * @param message - The logged message.
 * @param view - The active projection.
 * @returns The formatted payload text.
 */
function formatPayload(message: LogMessage, view: LogView): string {
  if (view === 'raw') {
    return stringify(message.raw)
  }
  if (view === 'decrypted') {
    return message.decrypted === undefined ? '(encrypted — no decrypted payload)' : stringify(message.decrypted)
  }
  return stringify(message.decrypted ?? message.raw, null, 2)
}

/**
 * Builds an entry element for one logged message under the active view.
 *
 * @param message - The logged message.
 * @param view - The active projection.
 * @returns The entry element.
 */
function renderEntry(message: LogMessage, view: LogView): HTMLElement {
  const entry = div({ inlineStyle: messageEntryStyle(message.direction) })
  const heading = div({ inlineStyle: { color: palette.muted, marginBottom: '2px' } })
  heading.ref.textContent = `${message.direction === 'incoming' ? '◀ in' : '▶ out'}${message.channel ? ` · ${message.channel}` : ''}`
  const body = div()
  body.ref.textContent = formatPayload(message, view)
  entry.addChild(heading)
  entry.addChild(body)
  return entry.ref
}

/**
 * Creates the message-log panel: a view switcher (raw/decrypted/pretty) over a
 * scrollable list of incoming and outgoing messages.
 *
 * @returns The panel element plus `append`, `setView`, and `clear` controls.
 *
 * @example Logging an incoming message
 * ```typescript
 * const log = createMessageLog()
 * log.append({ direction: 'incoming', raw: { type: 'tick' } })
 * ```
 */
export function createMessageLog(): MessageLogHandle {
  const messages: LogMessage[] = []
  let view: LogView = 'pretty'

  const element = div({ inlineStyle: { ...panelStyle, display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' } })
  const toolbar = div({ inlineStyle: toolbarStyle })
  const title = div({ inlineStyle: labelStyle })
  title.ref.textContent = 'Messages'
  toolbar.addChild(title)

  const body = div({ inlineStyle: logStyle })

  const render = () => {
    body.ref.textContent = ''
    messages.forEach((message) => body.addChild(renderEntry(message, view)))
  }

  VIEWS.forEach((candidate) => {
    const toggle = button({ inlineStyle: controlStyle })
    toggle.ref.type = 'button'
    toggle.ref.textContent = candidate
    toggle.ref.addEventListener('click', () => {
      view = candidate
      render()
    })
    toolbar.addChild(toggle)
  })

  element.addChild(toolbar)
  element.addChild(body)

  return {
    element: element.ref,
    append: (message) => {
      messages.push(message)
      body.addChild(renderEntry(message, view))
    },
    setView: (next) => {
      view = next
      render()
    },
    clear: () => {
      messages.length = 0
      render()
    },
  }
}
