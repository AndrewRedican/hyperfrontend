/**
 * One koi, as a thing you can put in a scene.
 *
 * This is the whole production surface. A consumer builds a koi, mounts it,
 * tells it what it is doing, and calls `update` once a frame — and never learns
 * that a spine exists, that the bending happens on the GPU, or that the markings
 * are generated rather than drawn. Nothing here is bound to a component
 * lifecycle or a DOM shape, so the same koi mounts from React, from Vue, from
 * Lit or from nothing at all.
 *
 * Everything expensive happens once, at build. Per frame the koi writes two
 * small uniform arrays; the vertices are the GPU's problem.
 */
import type { BufferGeometry, MeshPhysicalMaterial, Object3D } from 'three'
import type { KoiAppearance, KoiConfigInput, KoiMotionInput, KoiPhysical, KoiResolution, KoiSwimTrim } from '../koi3d/config.js'
import type { SpinePose } from '../koi3d/spine-pose.js'
import type { KoiSwimState } from '../koi3d/swim-state.js'
import type { KoiUniforms } from './materials.js'
import { Color, Group, Mesh } from 'three'
import { sampleSection } from '../koi3d/anatomy.js'
import { buildBodyMesh } from '../koi3d/body-mesh.js'
import { CAUDAL_ROOT, resolveKoiConfig } from '../koi3d/config.js'
import { buildFinSet } from '../koi3d/fin-mesh.js'
import { buildBarbels, buildEyes } from '../koi3d/head-mesh.js'
import { mergeMeshes } from '../koi3d/mesh-data.js'
import { buildPattern } from '../koi3d/pattern.js'
import { SPINE_SAMPLES, evaluateSpine } from '../koi3d/spine-pose.js'
import { createSwimState } from '../koi3d/swim-state.js'
import { toBufferGeometry } from './geometry.js'
import { applyAppearance, createEyeMaterial, createFinMaterial, createKoiUniforms, createSkinMaterial } from './materials.js'

/** How the koi responds to being deeper in the pond. */
export interface KoiDepthResponse {
  /** How much smaller it looks on the pond floor, as a fraction of its surface size. */
  scale: number
  /** How far it washes toward the water's colour on the pond floor. */
  fade: number
  /** How much dimmer it is on the pond floor. */
  dim: number
  /** The colour deep water washes it toward. */
  tint: string
}

/** What a koi costs to draw. */
export interface KoiMetrics {
  /** Triangles across every surface. */
  triangles: number
  /** Vertices across every surface. */
  vertices: number
  /** How many draws one koi takes. */
  drawCalls: number
}

/** A chain of spheres following the posed body, for proximity and collision work. */
export interface KoiCollisionChain {
  /** Centres along the posed spine, snout first, in the koi's local space. */
  points: [number, number, number][]
  /** The radius at each centre. */
  radii: number[]
}

/** The koi's three drawable surfaces, exposed so overlays can read their buffers. */
export interface KoiSurfaces {
  /** The body shell and the barbels. */
  skin: Mesh<BufferGeometry, MeshPhysicalMaterial>
  /** Every membrane, including the tail. */
  fins: Mesh<BufferGeometry, MeshPhysicalMaterial>
  /** Both eyeballs. */
  eyes: Mesh<BufferGeometry, MeshPhysicalMaterial>
}

/** One koi in a three.js scene. */
export interface Koi {
  /** The object to add to a scene; the koi's own transform lives on it. */
  readonly object: Group
  /** Its three surfaces. */
  readonly surfaces: KoiSurfaces
  /** Everything this koi is. */
  readonly config: ReturnType<typeof resolveKoiConfig>
  /** What it costs to draw. */
  readonly metrics: KoiMetrics
  /** Its spine, as of the last update. */
  readonly pose: SpinePose
  /** The uniforms its materials read, exposed for debug overlays. */
  readonly uniforms: KoiUniforms
  /** How far through its tail beat it is, in radians. */
  readonly beat: number
  /**
   * Adds the koi to a scene or group.
   *
   * @param parent - What to add it to.
   */
  mount(parent: Object3D): void
  /** Removes the koi from whatever it was mounted on. */
  unmount(): void
  /**
   * Tells the koi what it is doing; anything left out keeps its current value.
   *
   * @param input - The motion to chase.
   */
  setMotion(input: Partial<KoiMotionInput>): void
  /**
   * Repaints the koi.
   *
   * @param input - The appearance to take on; anything left out keeps its current value.
   */
  setAppearance(input: Partial<KoiAppearance>): void
  /**
   * Rebuilds the koi's body to a new build.
   *
   * @param input - The build to take on; anything left out keeps its current value.
   */
  setPhysical(input: Partial<KoiPhysical>): void
  /**
   * Retessellates the koi.
   *
   * @param input - The densities to build at; anything left out keeps its current value.
   */
  setResolution(input: Partial<KoiResolution>): void
  /**
   * Sets how the koi answers depth.
   *
   * @param input - The response to take on; anything left out keeps its current value.
   */
  setDepthResponse(input: Partial<KoiDepthResponse>): void
  /**
   * Adjusts this koi's trim on the swimming model.
   *
   * @param input - The trim to take on; anything left out keeps its current value.
   */
  setTrim(input: Partial<KoiSwimTrim>): void
  /** What the koi was last told to do, and how it is trimmed. */
  readonly swim: KoiSwimState
  /**
   * Advances the koi by one frame.
   *
   * @param delta - Seconds since the last frame.
   */
  update(delta: number): void
  /**
   * Freezes the koi at an exact point in its beat and reposes it there.
   *
   * @param phase - Phase in radians.
   */
  setBeat(phase: number): void
  /**
   * The chain of spheres the koi currently occupies.
   *
   * @param samples - How many spheres to return; at least two.
   * @returns The chain, snout first.
   */
  collisionChain(samples?: number): KoiCollisionChain
  /** Releases every GPU resource the koi holds. */
  dispose(): void
}

