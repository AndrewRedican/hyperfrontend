import type { FlowTheme, FlowThemeRef } from '../models/flow'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** A dark diagram with a cool cast, to sit beside the midnight terminal. */
const MIDNIGHT: FlowTheme = {
  id: 'midnight',
  backdrop: 'radial-gradient(120% 130% at 50% -10%, #17253f 0%, #0b1220 58%, #070b14 100%)',
  panel: 'rgba(19, 28, 47, 0.9)',
  panelBorder: 'rgba(125, 155, 205, 0.2)',
  panelActive: 'rgba(96, 165, 250, 0.65)',
  wire: 'rgba(125, 155, 205, 0.28)',
  packet: '#60a5fa',
  title: '#dbe4f2',
  subtitle: '#7386a3',
  phase: '#8ea2c2',
  tones: {
    plain: '#c3cfe4',
    muted: '#6b7c9c',
    accent: '#7dd3fc',
    success: '#5ec98a',
  },
}

/** A light diagram, for a page that would frame a dark one as a hole in itself. */
const DAYLIGHT: FlowTheme = {
  id: 'daylight',
  backdrop: 'linear-gradient(170deg, #f6f8fc 0%, #e9eff8 100%)',
  panel: 'rgba(255, 255, 255, 0.96)',
  panelBorder: 'rgba(30, 58, 100, 0.16)',
  panelActive: 'rgba(37, 99, 235, 0.6)',
  wire: 'rgba(30, 58, 100, 0.2)',
  packet: '#2563eb',
  title: '#1e293b',
  subtitle: '#64748b',
  phase: '#5b6b85',
  tones: {
    plain: '#334155',
    muted: '#7c8ba1',
    accent: '#0369a1',
    success: '#15803d',
  },
}

/** Every treatment a scene can name, with {@link MIDNIGHT} standing as the default. */
const BUILT_IN: readonly FlowTheme[] = [MIDNIGHT, DAYLIGHT]

/**
 * Resolve what a scene said about its look into a theme.
 *
 * @param ref - A built-in theme name, a theme written out in full, or nothing.
 * @returns The theme the diagram is drawn with.
 * @throws {Error} When the name matches no built-in theme.
 */
export function resolveFlowTheme(ref: FlowThemeRef | undefined): FlowTheme {
  if (ref === undefined) {
    return MIDNIGHT
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((theme) => theme.id === ref)
  if (found === undefined) {
    throw createError(`No flow theme named "${ref}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
