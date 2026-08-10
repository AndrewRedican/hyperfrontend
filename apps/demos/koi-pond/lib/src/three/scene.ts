/**
 * The camera the pond looks through, and the light it looks by.
 *
 * A koi pond is seen from above. Not straight down — a few degrees off vertical
 * is what lets a viewer read the head as a head and see both eyes stand proud of
 * the skull — but close enough that the silhouette does the work. The production
 * rig is that framing, expressed once so every consumer gets the same one.
 *
 * The two lighting presets exist to be compared. Development light is neutral
 * and unforgiving, because geometry that only looks good under a flattering key
 * is geometry that is not finished. Pond light is what the koi will actually be
 * seen under.
 */
import { AmbientLight, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, PointLight } from 'three'

/** Which lighting the scene is being judged under. */
export type KoiLightingPreset = 'development' | 'pond'

/** Every lighting preset, in the order a picker should offer them. */
export const KOI_LIGHTING_PRESETS: readonly KoiLightingPreset[] = ['development', 'pond']

/** How the production camera is placed above the koi. */
export interface KoiCameraFraming {
  /** How far off straight-down the camera leans, in degrees. */
  tilt: number
  /** How far around the koi the lean is taken, in degrees; 0 leans toward the snout. */
  swing: number
  /** Distance from the koi as a multiple of its length. */
  distance: number
}

/** The framing the pond is drawn at: near overhead, leaning just enough to read a face. */
export const PRODUCTION_FRAMING: KoiCameraFraming = { tilt: 22, swing: 10, distance: 2.55 }

/**
 * Builds the production camera.
 *
 * @param aspect - Viewport width over height.
 * @returns A camera already placed at the production framing for a unit-length koi.
 *
 * @example Framing a koi from above
 * ```typescript
 * const camera = createProductionCamera(width / height)
 * placeCamera(camera, PRODUCTION_FRAMING, koi.config.physical.length)
 * ```
 */
export function createProductionCamera(aspect: number): PerspectiveCamera {
  // magic: A narrow field of view at a long distance reads as an overhead pond photograph; a wide one reads as a fisheye over a bathtub.
  const camera = new PerspectiveCamera(26, aspect, 0.05, 60)
  placeCamera(camera, PRODUCTION_FRAMING, 1)
  return camera
}

/**
 * Places a camera at a framing above the koi.
 *
 * @param camera - The camera to move.
 * @param framing - Where to put it.
 * @param length - The koi's nose-to-caudal-tip length in scene units.
 */
export function placeCamera(camera: PerspectiveCamera, framing: KoiCameraFraming, length: number): void {
  const tilt = (framing.tilt * Math.PI) / 180
  const swing = (framing.swing * Math.PI) / 180
  const reach = framing.distance * length
  camera.position.set(Math.sin(tilt) * Math.cos(swing) * reach, Math.cos(tilt) * reach, Math.sin(tilt) * Math.sin(swing) * reach)
  // why: The koi's nose points along +x, so the camera's up axis has to be +x for the fish to swim toward the top of the frame rather than across it.
  camera.up.set(1, 0, 0)
  camera.lookAt(0, 0, 0)
}

/**
 * Builds one lighting preset as a group of lights.
 *
 * @param preset - Which lighting to build.
 * @returns The lights, ready to add to a scene.
 *
 * @example Comparing a koi under both lightings
 * ```typescript
 * scene.remove(lights)
 * lights = createLighting('pond')
 * scene.add(lights)
 * ```
 */
export function createLighting(preset: KoiLightingPreset): Group {
  const group = new Group()
  group.name = `koi-lighting-${preset}`

  if (preset === 'development') {
    const key = new DirectionalLight(0xfff4e6, 2.6)
    key.position.set(0.8, 2.2, 1.1)
    const fill = new DirectionalLight(0xd8e6ff, 0.85)
    fill.position.set(-1.4, 0.5, -1.2)
    // why: A rim from behind and below is what separates the koi's silhouette from the backdrop, which is the whole point of a development key.
    const rim = new DirectionalLight(0xffffff, 1.1)
    rim.position.set(-1.1, -0.9, 0.4)
    group.add(key, fill, rim, new HemisphereLight(0xdfe9f5, 0x3a3a3a, 0.6))
    return group
  }

  const sun = new DirectionalLight(0xfff0d2, 1.9)
  sun.position.set(0.5, 3, 0.9)
  // magic: Light in a pond arrives from above and bounces back off the bed, so the fill is warm, weak and comes from underneath.
  const bed = new PointLight(0xc8a06a, 0.55, 8, 1.4)
  bed.position.set(0, -1.4, 0)
  group.add(sun, bed, new HemisphereLight(0x9fd4d8, 0x1d3b34, 0.85), new AmbientLight(0x4c7d80, 0.45))
  return group
}
