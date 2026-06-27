import type { SecurityProtocol } from '../../shared/types'
import { createElement, div, input, label, span } from '@hyperfrontend/ui-utils/element'
import { DisplayMode } from '../../shared/types'
import { controlStyle, labelStyle, palette, panelStyle, statusDotStyle, toolbarStyle } from './styles'

// note: Mirrors the four built-in display modes and the none/v1/v2 security envelopes the host/hostee negotiate.
const DISPLAY_MODES: readonly DisplayMode[] = [DisplayMode.Embedded, DisplayMode.Dialog, DisplayMode.Popup, DisplayMode.Standalone]
const PROTOCOLS: readonly SecurityProtocol[] = ['none', 'v1', 'v2']

/** The iframe footprint reported by the resize controls. */
export interface ResizeSize {
  /** Iframe width in pixels. */
  readonly width: number
  /** Iframe height in pixels. */
  readonly height: number
}

/** Current control values plus the callbacks fired when the user changes them. */
export interface ControlsOptions {
  /** The initially-selected display mode. */
  readonly displayMode: DisplayMode
  /** The initial iframe width in pixels. */
  readonly width: number
  /** The initial iframe height in pixels. */
  readonly height: number
  /** The initially-selected security protocol. */
  readonly protocol: SecurityProtocol
  /** Fired when the display mode changes. */
  onDisplayModeChange(mode: DisplayMode): void
  /** Fired when either resize input changes, with the latest width and height. */
  onResize(size: ResizeSize): void
  /** Fired when the security protocol changes. */
  onProtocolChange(protocol: SecurityProtocol): void
}

/** The controls panel plus the imperative API for driving it. */
export interface ControlsHandle {
  /** The panel root element. */
  readonly element: HTMLElement
  /** Updates the connection-status indicator. */
  setConnected(connected: boolean): void
}

/**
 * Builds a `<select>` over a fixed set of string values, pre-selecting the current one.
 *
 * @param values - The selectable values.
 * @param current - The value selected on mount.
 * @param onChange - Fired with the newly-selected value.
 * @returns The configured select element.
 */
function buildSelect<T extends string>(values: readonly T[], current: T, onChange: (value: T) => void): HTMLSelectElement {
  const select = createElement<HTMLSelectElement>('select', { inlineStyle: controlStyle }).ref
  values.forEach((value) => {
    const option = createElement<HTMLOptionElement>('option').ref
    option.value = value
    option.textContent = value
    if (value === current) {
      option.selected = true
    }
    select.appendChild(option)
  })
  select.addEventListener('change', () => onChange(<T>select.value))
  return select
}

/**
 * Wraps a control in a captioned label.
 *
 * @param caption - The text shown before the control.
 * @param control - The control element.
 * @returns The label wrapper element.
 */
function labelled(caption: string, control: HTMLElement): HTMLElement {
  const wrapper = label({ inlineStyle: labelStyle })
  const text = span()
  text.ref.textContent = caption
  wrapper.addChild(text)
  wrapper.addChild(control)
  return wrapper.ref
}

/**
 * Creates the controls panel: connection status, display-mode switcher, width
 * and height resize inputs, and the security-protocol selector.
 *
 * @param options - Initial control values and change callbacks.
 * @returns The panel element plus a `setConnected` indicator updater.
 *
 * @example Wiring the display-mode switcher
 * ```typescript
 * const controls = createControls({ ...values, onDisplayModeChange: (mode) => remount(mode) })
 * ```
 */
export function createControls(options: ControlsOptions): ControlsHandle {
  let width = options.width
  let height = options.height

  const panel = div({ inlineStyle: { ...panelStyle, ...toolbarStyle } })

  const dot = div({ inlineStyle: statusDotStyle(false) })
  const statusText = span()
  statusText.ref.textContent = 'disconnected'
  const status = div({ inlineStyle: labelStyle })
  status.addChild(dot)
  status.addChild(statusText)
  panel.addChild(status)

  const modeSelect = buildSelect(DISPLAY_MODES, options.displayMode, options.onDisplayModeChange)
  panel.addChild(labelled('mode', modeSelect))

  const emitResize = () => options.onResize({ width, height })
  const widthInput = buildNumberInput(width, (value) => {
    width = value
    emitResize()
  })
  const heightInput = buildNumberInput(height, (value) => {
    height = value
    emitResize()
  })
  panel.addChild(labelled('w', widthInput))
  panel.addChild(labelled('h', heightInput))

  const protocolSelect = buildSelect(PROTOCOLS, options.protocol, options.onProtocolChange)
  panel.addChild(labelled('security', protocolSelect))

  return {
    element: panel.ref,
    setConnected: (connected) => {
      dot.ref.style.background = connected ? palette.online : palette.offline
      statusText.ref.textContent = connected ? 'connected' : 'disconnected'
    },
  }
}

/**
 * Builds a numeric resize input that reports its parsed value on every edit.
 *
 * @param value - The initial value.
 * @param onChange - Fired with the parsed numeric value.
 * @returns The configured input element.
 */
function buildNumberInput(value: number, onChange: (value: number) => void): HTMLInputElement {
  const field = input({ inlineStyle: { ...controlStyle, width: '70px' } }).ref
  field.type = 'number'
  field.value = `${value}`
  field.addEventListener('input', () => onChange(Number(field.value)))
  return field
}
