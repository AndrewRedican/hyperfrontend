/**
 * Per-framework koi colours and varieties.
 *
 * Each koi is dressed as a real nishikigoi variety whose markings carry the
 * framework's brand colour. The brand stays the dominant identifier — it is
 * the only way a visitor tells the koi apart — but the ground and the second
 * marking colour come from the varieties themselves: white, sumi black,
 * orange, cream. Those natural tones mean nothing about the framework; they
 * are what makes the animal read as a koi rather than a logo.
 *
 * The varieties are deliberately mixed across the shoal — a plain metallic
 * ogon, simple two-colour kohaku, and fully patterned sanke/showa/asagi — so
 * no two fish share the same colour topology.
 */
import type { KoiFramework, KoiPalette } from './types.js'

/** Framework display names, used by hover identity and the accessible roster. */
const LABELS: Readonly<Record<KoiFramework, string>> = {
  vanilla: 'Vanilla TS',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  solid: 'SolidJS',
  preact: 'Preact',
  lit: 'Lit',
  angular: 'Angular',
}

/** Each framework's brand colour, worn as the dominant marking and the hover accent. */
const BRAND: Readonly<Record<KoiFramework, string>> = {
  // magic: Brand colours as each project publishes them; the marking is the only way a visitor tells the koi apart.
  vanilla: '#3178c6',
  react: '#61dafb',
  vue: '#42b883',
  svelte: '#ff3e00',
  solid: '#2c4f7c',
  preact: '#673ab8',
  lit: '#325cff',
  angular: '#dd0031',
}

/** The white nishikigoi ground most varieties are written on. */
const WHITE_GROUND = '#f6f1e9'

/** Sumi — the near-black a sanke or showa carries. */
const SUMI = '#221e1b'

/** The warm orange a koi's beni brings, used only as a natural tone. */
const BENI_ORANGE = '#e08a3c'

/** How each framework's koi is dressed: variety, ground, and second marking colour. */
const VARIETIES: Readonly<Record<KoiFramework, { pattern: KoiPalette['pattern']; body: string; shade: string }>> = {
  // why: The mixture is deliberate — ogon and kohaku keep some fish simple while sanke, showa and asagi carry black or orange, so the shoal shows a spread of colour topologies rather than eight of one.
  vanilla: { pattern: 'ogon', body: '#efe3c8', shade: '#d8c49a' },
  react: { pattern: 'asagi', body: '#eef0ee', shade: BENI_ORANGE },
  vue: { pattern: 'kohaku', body: WHITE_GROUND, shade: SUMI },
  svelte: { pattern: 'showa', body: WHITE_GROUND, shade: SUMI },
  solid: { pattern: 'sanke', body: WHITE_GROUND, shade: SUMI },
  preact: { pattern: 'kohaku', body: '#f3eee6', shade: SUMI },
  lit: { pattern: 'brand', body: '#eff1f4', shade: BENI_ORANGE },
  // why: The one red-marked koi in the shoal — Angular's brand red is a natural beni, so its sanke reads as the classic variety while staying unmistakably the Angular fish.
  angular: { pattern: 'sanke', body: WHITE_GROUND, shade: SUMI },
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
  const variety = VARIETIES[framework]
  return {
    pattern: variety.pattern,
    body: variety.body,
    shade: variety.shade,
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
