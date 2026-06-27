import type { Style } from '@hyperfrontend/ui-utils/style'

// note: Inline styles only — the debug UI ships no CSS files, so every visual is expressed here as a Style object (shared invariant for this surface).

/** Dark-theme colour tokens shared across the debug-UI panels. */
export const palette = {
  /** Page background. */
  background: '#1e1e1e',
  /** Panel background. */
  panel: '#252526',
  /** Primary text. */
  text: '#d4d4d4',
  /** Muted/secondary text. */
  muted: '#858585',
  /** Panel and control borders. */
  border: '#3c3c3c',
  /** Interactive accent. */
  accent: '#0e639c',
  /** Incoming-message highlight. */
  incoming: '#4ec9b0',
  /** Outgoing-message highlight. */
  outgoing: '#dcdcaa',
  /** Connected indicator. */
  online: '#4caf50',
  /** Disconnected indicator. */
  offline: '#f44336',
}

/** Root layout for the whole debug UI. */
export const rootStyle: Style = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  height: '100vh',
  boxSizing: 'border-box',
  padding: '12px',
  background: palette.background,
  color: palette.text,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '13px',
}

/** A bordered panel container. */
export const panelStyle: Style = {
  border: `1px solid ${palette.border}`,
  borderRadius: '4px',
  background: palette.panel,
  padding: '10px',
}

/** Horizontal toolbar row that wraps its controls. */
export const toolbarStyle: Style = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '10px',
}

/** Shared style for buttons, selects, and inputs. */
export const controlStyle: Style = {
  background: palette.background,
  color: palette.text,
  border: `1px solid ${palette.border}`,
  borderRadius: '3px',
  padding: '4px 6px',
  font: 'inherit',
}

/** Label that precedes a control. */
export const labelStyle: Style = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  color: palette.muted,
}

/** Scrollable message-log body. */
export const logStyle: Style = {
  flex: '1',
  overflowY: 'auto',
  margin: '0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

/**
 * Builds the connection-status dot style for the current connection state.
 *
 * @param connected - Whether the feature is currently connected.
 * @returns The dot style, coloured online or offline.
 *
 * @example Styling a connected indicator
 * ```typescript
 * const dot = div({ inlineStyle: statusDotStyle(true) })
 * ```
 */
export function statusDotStyle(connected: boolean): Style {
  return {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: connected ? palette.online : palette.offline,
  }
}

/**
 * Builds the left-border style for a logged message based on its direction.
 *
 * @param direction - Whether the message was incoming or outgoing.
 * @returns The entry style, accented for the direction.
 *
 * @example Styling an incoming entry
 * ```typescript
 * const entry = div({ inlineStyle: messageEntryStyle('incoming') })
 * ```
 */
export function messageEntryStyle(direction: 'incoming' | 'outgoing'): Style {
  return {
    borderLeft: `3px solid ${direction === 'incoming' ? palette.incoming : palette.outgoing}`,
    padding: '2px 8px',
    margin: '4px 0',
  }
}
