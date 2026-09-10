import type { PanelTheme, PanelThemeRef } from '../models/panel'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** A dark frame with a cool cast, to sit beside the midnight terminal and flow. */
const MIDNIGHT: PanelTheme = {
  id: 'midnight',
  backdrop: 'radial-gradient(120% 130% at 50% -10%, #17253f 0%, #0b1220 58%, #070b14 100%)',
  panel: 'rgba(19, 28, 47, 0.86)',
  panelBorder: 'rgba(125, 155, 205, 0.2)',
  rule: 'rgba(125, 155, 205, 0.16)',
  title: '#8ea2c2',
  marker: '#4d6182',
  emphasis: 'rgba(96, 165, 250, 0.13)',
  chrome: 'rgba(30, 41, 66, 0.95)',
  buttons: ['#f2708a', '#e5b567', '#5ec98a'],
  cursor: '#60a5fa',
  tones: {
    plain: '#cbd5f5',
    muted: '#6b7c9c',
    accent: '#7dd3fc',
    success: '#5ec98a',
    warning: '#e5b567',
    danger: '#f2708a',
  },
  syntax: {
    comment: '#5a6b8c',
    string: '#7dd3fc',
    number: '#a78bfa',
    keyword: '#f472b6',
    call: '#60a5fa',
    punctuation: '#8494bd',
  },
}

/** A light frame, for a page that would frame a dark one as a hole in itself. */
const DAYLIGHT: PanelTheme = {
  id: 'daylight',
  backdrop: 'linear-gradient(170deg, #f6f8fc 0%, #e7eef8 100%)',
  panel: 'rgba(255, 255, 255, 0.94)',
  panelBorder: 'rgba(30, 58, 100, 0.16)',
  rule: 'rgba(30, 58, 100, 0.12)',
  title: '#5b6b85',
  marker: '#9aa8bd',
  emphasis: 'rgba(37, 99, 235, 0.1)',
  chrome: 'rgba(237, 242, 249, 0.98)',
  buttons: ['#ef7a8d', '#dfa14f', '#4fae7a'],
  cursor: '#2563eb',
  tones: {
    plain: '#1e293b',
    muted: '#7c8ba1',
    accent: '#0369a1',
    success: '#15803d',
    warning: '#b45309',
    danger: '#be123c',
  },
  syntax: {
    comment: '#8b98ac',
    string: '#0369a1',
    number: '#6d28d9',
    keyword: '#be185d',
    call: '#1d4ed8',
    punctuation: '#64748b',
  },
}

/** Every treatment a scene can name, with {@link MIDNIGHT} standing as the default. */
const BUILT_IN: readonly PanelTheme[] = [MIDNIGHT, DAYLIGHT]

/**
 * Resolve what a scene said about its look into a theme.
 *
 * @param ref - A built-in theme name, a theme written out in full, or nothing.
 * @returns The theme the frame is drawn with.
 * @throws {Error} When the name matches no built-in theme.
 * @example Tinting one scene without writing a whole theme
 * ```ts
 * const base = resolvePanelTheme('midnight')
 * const mine = { ...base, cursor: '#5eead4', emphasis: 'rgba(94, 234, 212, 0.12)' }
 * ```
 */
export function resolvePanelTheme(ref: PanelThemeRef | undefined): PanelTheme {
  if (ref === undefined) {
    return MIDNIGHT
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((theme) => theme.id === ref)
  if (found === undefined) {
    throw createError(`No panel theme named "${ref}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
