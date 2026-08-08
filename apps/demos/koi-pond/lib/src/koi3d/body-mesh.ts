/**
 * The koi's body, lofted from its anatomy into one continuous shell.
 *
 * The surface is a single parametric function of `(s, theta)` — position along
 * the body and position around it — which is what keeps the koi continuous.
 * There are no separate head, torso and tail meshes to line up, because there
 * are no separate meshes: the head *is* the front of the same shell, and the
 * transition into the peduncle is whatever the anatomy table says it is.
 *
 * Normals come from differentiating that same function rather than from
 * averaging triangles, so they are exact, they cost nothing to compute, and the
 * seam where the ring closes has no visible line down the koi's back.
 */
import type { KoiPhysical, KoiResolution } from './config.js'
import type { MeshData } from './mesh-data.js'
import { sampleSection, sectionPoint } from './anatomy.js'
import { CAUDAL_BLEND, CAUDAL_BLEND_HEIGHT, CAUDAL_ROOT, PIVOT_STATION } from './config.js'
import { createMeshBuilder, finishMesh, pushQuad, pushVertex } from './mesh-data.js'

/** How many rings round off the snout ahead of the first anatomy station. */
const NOSE_CAP_RINGS = 4

/** How many rings carry the peduncle's flesh back into the tail's base. */
const TAIL_BLEND_RINGS = 5

/** How far the eye's bulge reaches along the body, as a fraction of body length. */
const EYE_BULGE_LENGTH = 0.052

/** How far the eye's bulge reaches around the body, in turns. */
const EYE_BULGE_GIRTH = 0.075

/**
 * How much the skull swells around each eye, as a fraction of the local section.
 *
 * A koi's eyes are not set into a smooth head; the skull carries a distinct
 * bulge around each socket, and it is the pair of bulges seen from above that
 * makes the head read as bilateral rather than as a wedge with dots on it.
 */
const EYE_BULGE_AMOUNT = 0.28

/**
 * How far around the body an eye sits from the dorsal midline, in turns.
 *
 * @param physical - The koi's build.
 * @returns The left eye's position around the section; the right eye mirrors it.
 */
export function eyeTheta(physical: KoiPhysical): number {
  return 0.25 - physical.eyes.rise * 0.07
}

/**
 * A point on the koi's skin, and the frame the mesh generators read it through.
 *
 * @param physical - The koi's build.
 * @param s - Position along the body, 0 at the snout and 1 at the caudal peduncle's end.
 * @param theta - Position around the body in turns, 0 at the dorsal midline.
 * @param shrink - Radial scale, used by the nose cap to close the shell and by the tail blend to thin it.
 * @param flatten - Extra lateral scale, which is what collapses the peduncle into a blade without losing its height.
 * @returns The model-space point, in units of the koi's total length.
 *
 * @example Placing a fin's root on the skin
 * ```typescript
 * const root = surfacePoint(physical, fin.station / CAUDAL_ROOT, 0.5, 1)
 * ```
 */
export function surfacePoint(physical: KoiPhysical, s: number, theta: number, shrink = 1, flatten = 1): [number, number, number] {
  const section = sampleSection(physical, s)
  const point = sectionPoint(section, theta)
  const socket = eyeTheta(physical)
  // how: The bulge is measured on both flanks at once by folding theta about the midline, so one term serves both eyes and neither can drift from the other.
  const mirrored = Math.min(Math.abs(theta - socket), Math.abs(1 - theta - socket))
  const alongEye = (s - physical.eyes.station) / EYE_BULGE_LENGTH
  const aroundEye = mirrored / EYE_BULGE_GIRTH
  const bulge = 1 + EYE_BULGE_AMOUNT * physical.eyes.size * 55 * Math.exp(-alongEye * alongEye - aroundEye * aroundEye)
  const swell = bulge * shrink
  return [
    PIVOT_STATION - s * CAUDAL_ROOT,
    (section.rise + (point.y - section.rise) * swell) * CAUDAL_ROOT,
    point.z * swell * flatten * CAUDAL_ROOT,
  ]
}

/** How far apart the samples that differentiate the surface are taken. */
const DERIVATIVE_STEP = 0.0015

/**
 * The outward unit normal of the skin, from the surface's own derivatives.
 *
 * @param physical - The koi's build.
 * @param s - Position along the body.
 * @param theta - Position around the body in turns.
 * @param shrink - Radial scale, matching the point being shaded.
 * @param flatten - Lateral scale, matching the point being shaded.
 * @returns The unit normal, pointing out of the koi.
 */
export function surfaceNormal(physical: KoiPhysical, s: number, theta: number, shrink = 1, flatten = 1): [number, number, number] {
  const ahead = surfacePoint(physical, Math.min(1, s + DERIVATIVE_STEP), theta, shrink, flatten)
  const behind = surfacePoint(physical, Math.max(0, s - DERIVATIVE_STEP), theta, shrink, flatten)
  const left = surfacePoint(physical, s, theta + DERIVATIVE_STEP, shrink, flatten)
  const right = surfacePoint(physical, s, theta - DERIVATIVE_STEP, shrink, flatten)
  const alongX = ahead[0] - behind[0]
  const alongY = ahead[1] - behind[1]
  const alongZ = ahead[2] - behind[2]
  const aroundX = left[0] - right[0]
  const aroundY = left[1] - right[1]
  const aroundZ = left[2] - right[2]
  const x = alongY * aroundZ - alongZ * aroundY
  const y = alongZ * aroundX - alongX * aroundZ
  const z = alongX * aroundY - alongY * aroundX
  const magnitude = Math.hypot(x, y, z)
  // why: The poles of the nose and tail caps have no ring to differentiate around, so they fall back to the axis rather than emitting NaN through the whole shell.
  if (magnitude === 0) {
    return [s < 0.5 ? 1 : -1, 0, 0]
  }
  return [x / magnitude, y / magnitude, z / magnitude]
}

