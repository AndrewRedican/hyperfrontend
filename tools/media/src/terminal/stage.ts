import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { TerminalConfig, TerminalTheme, TerminalTone } from '../models/terminal'
import type { TerminalRow, TerminalState } from './timeline'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { STAGE_ELEMENT_ID } from '../stage/document'
import { terminalMetrics } from './metrics'
import { resolveTerminalTheme } from './themes'
import { compileTimeline, stateAt } from './timeline'

/** Every tone a theme colours, in the order the stylesheet declares them. */
const TONES: readonly TerminalTone[] = ['plain', 'muted', 'accent', 'success', 'warning', 'danger']

/**
 * The face the terminal is set in.
 *
 * Named explicitly rather than left to `monospace` because the generic family
 * resolves to whatever the recording machine happens to prefer, which on a
 * minimal Linux image is routinely a CJK face with the wrong advance width for
 * everything else in the frame.
 */
const FONT_STACK = "'Liberation Mono', 'DejaVu Sans Mono', 'JetBrains Mono', Menlo, Consolas, monospace"

/**
 * Draw one row of the scrollback.
 *
 * @param row - The row to draw.
 * @returns Markup for the row.
 */
function renderRow(row: TerminalRow): string {
  const text = `<span class="t-tone t-tone--${row.tone}">${escapeHtml(row.text)}</span>`
  const prompt = row.prompt === undefined ? '' : `<span class="t-prompt">${escapeHtml(row.prompt)}</span> `
  return `<div class="t-row">${prompt}${text}</div>`
}

/**
 * Draw the live input line, cursor included.
 *
 * @param state - What the terminal shows at this moment.
 * @returns Markup for the line, or nothing while a command is still running.
 */
function renderInput(state: TerminalState): string {
  if (!state.showPrompt) {
    return ''
  }
  const cursor = `<span class="t-cursor${state.cursorOn ? ' t-cursor--on' : ''}"></span>`
  return `<div class="t-row"><span class="t-prompt">${escapeHtml(state.prompt)}</span> ${escapeHtml(state.typed)}${cursor}</div>`
}

/**
 * Draw the window's title bar.
 *
 * @param title - Text in the bar, or an empty string for a window without one.
 * @returns Markup for the bar, or nothing.
 */
function renderChrome(title: string): string {
  if (title === '') {
    return ''
  }
  const buttons = [0, 1, 2].map((index) => `<i class="t-dot t-dot--${index}"></i>`).join('')
  return `<div class="t-chrome"><div class="t-dots">${buttons}</div><div class="t-title">${escapeHtml(title)}</div></div>`
}

/**
 * Build the stylesheet for one terminal, with its theme resolved into it.
 *
 * @param config - The terminal as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns CSS for this terminal.
 */
function terminalStyles(config: TerminalConfig, profile: MediaProfile): string {
  const theme: TerminalTheme = resolveTerminalTheme(config.theme)
  const metrics = terminalMetrics(profile, (config.title ?? '') !== '')
  const tones = TONES.map((tone) => `.t-tone--${tone} { color: ${theme.tones[tone]}; }`).join('\n')
  const dots = theme.buttons.map((colour, index) => `.t-dot--${index} { background: ${colour}; }`).join('\n')
  return `
#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; font-family: ${FONT_STACK}; }
.t-window {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  background: ${theme.surface};
  border: 1px solid ${theme.border};
  border-radius: ${metrics.radiusPx}px;
  box-shadow: ${theme.shadow};
  overflow: hidden;
}
.t-chrome {
  flex: 0 0 ${metrics.chromePx}px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 ${metrics.padPx / 2}px;
  background: ${theme.chrome};
  border-bottom: 1px solid ${theme.border};
}
.t-dots { display: flex; gap: 6px; }
.t-dot { width: 9px; height: 9px; border-radius: 50%; display: block; }
${dots}
.t-title {
  flex: 1;
  text-align: center;
  color: ${theme.titleText};
  font-size: ${metrics.fontSizePx - 3}px;
  letter-spacing: 0.02em;
  padding-right: 39px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t-body {
  flex: 1;
  padding: ${metrics.padPx}px;
  font-size: ${metrics.fontSizePx}px;
  line-height: ${metrics.lineHeightPx}px;
  color: ${theme.tones.plain};
  overflow: hidden;
}
/* A blank line is a line. Without a floor an empty row collapses to nothing and
   the spacing a script asked for silently disappears. */
.t-row { white-space: pre-wrap; word-break: break-word; min-height: ${metrics.lineHeightPx}px; }
.t-prompt { color: ${theme.prompt}; }
${tones}
.t-cursor {
  display: inline-block;
  width: ${(metrics.fontSizePx * 0.6).toFixed(2)}px;
  height: ${metrics.fontSizePx}px;
  vertical-align: text-bottom;
  background: transparent;
}
.t-cursor--on { background: ${theme.cursor}; }
`
}

/**
 * A polished, deterministic terminal recording.
 *
 * The window is the renderer's business and the activity inside it is the
 * scene's, which is what lets one implementation carry every terminal asset in
 * a workspace: a script says what is typed and printed, a theme says what that
 * looks like, and neither has to know anything about the other.
 *
 * Nothing here animates itself. The caret's blink, the pace of the typing and
 * the arrival of each output line are all read off the instant being asked for,
 * so a recording of a given script is the same recording every time.
 */
export const terminalStage: Stage<TerminalConfig> = defineStage<TerminalConfig>({
  id: 'terminal',

  styles: terminalStyles,

  durationMs(config: TerminalConfig): number {
    return compileTimeline(config).durationMs
  },

  frame({ config, profile, atMs }): string {
    const metrics = terminalMetrics(profile, (config.title ?? '') !== '')
    const state = stateAt(compileTimeline(config), atMs)
    const input = renderInput(state)
    // why: the body is bottom-aligned like a real terminal, so what scrolls away is the top of the scrollback rather than the line being typed
    const room = metrics.rows - (input === '' ? 0 : 1)
    const visible = state.rows.slice(-room).map(renderRow).join('')
    return `<div class="t-window">${renderChrome(config.title ?? '')}<div class="t-body">${visible}${input}</div></div>`
  },
})
