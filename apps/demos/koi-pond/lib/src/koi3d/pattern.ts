/**
 * Koi markings, generated rather than painted.
 *
 * A nishikigoi's pattern is not decoration stuck on a fish; it is a property of
 * the skin, and it has to behave like one. These patches live in the koi's own
 * `(station, girth)` coordinates — how far along the body, how far around it —
 * so a marking wraps over the shoulder and down the flank exactly as far as it
 * should, holds still while the body flexes underneath it, and has no seam
 * anywhere because the girth coordinate is periodic.
 *
 * Every patch derives from the koi's seed, so the same seed is always the same
 * fish, and a framework's brand colour can be dropped into a recipe without
 * changing where its markings fall.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'

/** The pattern families a koi can be written in. */
export type KoiPatternName = 'kohaku' | 'sanke' | 'showa' | 'ogon' | 'asagi' | 'karasu' | 'brand'

/** Every pattern family, in the order a picker should offer them. */
export const KOI_PATTERNS: readonly KoiPatternName[] = ['kohaku', 'sanke', 'showa', 'ogon', 'asagi', 'karasu', 'brand']

/** How many patches the shader is compiled to composite; recipes never exceed it. */
export const MAX_PATCHES = 12

/** One marking on the koi's skin. */
export interface KoiPatch {
  /** Where along the koi its centre sits, 0 at the snout and 1 at the caudal tip. */
  station: number
  /** Where around the koi its centre sits, in turns from the dorsal midline. */
  girth: number
  /** How far it reaches along the body. */
  lengthSpan: number
  /** How far it reaches around the body, in turns. */
  girthSpan: number
  /** How far its axis is turned off the body's, in radians. */
  rotation: number
  /** How soft its edge is; a nishikigoi's is razor-thin. */
  softness: number
  /** Which colour it wears: 0 for the primary, 1 for the secondary. */
  layer: 0 | 1
  /** How much noise breaks up its outline. */
  warp: number
}

/** Everything the material needs to paint one koi's skin. */
export interface KoiPatternData {
  /** The markings, in paint order. */
  patches: KoiPatch[]
  /** How strongly each scale's edge is picked out, as an asagi's net is. */
  netting: number
  /** How metallic the ground reads, as an ogon's does. */
  metallic: number
}

/** How one pattern family lays its patches out. */
interface PatchBand {
  /** Which colour the band paints in. */
  layer: 0 | 1
  /** How many patches it draws. */
  count: number
  /** The band of stations they fall between. */
  station: readonly [number, number]
  /** How far off the dorsal midline their centres wander, in turns. */
  girth: number
  /** The band of lengths they take. */
  length: readonly [number, number]
  /** How far around the body they wrap, as a multiple of their length. */
  wrap: number
  /** How soft their edges are. */
  softness: number
  /** How much noise breaks up their outlines. */
  warp: number
}

/** One pattern family's recipe. */
interface PatternRecipe {
  /** The bands it draws, in paint order. */
  bands: readonly PatchBand[]
  /** How strongly the scale edges read. */
  netting: number
  /** How metallic the ground reads. */
  metallic: number
}

/** The band a kohaku's red is drawn from; every white-ground pattern starts here. */
const KOHAKU_RED: PatchBand = {
  layer: 0,
  count: 4,
  station: [0.07, 0.68],
  girth: 0.11,
  length: [0.055, 0.105],
  wrap: 2.1,
  softness: 0.05,
  warp: 0.4,
}

