/**
 * The koi's three materials, and the one uniform block they share.
 *
 * All three are ordinary physically based three.js materials with the koi's
 * programs grafted into them. That is deliberate: it means the fish gets real
 * lighting, real shadows, real tone mapping and a correct colour pipeline for
 * free, and the only thing hand-written is what is actually specific to a koi —
 * how it bends, and what its skin looks like.
 *
 * The spine uniforms are one shared block of objects handed to every material,
 * so posing the koi is a single array write per frame no matter how many
 * surfaces read it.
 */
import type { IUniform, Material, WebGLProgramParametersWithUniforms } from 'three'
import type { KoiAppearance } from '../koi3d/config.js'
import type { KoiPatternData } from '../koi3d/pattern.js'
import { Color, DoubleSide, MeshPhysicalMaterial } from 'three'
import { packPatches } from '../koi3d/pattern.js'
import { SPINE_SAMPLES } from '../koi3d/spine-pose.js'
import { DEFORM_FRAGMENT_COMMON, DEFORM_NORMAL, DEFORM_POSITION, DEFORM_VERTEX_COMMON } from './deform.glsl.js'
import {
  EYE_COLOUR,
  EYE_FRAGMENT_COMMON,
  FIN_COLOUR,
  FIN_FRAGMENT_COMMON,
  SKIN_COLOUR,
  SKIN_FRAGMENT_COMMON,
  SKIN_METALNESS,
  SKIN_NORMAL,
  SKIN_ROUGHNESS,
} from './skin.glsl.js'

/** How many fin kinds the flex uniform carries, including the body's own empty slot. */
const FLEX_SLOTS = 7

/**
 * The colour a fin takes at its root.
 *
 * @param accent - The koi's accent colour.
 * @param base - The koi's ground colour.
 * @returns The root colour: mostly the ground, carrying a wash of the accent.
 */
function finRootColour(accent: string, base: string): Color {
  // why: A koi's fins are the same pale tissue as its belly with a little of its own colour bled into them; painting them the accent outright turns them into orange paddles.
  return new Color(base).lerp(new Color(accent), 0.38)
}

/**
 * The colour a fin takes at its outer edge.
 *
 * @param base - The koi's ground colour.
 * @returns The edge colour: the ground, lifted toward white.
 */
function finEdgeColour(base: string): Color {
  return new Color(base).lerp(new Color(0xffffff), 0.45)
}

/** Every uniform the koi's programs read, shared by all three of its materials. */
export interface KoiUniforms {
  /** Per-station `(x, y, z, yaw)` of the posed spine. */
  uSpine: IUniform<Float32Array>
  /** Per-station `(roll, pitch, 0, 0)` of the posed spine. */
  uSpineAxis: IUniform<Float32Array>
  /** Per-fin `(sweep, flap, frequency, lag)`. */
  uFinFlex: IUniform<Float32Array>
  /** The koi's nose-to-caudal-tip length in scene units. */
  uKoiLength: IUniform<number>
  /** How far through the tail beat the koi is, in radians. */
  uBeat: IUniform<number>
  /** The colour deep water washes the koi toward. */
  uWaterTint: IUniform<Color>
  /** How far toward that colour the koi's depth has taken it. */
  uDepthFade: IUniform<number>
  /** How much dimmer the koi's depth has made it, 1 at the surface. */
  uDepthDim: IUniform<number>
  /** The ground colour of the skin. */
  uBaseColour: IUniform<Color>
  /** The dominant marking colour. */
  uPrimaryColour: IUniform<Color>
  /** The second marking colour. */
  uSecondaryColour: IUniform<Color>
  /** The pale underside. */
  uBellyColour: IUniform<Color>
  /** Per-marking `(station, girth, lengthSpan, girthSpan)`. */
  uPatchShape: IUniform<Float32Array>
  /** Per-marking `(rotation, softness, layer, warp)`. */
  uPatchStyle: IUniform<Float32Array>
  /** How strongly the scale edges read. */
  uNetting: IUniform<number>
  /** How metallic the ground reads. */
  uMetallicMix: IUniform<number>
  /** How deep the scale relief is. */
  uScaleDepth: IUniform<number>
  /** How many scale rows run around the koi. */
  uScaleDensity: IUniform<number>
  /** Where the operculum's trailing edge crosses the body. */
  uGillStation: IUniform<number>
  /** Membrane colour at a fin's root. */
  uFinColour: IUniform<Color>
  /** Membrane colour at a fin's edge. */
  uFinTipColour: IUniform<Color>
  /** How many rays run through each fin. */
  uFinRays: IUniform<number>
  /** How strongly the rays read against the web. */
  uFinRayContrast: IUniform<number>
  /** The iris ring's colour. */
  uIrisColour: IUniform<Color>
  /** The pupil's colour. */
  uPupilColour: IUniform<Color>
  /** The colour of the eyeball where it is buried in the socket. */
  uScleraColour: IUniform<Color>
  /** How much of the eyeball the iris covers. */
  uIrisSize: IUniform<number>
  /** How much of the eyeball the pupil covers. */
  uPupilSize: IUniform<number>
  /** How far forward off the socket's axis the koi looks, in radians. */
  uEyeGaze: IUniform<number>
}

