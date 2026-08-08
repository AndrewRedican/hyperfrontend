/**
 * Per-framework koi colours.
 *
 * Every koi wears the same species colouring — a pale nishikigoi ground with a
 * shadowed belly — so the seven read as one shoal. Only the marking splashed
 * across the back and the hover-card accent carry the framework's brand, which
 * is what makes a fish identifiable without labelling it.
 */
import type { KoiFramework, KoiPalette } from './types.js'

/** The pale ground every koi shares, so the shoal reads as one species. */
const BODY = '#f4ece2'

/** The shadowed underside every koi shares. */
const SHADE = '#c9b6a4'

/** Framework display names, used by hover identity and the accessible roster. */
const LABELS: Readonly<Record<KoiFramework, string>> = {
  vanilla: 'Vanilla TS',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  solid: 'SolidJS',
  preact: 'Preact',
  lit: 'Lit',
}

/** Each framework's brand colour, used for the koi's marking and its hover accent. */
const BRAND: Readonly<Record<KoiFramework, string>> = {
  // magic: Brand colours as each project publishes them; the marking is the only way a visitor tells the koi apart.
  vanilla: '#3178c6',
  react: '#61dafb',
  vue: '#42b883',
  svelte: '#ff3e00',
  solid: '#2c4f7c',
  preact: '#673ab8',
  lit: '#325cff',
}

/** Fin translucency applied to the brand colour, as an alpha channel byte. */
const FIN_ALPHA = 0x66

/**
 * Renders a hex colour with an alpha channel appended.
 *
 * @param hex - A six-digit `#rrggbb` colour.
 * @param alpha - Alpha byte, 0 to 255.
 * @returns The eight-digit `#rrggbbaa` colour.
 */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${alpha.toString(16).padStart(2, '0')}`
}

/**
 * Builds the colours one koi wears.
 *
 * @param framework - The framework slug rendering the koi.
 * @returns Its palette.
 *
 * @example Painting a koi's marking
 * ```typescript
 * const palette = koiPalette('svelte')
 * marking.setAttribute('fill', palette.marking)
 * ```
 */
export function koiPalette(framework: KoiFramework): KoiPalette {
  const brand = BRAND[framework]
  return {
    body: BODY,
    shade: SHADE,
    marking: brand,
    fin: withAlpha(brand, FIN_ALPHA),
    accent: brand,
  }
}

/**
 * Reads a framework's display name.
 *
 * @param framework - The framework slug.
 * @returns The name to show a visitor.
 */
export function koiLabel(framework: KoiFramework): string {
  return LABELS[framework]
}
