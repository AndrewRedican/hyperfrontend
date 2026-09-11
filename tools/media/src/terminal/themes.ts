import type { TerminalTheme, TerminalThemeRef } from '../models/terminal'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** A dark window with a cool cast, for a page that is already dark. */
const MIDNIGHT: TerminalTheme = {
  id: 'midnight',
  backdrop: 'radial-gradient(120% 120% at 22% 0%, #16233c 0%, #0b1220 55%, #070b14 100%)',
  surface: 'rgba(11, 17, 30, 0.94)',
  chrome: 'rgba(20, 29, 47, 0.94)',
  border: 'rgba(125, 155, 205, 0.18)',
  shadow: '0 24px 60px -20px rgba(2, 6, 16, 0.85), 0 0 0 1px rgba(125, 155, 205, 0.08)',
  buttons: ['#f2726f', '#f5bf58', '#5ec98a'],
  titleText: '#7f8ea8',
  prompt: '#60a5fa',
  cursor: '#93c5fd',
  tones: {
    plain: '#dbe4f2',
    muted: '#7386a3',
    accent: '#7dd3fc',
    success: '#5ec98a',
    warning: '#f5bf58',
    danger: '#f2726f',
  },
}

/** A light window, for a page that would frame a dark one as a hole in itself. */
const DAYLIGHT: TerminalTheme = {
  id: 'daylight',
  backdrop: 'linear-gradient(160deg, #f4f7fc 0%, #e8eef8 100%)',
  surface: 'rgba(255, 255, 255, 0.97)',
  chrome: 'rgba(240, 244, 250, 0.97)',
  border: 'rgba(30, 58, 100, 0.14)',
  shadow: '0 22px 48px -22px rgba(23, 37, 84, 0.35), 0 0 0 1px rgba(30, 58, 100, 0.06)',
  buttons: ['#ec6a65', '#e2ac3f', '#3faa6b'],
  titleText: '#64748b',
  prompt: '#2563eb',
  cursor: '#1d4ed8',
  tones: {
    plain: '#1e293b',
    muted: '#64748b',
    accent: '#0369a1',
    success: '#15803d',
    warning: '#a16207',
    danger: '#b91c1c',
  },
}

/** A neutral near-black, for a recording that should carry no colour of its own. */
const INK: TerminalTheme = {
  id: 'ink',
  backdrop: '#0a0a0b',
  surface: '#111113',
  chrome: '#17171a',
  border: 'rgba(255, 255, 255, 0.1)',
  shadow: '0 20px 50px -24px rgba(0, 0, 0, 0.9)',
  buttons: ['#3f3f46', '#3f3f46', '#3f3f46'],
  titleText: '#71717a',
  prompt: '#a1a1aa',
  cursor: '#e4e4e7',
  tones: {
    plain: '#e4e4e7',
    muted: '#71717a',
    accent: '#d4d4d8',
    success: '#a3e635',
    warning: '#fbbf24',
    danger: '#fb7185',
  },
}

/**
 * The terminal treatments that ship with the recorder.
 *
 * Three rather than one because the same recording is read on a dark
 * documentation page, a light one, and a package listing that picks its own,
 * and a window that fights the page around it is the thing a reader notices
 * first. A scene that needs a fourth hands over a theme of its own rather than
 * waiting for this list to grow.
 */
const BUILT_IN: readonly TerminalTheme[] = [MIDNIGHT, DAYLIGHT, INK]

/**
 * Resolve what a scene said about its look into a theme.
 *
 * @param ref - A built-in theme name, a theme written out in full, or nothing.
 * @returns The theme the terminal is drawn with.
 * @throws {Error} When the name matches no built-in theme.
 */
export function resolveTerminalTheme(ref: TerminalThemeRef | undefined): TerminalTheme {
  if (ref === undefined) {
    return MIDNIGHT
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((theme) => theme.id === ref)
  if (found === undefined) {
    throw createError(`No terminal theme named "${ref}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
