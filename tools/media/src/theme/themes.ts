import type { MediaTheme, ThemeId } from '../models/theme'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** The face labels, notes and prose are set in. */
const SANS = "'Inter', 'Liberation Sans', 'DejaVu Sans', Helvetica, Arial, sans-serif"

/**
 * The face source and values are set in.
 *
 * Named explicitly rather than left to `monospace` because the generic family
 * resolves to whatever the recording machine happens to prefer, which on a
 * minimal Linux image is routinely a CJK face with the wrong advance width for
 * everything else in the frame.
 */
const MONO = "'JetBrains Mono', 'Liberation Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace"

/**
 * The documentation site's dark theme, as a recording sees it.
 *
 * A cool near-black with a wash of the site's blue at the top of the frame,
 * so an asset embedded on a dark page reads as part of it rather than as a
 * window onto something else.
 */
const DARK: MediaTheme = {
  id: 'dark',
  transparent: false,
  backdrop: 'radial-gradient(120% 130% at 50% -10%, #17253f 0%, #0b1220 58%, #070b14 100%)',
  plate: '',
  plateBorder: '',
  surface: 'rgba(19, 28, 47, 0.88)',
  surfaceRaised: 'rgba(30, 41, 66, 0.96)',
  border: 'rgba(125, 155, 205, 0.2)',
  rule: 'rgba(125, 155, 205, 0.15)',
  borderActive: 'rgba(96, 165, 250, 0.7)',
  shadow: '0 24px 60px -24px rgba(2, 6, 16, 0.85)',
  accent: '#60a5fa',
  accentSoft: 'rgba(96, 165, 250, 0.14)',
  text: {
    strong: '#e5ecf8',
    plain: '#cbd5f5',
    muted: '#7f8fae',
    faint: '#4d5f80',
  },
  tones: {
    plain: '#cbd5f5',
    muted: '#6f809f',
    accent: '#7dd3fc',
    success: '#5ec98a',
    warning: '#e9bb62',
    danger: '#f2708a',
  },
  syntax: {
    comment: '#5f7092',
    string: '#7dd3fc',
    number: '#b39cf9',
    keyword: '#f472b6',
    call: '#60a5fa',
    punctuation: '#8494bd',
  },
  chrome: {
    bar: 'rgba(30, 41, 66, 0.96)',
    buttons: ['#f2708a', '#e5b567', '#5ec98a'],
    title: '#8ea2c2',
  },
  fonts: { sans: SANS, mono: MONO },
}

/**
 * The documentation site's light theme.
 *
 * White surfaces on a pale blue-grey ground, with the same blue doing the
 * pointing. Contrast is stronger than the dark theme needs, because a light
 * page is read in brighter rooms.
 */
const LIGHT: MediaTheme = {
  id: 'light',
  transparent: false,
  backdrop: 'linear-gradient(170deg, #f7f9fd 0%, #e6edf8 100%)',
  plate: '',
  plateBorder: '',
  surface: 'rgba(255, 255, 255, 0.94)',
  surfaceRaised: 'rgba(238, 243, 250, 0.98)',
  border: 'rgba(30, 58, 100, 0.16)',
  rule: 'rgba(30, 58, 100, 0.12)',
  borderActive: 'rgba(37, 99, 235, 0.6)',
  shadow: '0 22px 48px -26px rgba(23, 37, 84, 0.35)',
  accent: '#2563eb',
  accentSoft: 'rgba(37, 99, 235, 0.1)',
  text: {
    strong: '#0f172a',
    plain: '#1e293b',
    muted: '#64748b',
    faint: '#94a3b8',
  },
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
  chrome: {
    bar: 'rgba(237, 242, 249, 0.98)',
    buttons: ['#ef7a8d', '#dfa14f', '#4fae7a'],
    title: '#5b6b85',
  },
  fonts: { sans: SANS, mono: MONO },
}

/**
 * The theme for a surface nobody here controls.
 *
 * Nothing about the page around a portable asset is known: npm renders on
 * white, GitHub on whatever the reader chose, another site on anything. So
 * the canvas is transparent and everything is drawn on one opaque plate with
 * an edge of its own, at a luminance that sits between black and white so the
 * edge shows on both. The plate is deliberately neutral rather than blue: a
 * colour cast that belongs to one page looks like a mistake on another. Text
 * runs a step brighter than the dark theme's because the plate cannot borrow
 * contrast from a page it does not know, and there are no shadows, because a
 * GIF has no half-transparency to blend one with.
 */
const PORTABLE: MediaTheme = {
  id: 'portable',
  transparent: true,
  backdrop: 'transparent',
  plate: '#161b26',
  plateBorder: '#3f4a5e',
  surface: '#1f2634',
  surfaceRaised: '#283040',
  border: '#39435a',
  rule: '#313a4d',
  borderActive: '#7db8ff',
  shadow: 'none',
  accent: '#7db8ff',
  accentSoft: 'rgba(125, 184, 255, 0.16)',
  text: {
    strong: '#f3f6fa',
    plain: '#dfe5ee',
    muted: '#9ca8ba',
    faint: '#6c788c',
  },
  tones: {
    plain: '#dfe5ee',
    muted: '#8b97aa',
    accent: '#8fd3ff',
    success: '#6fd39a',
    warning: '#f0c56a',
    danger: '#ff7f8b',
  },
  syntax: {
    comment: '#7a8699',
    string: '#8fd3ff',
    number: '#c4b0ff',
    keyword: '#ff8ccb',
    call: '#7db8ff',
    punctuation: '#9aa6b8',
  },
  chrome: {
    bar: '#283040',
    buttons: ['#ff7f8b', '#f0c56a', '#6fd39a'],
    title: '#9ca8ba',
  },
  fonts: { sans: SANS, mono: MONO },
}

/** Every variant, in the order they are rendered and documented. */
const BUILT_IN: readonly MediaTheme[] = [PORTABLE, DARK, LIGHT]

/**
 * Every built-in theme, for a command that lists them.
 *
 * @returns The built-in themes, in the order they are documented.
 */
export function listThemes(): readonly MediaTheme[] {
  return BUILT_IN
}

/**
 * Look a built-in theme up by name.
 *
 * @param id - Which of the three variants is wanted.
 * @returns The theme's full token table.
 * @throws {Error} When no built-in theme has that name.
 */
export function builtInTheme(id: ThemeId): MediaTheme {
  const found = BUILT_IN.find((theme) => theme.id === id)
  if (found === undefined) {
    throw createError(`No media theme named "${id}". Built-in themes: ${BUILT_IN.map((theme) => theme.id).join(', ')}`)
  }
  return found
}
