import type { ByteTheme, ByteThemeRef } from '../models/byte'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** A dark frame with a cool cast, to sit beside the other midnight stages. */
const MIDNIGHT: ByteTheme = {
  id: 'midnight',
  backdrop: 'radial-gradient(120% 130% at 50% -10%, #17253f 0%, #0b1220 58%, #070b14 100%)',
  empty: 'rgba(125, 155, 205, 0.12)',
  bracket: 'rgba(125, 155, 205, 0.34)',
  label: '#cbd5f5',
  note: '#6b7c9c',
  source: '#7dd3fc',
  tones: {
    plain: '#8fa6cc',
    muted: '#4d6182',
    accent: '#60a5fa',
    success: '#5ec98a',
    warning: '#e5b567',
    danger: '#f2708a',
  },
}

/** A light frame, for a page that would frame a dark one as a hole in itself. */
const DAYLIGHT: ByteTheme = {
  id: 'daylight',
  backdrop: 'linear-gradient(170deg, #f6f8fc 0%, #e7eef8 100%)',
  empty: 'rgba(30, 58, 100, 0.09)',
  bracket: 'rgba(30, 58, 100, 0.28)',
  label: '#1e293b',
  note: '#7c8ba1',
  source: '#0369a1',
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
const BUILT_IN: readonly ByteTheme[] = [MIDNIGHT, DAYLIGHT]

/**
 * Resolve what a scene said about its look into a theme.
 *
 * @param ref - A built-in theme name, a theme written out in full, or nothing.
 * @returns The theme the frame is drawn with.
 * @throws {Error} When the name matches no built-in theme.
 * @example Reading the built-in out to override one colour
 * ```ts
 * const violet = { ...resolveByteTheme('midnight'), source: '#a78bfa' }
 * ```
 */
export function resolveByteTheme(ref: ByteThemeRef | undefined): ByteTheme {
  if (ref === undefined) {
    return MIDNIGHT
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((theme) => theme.id === ref)
  if (found === undefined) {
    throw createError(`No byte theme named "${ref}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