/** One ring of the lofted shell, before it is written into the builder. */
interface RingPlan {
  /** Position along the body this ring samples the anatomy at. */
  s: number
  /** Radial scale applied to the section, closing the shell at the snout and thinning it at the tail. */
  shrink: number
  /** Extra lateral scale, which flattens the peduncle into the tail's blade. */
  flatten: number
  /** How far the ring is pushed past the station it samples, in total-length units. */
  reach: number
  /** Where this ring sits on the deformation curve, so the tail blend bends with the tail rather than with the peduncle. */
  station: number
}

/**
 * How many rings the shell is lofted from, including its snout cap and tail blend.
 *
 * @param resolution - How finely to tessellate.
 * @returns The ring count.
 *
 * @example Reporting a koi's topology
 * ```typescript
 * const vertices = bodyRingCount(resolution) * (resolution.radial + 1)
 * ```
 */
export function bodyRingCount(resolution: KoiResolution): number {
  return NOSE_CAP_RINGS + resolution.rings + TAIL_BLEND_RINGS
}

/**
 * Lays out every ring of the shell, from the rounded snout to the tail's base.
 *
 * @param resolution - How finely to tessellate.
 * @param snout - How bluntly the snout ends, from the koi's head build.
 * @returns The rings, nose first.
 */
function planRings(resolution: KoiResolution, snout: number): RingPlan[] {
  const rings: RingPlan[] = []
  // magic: A quarter-ellipse cap of this depth turns the profile's first station into a rounded muzzle instead of a cone; scaling it by the snout knob is what broadens the face.
  const noseReach = 0.012 * (0.6 + snout * 0.8)
  for (let index = NOSE_CAP_RINGS; index >= 1; index -= 1) {
    const angle = (index / NOSE_CAP_RINGS) * Math.PI * 0.5
    rings.push({ s: 0, shrink: Math.cos(angle), flatten: 1, reach: noseReach * Math.sin(angle), station: 0 })
  }
  for (let index = 0; index < resolution.rings; index += 1) {
    const s = index / (resolution.rings - 1)
    rings.push({ s, shrink: 1, flatten: 1, reach: 0, station: s * CAUDAL_ROOT })
  }
  for (let index = 1; index <= TAIL_BLEND_RINGS; index += 1) {
    const along = index / TAIL_BLEND_RINGS
    // how: Width is given up far faster than height, so the peduncle loses its round section and arrives at the tail as an edge of the same depth the blade starts at.
    rings.push({
      s: 1,
      shrink: 1 - (1 - CAUDAL_BLEND_HEIGHT) * along,
      flatten: Math.max(0.035, (1 - along) ** 2.4),
      reach: -CAUDAL_BLEND * along,
      station: CAUDAL_ROOT + CAUDAL_BLEND * along,
    })
  }
  return rings
}

/**
 * Builds the koi's body shell.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate.
 * @returns The body mesh, in model space scaled to the koi's total length.
 *
 * @example Generating a koi body at half density
 * ```typescript
 * const body = buildBodyMesh(physical, { ...DEFAULT_RESOLUTION, rings: 28, radial: 14 })
 * ```
 */
export function buildBodyMesh(physical: KoiPhysical, resolution: KoiResolution): MeshData {
  const builder = createMeshBuilder()
  const rings = planRings(resolution, physical.head.snout)
  const radial = resolution.radial
  const scale = physical.length
  const grid: number[][] = []

  for (const ring of rings) {
    const row: number[] = []
    for (let step = 0; step <= radial; step += 1) {
      const theta = step / radial
      const point = surfacePoint(physical, ring.s, theta, ring.shrink, ring.flatten)
      const normal = surfaceNormal(physical, ring.s, theta, ring.shrink, ring.flatten)
      // why: The snout cap samples one station over and over, so its rings would all share a normal; leaning them along the axis is what rounds the muzzle instead of flattening it into a disc.
      const lean = ring.s === 0 && ring.shrink < 1 ? Math.sqrt(1 - ring.shrink * ring.shrink) : 0
      const x = normal[0] + lean * 1.4
      const magnitude = Math.hypot(x, normal[1], normal[2]) || 1
      row.push(
        pushVertex(
          builder,
          [(point[0] + ring.reach) * scale, point[1] * scale, point[2] * scale],
          [x / magnitude, normal[1] / magnitude, normal[2] / magnitude],
          [ring.station, theta]
        )
      )
    }
    grid.push(row)
  }

  for (let ring = 0; ring < grid.length - 1; ring += 1) {
    const near = grid[ring]
    const far = grid[ring + 1]
    if (near === undefined || far === undefined) {
      continue
    }
    for (let step = 0; step < radial; step += 1) {
      const a = near[step]
      const b = far[step]
      const c = far[step + 1]
      const d = near[step + 1]
      if (a === undefined || b === undefined || c === undefined || d === undefined) {
        continue
      }
      pushQuad(builder, a, b, c, d)
    }
  }

  return finishMesh(builder)
}
