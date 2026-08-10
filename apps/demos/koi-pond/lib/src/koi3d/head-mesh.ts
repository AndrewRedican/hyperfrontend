/**
 * The two pieces of the head that are not skin: the eyes and the barbels.
 *
 * The eyes are real geometry rather than a painted disc. They sit in the sockets
 * the body's own surface bulges around, half sunk into the skin, so from above a
 * koi shows two of them standing proud on opposite sides of the skull — which is
 * the single detail that decides whether a fish seen from overhead reads as an
 * animal or as a shape.
 *
 * The barbels are four tapered whiskers off the mouth. They cost almost nothing
 * and they are the feature that says *koi* rather than *fish* at an oblique
 * angle.
 */
import type { KoiPhysical, KoiResolution } from './config.js'
import type { MeshData } from './mesh-data.js'
import { eyeTheta, surfaceNormal, surfacePoint } from './body-mesh.js'
import { CAUDAL_ROOT } from './config.js'
import { FIN_PART } from './fin-mesh.js'
import { createMeshBuilder, finishMesh, mergeMeshes, pushQuad, pushVertex } from './mesh-data.js'

/** Where the two pairs of barbels leave the mouth: station along the body, then position around it. */
const BARBEL_ROOTS: readonly { station: number; girth: number; length: number; droop: number }[] = [
  { station: 0.024, girth: 0.375, length: 0.019, droop: 0.75 },
  { station: 0.052, girth: 0.41, length: 0.032, droop: 0.95 },
]

/**
 * Builds one eyeball as a sphere half sunk into the head.
 *
 * The vertex normals double as the sphere's own local directions, which is how
 * the eye material finds the iris and the pupil without a texture or a second
 * attribute.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate; the eye takes a fraction of the body's density.
 * @param side - `1` for the left eye, `-1` for the right.
 * @returns The eyeball mesh, in the koi's model space.
 */
