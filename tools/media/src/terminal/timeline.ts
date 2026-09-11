import type { TerminalConfig, TerminalLine, TerminalSpan, TerminalTone } from '../models/terminal'
import { floor } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Typing rate used when neither the step nor the terminal names one. */
const DEFAULT_CPS = 22

/** How long a command appears to work before printing, when the step names nothing. */
const DEFAULT_THINK_MS = 320

/** How long each output line waits before the next appears, by default. */
const DEFAULT_LINE_MS = 90

/** Half the cursor's blink period. */
const CURSOR_PHASE_MS = 530

/** One row of the scrollback, after the script has been played into it. */
export interface TerminalRow {
  /** The prompt this row was typed against, for a row that was a command. */
  prompt?: string
  /** The row's text. */
  text: string
  /** How the row is coloured. */
  tone: TerminalTone
}

/** What the terminal shows at one moment. */
export interface TerminalState {
  /** Everything already printed, oldest first. */
  rows: readonly TerminalRow[]
  /** The prompt on the live input line. */
  prompt: string
  /** What has been typed into the live input line so far. */
  typed: string
  /** Whether a live input line is shown at all. */
  showPrompt: boolean
  /** Whether the cursor is filled at this moment. */
  cursorOn: boolean
}

/** A moment the terminal changed, and what it changed to. */
interface Keyframe {
  /** Offset from the start of the script. */
  atMs: number
  /** Everything printed by this point. */
  rows: readonly TerminalRow[]
  /** The prompt at this point. */
  prompt: string
  /** What had been typed at this point. */
  typed: string
  /** Whether a live input line was shown. */
  showPrompt: boolean
  /** Whether the cursor was resting, and so blinking, rather than being typed at. */
  resting: boolean
}

/** A script played out, as the moments it changed and how long it took. */
export interface TerminalTimeline {
  /** Every moment the terminal changed, in order. */
  keyframes: readonly Keyframe[]
  /** How long the whole script takes. */
  durationMs: number
}

/**
 * Normalise a line of output into the row it becomes.
 *
 * @param span - The line as the script wrote it.
 * @returns The row, with its tone resolved.
 */
function toRow(span: TerminalSpan): TerminalRow {
  const line: TerminalLine = typeof span === 'string' ? { text: span } : span
  return { text: line.text, tone: line.tone ?? 'plain' }
}

/**
 * Play a terminal script out into the moments it changes.
 *
 * The result is the whole of the stage's determinism. Nothing here consults a
 * clock: the script decides how long each of its own steps takes, and what
 * comes back is a list of moments that will be identical on any machine, in any
 * order, however many times it is asked for.
 *
 * @param config - The terminal as the scene configured it.
 * @returns Every moment the terminal changes, and how long the script runs.
 */
export function compileTimeline(config: TerminalConfig): TerminalTimeline {
  const defaultCps = config.cps ?? DEFAULT_CPS
  let rows: readonly TerminalRow[] = []
  let prompt = config.prompt ?? '~'
  let typed = ''
  let showPrompt = true
  let atMs = 0
  const keyframes: Keyframe[] = [{ atMs, rows, prompt, typed, showPrompt, resting: true }]
  const mark = (resting: boolean): void => {
    keyframes.push({ atMs, rows, prompt, typed, showPrompt, resting })
  }

  for (const step of config.script) {
    if (step.step === 'prompt') {
      prompt = step.text
      mark(true)
      continue
    }
    if (step.step === 'type') {
      const perChar = 1000 / (step.cps ?? defaultCps)
      showPrompt = true
      for (const character of [...step.text]) {
        atMs += perChar
        typed += character
        // why: a real cursor stops blinking while it is being typed at, and the pause when it starts again is what makes the typing read as finished
        mark(false)
      }
      mark(true)
      continue
    }
    if (step.step === 'run') {
      rows = [...rows, { prompt, text: typed, tone: 'plain' }]
      typed = ''
      showPrompt = false
      mark(false)
      atMs += step.thinkMs ?? DEFAULT_THINK_MS
      mark(false)
      continue
    }
    if (step.step === 'output') {
      for (const span of step.lines) {
        atMs += step.lineMs ?? DEFAULT_LINE_MS
        rows = [...rows, toRow(span)]
        mark(false)
      }
      showPrompt = true
      mark(true)
      continue
    }
    if (step.step === 'clear') {
      rows = []
      showPrompt = true
      mark(true)
      continue
    }
    atMs += step.ms
    mark(true)
  }
  return { keyframes, durationMs: atMs }
}

/**
 * Read the terminal's state at one instant.
 *
 * @param timeline - The compiled script.
 * @param atMs - Offset from the start of the script.
 * @returns What the terminal shows at that moment.
 */
export function stateAt(timeline: TerminalTimeline, atMs: number): TerminalState {
  let current = timeline.keyframes[0]
  for (const keyframe of timeline.keyframes) {
    if (keyframe.atMs > atMs) {
      break
    }
    current = keyframe
  }
  const resolved = current ?? { atMs: 0, rows: [], prompt: '', typed: '', showPrompt: false, resting: true }
  return {
    rows: resolved.rows,
    prompt: resolved.prompt,
    typed: resolved.typed,
    showPrompt: resolved.showPrompt,
    // why: the blink is phased on the run's own clock rather than on when the rest began, so it stays even across a step that resumes it
    cursorOn: !resolved.resting || floor(atMs / CURSOR_PHASE_MS) % 2 === 0,
  }
}