/** How the koi is smaller, dimmer and bluer the deeper it swims. */
const DEFAULT_DEPTH: KoiDepthResponse = { scale: 0.72, fade: 0.42, dim: 0.66, tint: '#2b4a55' }

/**
 * Writes the koi's spine into the uniform arrays its materials read.
 *
 * @param uniforms - The shared uniform block.
 * @param pose - The posed spine.
 */
function packSpine(uniforms: KoiUniforms, pose: SpinePose): void {
  const spine = uniforms.uSpine.value
  const axis = uniforms.uSpineAxis.value
  for (let index = 0; index < SPINE_SAMPLES; index += 1) {
    const station = pose.stations[index]
    if (station === undefined) {
      continue
    }
    spine.set([station.position[0], station.position[1], station.position[2], station.yaw], index * 4)
    axis.set([station.roll, station.pitch, 0, 0], index * 4)
  }
}

/**
 * Writes the per-fin flex the koi's current effort implies.
 *
 * @param uniforms - The shared uniform block.
 * @param speed - Forward speed in body lengths per second.
 * @param escape - How hard the koi is bolting, 0 to 1.
 */
function packFinFlex(uniforms: KoiUniforms, speed: number, escape: number): void {
  const drive = Math.min(speed, 3)
  // magic: Fins fold back as the water piles up on them and beat harder as the koi works; the pectorals scull at a third of the tail's rate, which is what makes them read as independent.
  // magic: The lag is what matters most — a membrane whose tip arrives a half-beat after its root ripples, and one whose tip arrives with its root is a plate on a hinge.
  const flex = [
    [0, 0, 0, 0],
    [0.016 + drive * 0.024, 0.03 + escape * 0.016, 0.34, 0.62],
    [0.005 + drive * 0.008, 0.009 + escape * 0.008, 1, 0.5],
    [0.011 + drive * 0.018, 0.022 + escape * 0.012, 0.29, 0.58],
    [0.006 + drive * 0.01, 0.011 + escape * 0.009, 1, 0.5],
    [0.002 + drive * 0.004, 0.016 + escape * 0.024, 1, 0.4],
    [0, 0, 0, 0],
  ]
  flex.forEach((values, index) => uniforms.uFinFlex.value.set(values, index * 4))
}

/**
 * Builds one koi.
 *
 * @param input - Whatever the caller chose to override of the koi's build, skin and seed.
 * @returns The koi, unmounted and posed straight.
 *
 * @example Putting a koi in a scene and swimming it
 * ```typescript
 * const koi = createKoi({ seed: 977, appearance: { pattern: 'sanke' } })
 * koi.mount(scene)
 * koi.setMotion({ speed: 0.6, turnRate: -0.3 })
 * renderer.setAnimationLoop((now) => { koi.update(clock.getDelta()); renderer.render(scene, camera) })
 * ```
 */