export function buildEye(physical: KoiPhysical, resolution: KoiResolution, side: 1 | -1): MeshData {
  const builder = createMeshBuilder()
  const { eyes } = physical
  const theta = side > 0 ? eyeTheta(physical) : 1 - eyeTheta(physical)
  const station = eyes.station
  const anchor = surfacePoint(physical, station / CAUDAL_ROOT, theta)
  const normal = surfaceNormal(physical, station / CAUDAL_ROOT, theta)
  const radius = eyes.size
  // why: The spacing knob slides the eyeballs along their own outward normals, so widening them keeps both sockets symmetrical instead of drifting one off the skull.
  const seat = (eyes.protrusion - 1) * radius * eyes.spacing
  const centre: [number, number, number] = [anchor[0] + normal[0] * seat, anchor[1] + normal[1] * seat, anchor[2] + normal[2] * seat]
  const rings = Math.max(6, Math.round(resolution.radial * 0.42))
  const segments = Math.max(8, Math.round(resolution.radial * 0.55))
  const scale = physical.length
  const grid: number[][] = []

  for (let ring = 0; ring <= rings; ring += 1) {
    const polar = (ring / rings) * Math.PI
    const row: number[] = []
    for (let step = 0; step <= segments; step += 1) {
      const azimuth = (step / segments) * Math.PI * 2
      // how: The sphere is laid out around the socket's own outward normal, so its pole points where the koi is looking rather than along a world axis.
      const local: [number, number, number] = [Math.cos(polar), Math.sin(polar) * Math.cos(azimuth), Math.sin(polar) * Math.sin(azimuth)]
      const direction = orientToNormal(local, normal)
      row.push(
        pushVertex(
          builder,
          [
            (centre[0] + direction[0] * radius) * scale,
            (centre[1] + direction[1] * radius) * scale,
            (centre[2] + direction[2] * radius) * scale,
          ],
          direction,
          [station, theta],
          [local[0], local[1], side, FIN_PART.eye]
        )
      )
    }
    grid.push(row)
  }

  for (let ring = 0; ring < rings; ring += 1) {
    const near = grid[ring]
    const far = grid[ring + 1]
    if (near === undefined || far === undefined) {
      continue
    }
    for (let step = 0; step < segments; step += 1) {
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

/**
 * Rotates a local direction so its pole lands on a surface normal.
 *
 * The frame is right-handed on both flanks. Mirroring it for the right eye — as
 * an earlier version did, to keep the gaze axis pointing forward — flipped that
 * eyeball's winding, and backface culling then hid it inside the head from every
 * angle but directly above. The gaze axis does not need the mirror: it rides the
 * second frame axis, which is derived from the model's own forward direction and
 * is already the same on both sides.
 *
 * @param local - The direction in the sphere's own frame, pole first.
 * @param normal - The outward normal the pole should point along.
 * @returns The rotated unit direction.
 */
function orientToNormal(local: readonly [number, number, number], normal: readonly [number, number, number]): [number, number, number] {
  // how: The forward axis is whatever is left of +X after the normal is taken out of it, which keeps the eye's frame stable as the socket moves around the skull.
  const dot = normal[0]
  const forwardX = 1 - normal[0] * dot
  const forwardY = -normal[1] * dot
  const forwardZ = -normal[2] * dot
  const magnitude = Math.hypot(forwardX, forwardY, forwardZ) || 1
  const ax = forwardX / magnitude
  const ay = forwardY / magnitude
  const az = forwardZ / magnitude
  const bx = normal[1] * az - normal[2] * ay
  const by = normal[2] * ax - normal[0] * az
  const bz = normal[0] * ay - normal[1] * ax
  return [
    normal[0] * local[0] + ax * local[1] + bx * local[2],
    normal[1] * local[0] + ay * local[1] + by * local[2],
    normal[2] * local[0] + az * local[1] + bz * local[2],
  ]
}

/**
 * Builds one barbel as a tapered whisker curving back off the mouth.
 *
 * @param physical - The koi's build.
 * @param root - Which of the two pairs this barbel belongs to.
 * @param side - `1` for the left flank, `-1` for the right.
 * @returns The barbel mesh, in the koi's model space.
 */
function buildBarbel(physical: KoiPhysical, root: (typeof BARBEL_ROOTS)[number], side: 1 | -1): MeshData {
  const builder = createMeshBuilder()
  const theta = side > 0 ? root.girth : 1 - root.girth
  const anchor = surfacePoint(physical, root.station / CAUDAL_ROOT, theta)
  const normal = surfaceNormal(physical, root.station / CAUDAL_ROOT, theta)
  const segments = 7
  const radial = 5
  const scale = physical.length
  const grid: number[][] = []

  for (let step = 0; step <= segments; step += 1) {
    const along = step / segments
    // magic: A barbel leaves the lip outward then falls away and back, so the curve is the normal early and gravity-and-drag late.
    const drop = root.droop * along * along
    const centre: [number, number, number] = [
      anchor[0] + normal[0] * root.length * along * 0.35 - root.length * along * along * 1.15,
      anchor[1] + normal[1] * root.length * along * 0.35 - root.length * drop * 0.95,
      anchor[2] + normal[2] * root.length * along * 0.72,
    ]
    const radius = 0.0024 * (1 - along * 0.85) * (0.6 + physical.head.snout * 0.7)
    const row: number[] = []
    for (let ring = 0; ring <= radial; ring += 1) {
      const angle = (ring / radial) * Math.PI * 2
      const offsetY = Math.cos(angle) * radius
      const offsetZ = Math.sin(angle) * radius
      row.push(
        pushVertex(
          builder,
          [centre[0] * scale, (centre[1] + offsetY) * scale, (centre[2] + offsetZ) * scale],
          [0, Math.cos(angle), Math.sin(angle)],
          [root.station, theta]
        )
      )
    }
    grid.push(row)
  }

  for (let step = 0; step < segments; step += 1) {
    const near = grid[step]
    const far = grid[step + 1]
    if (near === undefined || far === undefined) {
      continue
    }
    for (let ring = 0; ring < radial; ring += 1) {
      const a = near[ring]
      const b = far[ring]
      const c = far[ring + 1]
      const d = near[ring + 1]
      if (a === undefined || b === undefined || c === undefined || d === undefined) {
        continue
      }
      pushQuad(builder, a, b, c, d)
    }
  }

  return finishMesh(builder)
}

/**
 * Builds all four barbels, merged so they draw with the body's skin.
 *
 * @param physical - The koi's build.
 * @returns One mesh containing both pairs.
 *
 * @example Drawing the barbels in the body's own material
 * ```typescript
 * const skin = mergeMeshes([buildBodyMesh(physical, resolution), buildBarbels(physical)])
 * ```
 */
export function buildBarbels(physical: KoiPhysical): MeshData {
  return mergeMeshes(BARBEL_ROOTS.flatMap((root) => [buildBarbel(physical, root, 1), buildBarbel(physical, root, -1)]))
}

/**
 * Builds both eyes, merged so the pair draws once.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate.
 * @returns One mesh containing both eyeballs.
 */
export function buildEyes(physical: KoiPhysical, resolution: KoiResolution): MeshData {
  return mergeMeshes([buildEye(physical, resolution, 1), buildEye(physical, resolution, -1)])
}