/**
 * Opens the uniform block one koi's materials share.
 *
 * @param length - The koi's nose-to-caudal-tip length in scene units.
 * @param appearance - Its skin.
 * @param pattern - Its generated markings.
 * @returns The uniforms, already populated.
 *
 * @example Posing every surface of a koi at once
 * ```typescript
 * uniforms.uSpine.value.set(packed)
 * uniforms.uBeat.value = swim.phase
 * ```
 */
export function createKoiUniforms(length: number, appearance: KoiAppearance, pattern: KoiPatternData): KoiUniforms {
  const [shape, style] = packPatches(pattern)
  return {
    uSpine: { value: new Float32Array(SPINE_SAMPLES * 4) },
    uSpineAxis: { value: new Float32Array(SPINE_SAMPLES * 4) },
    uFinFlex: { value: new Float32Array(FLEX_SLOTS * 4) },
    uKoiLength: { value: length },
    uBeat: { value: 0 },
    uWaterTint: { value: new Color('#2c4a52') },
    uDepthFade: { value: 0 },
    uDepthDim: { value: 1 },
    uBaseColour: { value: new Color(appearance.base) },
    uPrimaryColour: { value: new Color(appearance.primary) },
    uSecondaryColour: { value: new Color(appearance.secondary) },
    uBellyColour: { value: new Color('#f7f2e6') },
    uPatchShape: { value: shape },
    uPatchStyle: { value: style },
    uNetting: { value: pattern.netting },
    uMetallicMix: { value: pattern.metallic },
    uScaleDepth: { value: appearance.scaleDepth },
    uScaleDensity: { value: appearance.scaleDensity },
    uGillStation: { value: 0.2 },
    uFinColour: { value: finRootColour(appearance.accent, appearance.base) },
    uFinTipColour: { value: finEdgeColour(appearance.base) },
    uFinRays: { value: 9 },
    uFinRayContrast: { value: 0.16 },
    uIrisColour: { value: new Color('#8a6a35') },
    uPupilColour: { value: new Color('#0d0a08') },
    uScleraColour: { value: new Color('#3a2f27') },
    uIrisSize: { value: 0.34 },
    uPupilSize: { value: 0.16 },
    uEyeGaze: { value: 0.22 },
  }
}

/** One material's shader grafts, applied when three compiles it. */
interface Graft {
  /** Declarations appended to the fragment shader's common block. */
  fragmentCommon: string
  /** Replacements applied to the fragment shader, in order. */
  fragmentPatches: readonly (readonly [string, string])[]
  /** A key that keeps three from sharing one program between two koi materials. */
  cacheKey: string
}

/**
 * Grafts the koi's programs into a stock three.js material.
 *
 * @param material - The material to patch.
 * @param uniforms - The shared uniform block.
 * @param graft - What to inject.
 */