/** How each family lays its markings out. */
const RECIPES: Readonly<Record<KoiPatternName, PatternRecipe>> = {
  kohaku: { bands: [KOHAKU_RED], netting: 0.18, metallic: 0 },
  sanke: {
    // why: A sanke's sumi sits above the lateral line and never on the head, which is the rule that tells it apart from a showa at a glance.
    bands: [
      KOHAKU_RED,
      { layer: 1, count: 3, station: [0.3, 0.74], girth: 0.08, length: [0.028, 0.055], wrap: 1.6, softness: 0.04, warp: 0.34 },
    ],
    netting: 0.18,
    metallic: 0,
  },
  showa: {
    bands: [
      { layer: 0, count: 4, station: [0.06, 0.72], girth: 0.14, length: [0.055, 0.11], wrap: 2.2, softness: 0.05, warp: 0.42 },
      { layer: 1, count: 4, station: [0.1, 0.78], girth: 0.17, length: [0.06, 0.12], wrap: 2.6, softness: 0.045, warp: 0.48 },
    ],
    netting: 0.12,
    metallic: 0,
  },
  ogon: { bands: [], netting: 0.34, metallic: 0.62 },
  asagi: {
    // magic: An asagi carries no patches on its back at all — the net is the pattern — and its warmth comes up from the belly and the cheeks.
    bands: [{ layer: 0, count: 3, station: [0.1, 0.52], girth: 0.31, length: [0.05, 0.09], wrap: 1.5, softness: 0.12, warp: 0.32 }],
    netting: 0.85,
    metallic: 0.12,
  },
  karasu: {
    bands: [{ layer: 0, count: 3, station: [0.16, 0.7], girth: 0.25, length: [0.05, 0.095], wrap: 1.8, softness: 0.07, warp: 0.44 }],
    netting: 0.4,
    metallic: 0.08,
  },
  brand: {
    // why: The brand pattern exists to test a framework colour at full strength, so it draws fewer and larger patches than any real variety would.
    bands: [
      { layer: 0, count: 3, station: [0.1, 0.68], girth: 0.09, length: [0.08, 0.14], wrap: 2.4, softness: 0.04, warp: 0.3 },
      { layer: 1, count: 2, station: [0.34, 0.76], girth: 0.13, length: [0.032, 0.06], wrap: 1.7, softness: 0.04, warp: 0.34 },
    ],
    netting: 0.22,
    metallic: 0.1,
  },
}

/**
 * Maps a `[0, 1)` draw onto a band.
 *
 * @param draw - The unit draw.
 * @param band - The band's floor and ceiling.
 * @returns The mapped value.
 */
function within(draw: number, band: readonly [number, number]): number {
  return band[0] + draw * (band[1] - band[0])
}

/**
 * Generates one koi's markings from its seed.
 *
 * @param pattern - Which family to draw from.
 * @param seed - The koi's stable integer seed; the same seed is always the same fish.
 * @returns The markings, and how the ground beneath them reads.
 *
 * @example Reproducing a koi's markings from its seed alone
 * ```typescript
 * const markings = buildPattern('sanke', koiSeed('vue'))
 * ```
 */
export function buildPattern(pattern: KoiPatternName, seed: number): KoiPatternData {
  const recipe = RECIPES[pattern]
  const patches: KoiPatch[] = []
  let draw = 0
  const next = (): number => randomPseudo(seed + (draw += 1) * 31)

  for (const band of recipe.bands) {
    for (let index = 0; index < band.count && patches.length < MAX_PATCHES; index += 1) {
      // how: Spacing the patches evenly along the band and only jittering within their own slot is what keeps a pattern reading as a pattern rather than as a clump.
      const slot = band.count === 1 ? 0.5 : (index + 0.5 * next()) / band.count
      const length = within(next(), band.length)
      patches.push({
        station: within(slot, band.station),
        // why: Markings pull toward the back, so the girth offset is signed but small; a patch centred on the belly would be a fault in any real variety.
        girth: (next() - 0.5) * 2 * band.girth,
        lengthSpan: length,
        girthSpan: length * band.wrap * (0.8 + next() * 0.4),
        rotation: (next() - 0.5) * 0.9,
        softness: band.softness * (0.7 + next() * 0.6),
        layer: band.layer,
        warp: band.warp * (0.75 + next() * 0.5),
      })
    }
  }

  return { patches, netting: recipe.netting, metallic: recipe.metallic }
}

/**
 * Packs markings into the two float streams the material uploads.
 *
 * @param data - The generated markings.
 * @returns The `(station, girth, lengthSpan, girthSpan)` and `(rotation, softness, layer, warp)` streams, both padded to {@link MAX_PATCHES}.
 *
 * @example Feeding the skin material
 * ```typescript
 * const [shape, style] = packPatches(buildPattern('kohaku', seed))
 * material.uniforms.uPatchShape.value = shape
 * ```
 */
export function packPatches(data: KoiPatternData): [Float32Array, Float32Array] {
  const shape = new Float32Array(MAX_PATCHES * 4)
  const style = new Float32Array(MAX_PATCHES * 4)
  data.patches.forEach((patch, index) => {
    shape.set([patch.station, patch.girth, Math.max(1e-4, patch.lengthSpan), Math.max(1e-4, patch.girthSpan)], index * 4)
    style.set([patch.rotation, Math.max(1e-3, patch.softness), patch.layer, patch.warp], index * 4)
  })
  for (let index = data.patches.length; index < MAX_PATCHES; index += 1) {
    // why: Unused slots are parked off the body rather than skipped, so the shader can run a fixed loop instead of branching on a count and still never paint anything.
    shape.set([-10, 0, 1e-4, 1e-4], index * 4)
    style.set([0, 1e-3, 0, 0], index * 4)
  }
  return [shape, style]
}
