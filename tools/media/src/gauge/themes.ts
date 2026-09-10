import type { GaugeTheme, GaugeThemeRef } from '../models/gauge'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** A dark frame with a cool cast, to sit beside the other midnight stages. */
const MIDNIGHT: GaugeTheme = {
  id: 'midnight',
  backdrop: 'radial-gradient(120% 130% at 50% -10%, #17253f 0%, #0b1220 58%, #070b14 100%)',
  panel: 'rgba(19, 28, 47, 0.86)',
  panelBorder: 'rgba(125, 155, 205, 0.2)',
  trough: 'rgba(125, 155, 205, 0.14)',
  title: '#8ea2c2',
  label: '#cbd5f5',
  note: '#6b7c9c',
  tones: {
    plain: '#8fa6cc',
    muted: '#5b6c8c',
    accent: '#60a5fa',
    success: '#5ec98a',
    warning: '#e5b567',
    danger: '#f2708a',
  },
}

/** A light frame, for a page that would frame a dark one as a hole in itself. */
const DAYLIGHT: GaugeTheme = {
  id: 'daylight',
  backdrop: 'linear-gradient(170deg, #f6f8fc 0%, #e7eef8 100%)',
  panel: 'rgba(255, 255, 255, 0.94)',
  panelBorder: 'rgba(30, 58, 100, 0.16)',
  trough: 'rgba(30, 58, 100, 0.1)',
  title: '#5b6b85',
  label: '#1e293b',
  note: '#7c8ba1',
  tones: {
    plain: '#64748b',
    muted: '#9aa8bd',
    accent: '#2563eb',
    success: '#15803d',
    warning: '#b45309',
    danger: '#be123c',
  },
}

/** Every treatment a scene can name, with {@link MIDNIGHT} standing as the default. */
const BUILT_IN: readonly GaugeTheme[] = [MIDNIGHT, DAYLIGHT]

/**
 * Resolve what a scene said about its look into a theme.
 *
 * @param ref - A built-in theme name, a theme written out in full, or nothing.
 * @returns The theme the frame is drawn with.
 * @throws {Error} When the name matches no built-in theme.
 * @example Reading the built-in out to override one colour
 * ```ts
 * const warm = { ...resolveGaugeTheme('midnight'), trough: 'rgba(229, 181, 103, 0.12)' }
 * ```
 */
export function resolveGaugeTheme(ref: GaugeThemeRef | undefined): GaugeTheme {
  if (ref === undefined) {
    return MIDNIGHT
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((theme) => theme.id === ref)
  if (found === undefined) {
    throw createError(`No gauge theme named "${ref}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