export function createKoi(input: KoiConfigInput = {}): Koi {
  const config = resolveKoiConfig(input)
  const pattern = buildPattern(config.appearance.pattern, config.seed)
  const uniforms = createKoiUniforms(config.physical.length, config.appearance, pattern)
  const depth: KoiDepthResponse = { ...DEFAULT_DEPTH }

  const skinMaterial = createSkinMaterial(uniforms, config.appearance)
  const finMaterial = createFinMaterial(uniforms, config.appearance)
  const eyeMaterial = createEyeMaterial(uniforms)

  const object = new Group()
  object.name = 'koi'
  const skin = new Mesh(
    toBufferGeometry(mergeMeshes([buildBodyMesh(config.physical, config.resolution), buildBarbels(config.physical)])),
    skinMaterial
  )
  const fins = new Mesh(toBufferGeometry(buildFinSet(config.physical, config.resolution)), finMaterial)
  const eyes = new Mesh(toBufferGeometry(buildEyes(config.physical, config.resolution)), eyeMaterial)
  skin.name = 'koi-skin'
  fins.name = 'koi-fins'
  eyes.name = 'koi-eyes'
  // why: The fins are translucent and do not write depth, so they have to be drawn after everything opaque they might be seen through.
  fins.renderOrder = 1
  object.add(skin, fins, eyes)

  const swim = createSwimState({}, config.trim)
  let pose = evaluateSpine(config.physical.length, swim.swim, 0)
  const metrics: KoiMetrics = { triangles: 0, vertices: 0, drawCalls: 3 }

  const measure = (): void => {
    metrics.triangles = [skin, fins, eyes].reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
    metrics.vertices = [skin, fins, eyes].reduce((total, mesh) => total + (mesh.geometry.getAttribute('position')?.count ?? 0), 0)
  }

  const rebuild = (): void => {
    const bodies = [skin.geometry, fins.geometry, eyes.geometry]
    skin.geometry = toBufferGeometry(mergeMeshes([buildBodyMesh(config.physical, config.resolution), buildBarbels(config.physical)]))
    fins.geometry = toBufferGeometry(buildFinSet(config.physical, config.resolution))
    eyes.geometry = toBufferGeometry(buildEyes(config.physical, config.resolution))
    for (const geometry of bodies) {
      geometry.dispose()
    }
    uniforms.uKoiLength.value = config.physical.length
    uniforms.uGillStation.value = config.physical.head.length * CAUDAL_ROOT
    measure()
  }

  const repose = (): void => {
    pose = evaluateSpine(config.physical.length, swim.swim, swim.phase)
    packSpine(uniforms, pose)
    packFinFlex(uniforms, swim.motion.speed, swim.motion.escapeIntensity)
    uniforms.uBeat.value = swim.phase
    const sunk = Math.min(1, Math.max(0, swim.motion.depth))
    uniforms.uDepthFade.value = sunk * depth.fade
    uniforms.uDepthDim.value = 1 - sunk * (1 - depth.dim)
    object.scale.setScalar(1 - sunk * (1 - depth.scale))
  }

  uniforms.uGillStation.value = config.physical.head.length * CAUDAL_ROOT
  measure()
  repose()

  return {
    object,
    surfaces: { skin, fins, eyes },
    config,
    metrics,
    uniforms,
    get pose() {
      return pose
    },
    get beat() {
      return swim.phase
    },
    mount(parent) {
      parent.add(object)
    },
    unmount() {
      object.removeFromParent()
    },
    setMotion(motion) {
      swim.setMotion(motion)
    },
    setAppearance(appearance) {
      Object.assign(config.appearance, appearance)
      applyAppearance(uniforms, config.appearance, buildPattern(config.appearance.pattern, config.seed))
      skinMaterial.roughness = config.appearance.roughness
      skinMaterial.clearcoat = config.appearance.gloss
      skinMaterial.clearcoatRoughness = 0.24 + (1 - config.appearance.gloss) * 0.3
      finMaterial.opacity = config.appearance.finOpacity
    },
    setPhysical(physical) {
      Object.assign(config.physical, physical)
      rebuild()
      repose()
    },
    setResolution(resolution) {
      Object.assign(config.resolution, resolution)
      rebuild()
    },
    setDepthResponse(response) {
      Object.assign(depth, response)
      uniforms.uWaterTint.value = new Color(depth.tint)
      repose()
    },
    setTrim(trim) {
      Object.assign(config.trim, trim)
      swim.setTrim(trim)
    },
    swim,
    update(delta) {
      swim.advance(delta)
      repose()
    },
    setBeat(phase) {
      swim.setPhase(phase)
      repose()
    },
    collisionChain(samples = 6) {
      const count = Math.max(2, samples)
      const points: [number, number, number][] = []
      const radii: number[] = []
      for (let index = 0; index < count; index += 1) {
        // why: The chain stops at the caudal root because a tail fin is a membrane, not a body a neighbour can collide with.
        const station = (index / (count - 1)) * CAUDAL_ROOT
        const at = Math.round(station * (SPINE_SAMPLES - 1))
        const sample = pose.stations[at]
        if (sample === undefined) {
          continue
        }
        points.push([...sample.position])
        radii.push(bodyRadius(config.physical, station / CAUDAL_ROOT))
      }
      return { points, radii }
    },
    dispose() {
      object.removeFromParent()
      for (const mesh of [skin, fins, eyes]) {
        mesh.geometry.dispose()
      }
      skinMaterial.dispose()
      finMaterial.dispose()
      eyeMaterial.dispose()
    },
  }
}

/**
 * The radius of a sphere that fills the koi's body at a station.
 *
 * @param physical - The koi's build.
 * @param s - Position along the body, 0 at the snout and 1 at the peduncle's end.
 * @returns The radius in scene units.
 */
function bodyRadius(physical: KoiPhysical, s: number): number {
  const section = sampleSection(physical, s)
  // why: Collision wants one radius, not a cross-section, and a koi is deeper than it is wide — averaging the two reads better than taking either.
  return (section.halfWidth + (section.top + section.bottom) * 0.5) * 0.5 * physical.length * CAUDAL_ROOT
}