function graftKoiShader(material: Material, uniforms: KoiUniforms, graft: Graft): void {
  material.customProgramCacheKey = (): string => graft.cacheKey
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DEFORM_VERTEX_COMMON}`)
      .replace('#include <beginnormal_vertex>', DEFORM_NORMAL)
      .replace('#include <begin_vertex>', DEFORM_POSITION)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${DEFORM_FRAGMENT_COMMON}\n${graft.fragmentCommon}`
    )
    for (const [anchor, addition] of graft.fragmentPatches) {
      shader.fragmentShader = shader.fragmentShader.replace(anchor, `${anchor}\n${addition}`)
    }
  }
}

/**
 * Builds the koi's skin material.
 *
 * @param uniforms - The shared uniform block.
 * @param appearance - The koi's skin.
 * @returns The material.
 */
export function createSkinMaterial(uniforms: KoiUniforms, appearance: KoiAppearance): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: appearance.roughness,
    metalness: 0.02,
    // magic: A thin clear coat over a fairly rough base is what wet skin is; raising the base's own gloss instead would turn the koi into painted plastic.
    clearcoat: appearance.gloss,
    clearcoatRoughness: 0.24 + (1 - appearance.gloss) * 0.3,
    sheen: 0.25,
    sheenRoughness: 0.7,
    sheenColor: new Color('#ffd9b0'),
    envMapIntensity: 0.8,
  })
  graftKoiShader(material, uniforms, {
    fragmentCommon: SKIN_FRAGMENT_COMMON,
    fragmentPatches: [
      ['#include <color_fragment>', SKIN_COLOUR],
      ['#include <roughnessmap_fragment>', SKIN_ROUGHNESS],
      ['#include <metalnessmap_fragment>', SKIN_METALNESS],
      ['#include <normal_fragment_begin>', SKIN_NORMAL],
    ],
    cacheKey: 'koi-skin',
  })
  return material
}

/**
 * Builds the koi's fin material.
 *
 * @param uniforms - The shared uniform block.
 * @param appearance - The koi's skin.
 * @returns The material.
 */
export function createFinMaterial(uniforms: KoiUniforms, appearance: KoiAppearance): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    transparent: true,
    opacity: appearance.finOpacity,
    side: DoubleSide,
    // why: Fin membranes overlap each other and the body constantly; writing depth from a translucent surface would punch holes in whatever is behind it.
    depthWrite: false,
  })
  graftKoiShader(material, uniforms, {
    fragmentCommon: `${SKIN_FRAGMENT_COMMON}\n${FIN_FRAGMENT_COMMON}`,
    fragmentPatches: [['#include <color_fragment>', FIN_COLOUR]],
    cacheKey: 'koi-fin',
  })
  return material
}

/**
 * Builds the koi's eye material.
 *
 * @param uniforms - The shared uniform block.
 * @returns The material.
 */
export function createEyeMaterial(uniforms: KoiUniforms): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.09,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  })
  graftKoiShader(material, uniforms, {
    fragmentCommon: EYE_FRAGMENT_COMMON,
    fragmentPatches: [['#include <color_fragment>', EYE_COLOUR]],
    cacheKey: 'koi-eye',
  })
  return material
}

/**
 * Rewrites the colour uniforms after an appearance change.
 *
 * @param uniforms - The shared uniform block.
 * @param appearance - The koi's new skin.
 * @param pattern - Its regenerated markings.
 */
export function applyAppearance(uniforms: KoiUniforms, appearance: KoiAppearance, pattern: KoiPatternData): void {
  const [shape, style] = packPatches(pattern)
  uniforms.uBaseColour.value.set(appearance.base)
  uniforms.uPrimaryColour.value.set(appearance.primary)
  uniforms.uSecondaryColour.value.set(appearance.secondary)
  uniforms.uFinColour.value.copy(finRootColour(appearance.accent, appearance.base))
  uniforms.uFinTipColour.value.copy(finEdgeColour(appearance.base))
  uniforms.uPatchShape.value.set(shape)
  uniforms.uPatchStyle.value.set(style)
  uniforms.uNetting.value = pattern.netting
  uniforms.uMetallicMix.value = pattern.metallic
  uniforms.uScaleDepth.value = appearance.scaleDepth
  uniforms.uScaleDensity.value = appearance.scaleDensity
}
