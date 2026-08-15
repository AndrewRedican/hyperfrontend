/**
 * The koi's fins, as membranes rather than as decoration.
 *
 * Every fin but the tail is built the same way: an arc of root points taken off
 * the body's own surface, and a ray out of each one whose length, curve and rake
 * vary along the arc. Because the roots are read from the skin rather than
 * placed by hand, a fin cannot float off a koi that has been made wider, and it
 * bends with whatever the body underneath it is doing.
 *
 * Each vertex carries how far it sits from its root and how far along the root
 * it is, which is what the renderer's flex term needs: a fin bends over its
 * whole length like a membrane instead of hinging at the base like a flap.
 */
import type { KoiFinShape, KoiPhysical, KoiResolution } from './config.js'
import type { MeshData } from './mesh-data.js'
import { sampleSection } from './anatomy.js'
import { surfaceNormal, surfacePoint } from './body-mesh.js'
import { CAUDAL_BLEND, CAUDAL_BLEND_HEIGHT, CAUDAL_ROOT, PIVOT_STATION } from './config.js'
import { createMeshBuilder, finishMesh, mergeMeshes, pushQuad, pushVertex } from './mesh-data.js'

/** Which fin a membrane vertex belongs to, so one material can flex them differently. */
export const FIN_PART = <const>{
  /** The body itself, which has no membrane to flex; every body vertex reads zero. */
  none: 0,
  /** The paired fins behind the gills. */
  pectoral: 1,
  /** The fin along the back. */
  dorsal: 2,
  /** The paired fins under the belly. */
  pelvic: 3,
  /** The single fin ahead of the tail. */
  anal: 4,
  /** The tail. */
  caudal: 5,
  /** The eyeballs, which are not membranes but share the attribute. */
  eye: 6,
}

/** One of the koi's fins, identified for the renderer's flex uniforms. */
export type FinPart = (typeof FIN_PART)[keyof typeof FIN_PART]

/** How many rays a fin's trailing edge is scalloped between. */
const SCALLOP_RAYS = 5

/**
 * How long a fin's ray is at a point along its root.
 *
 * @param along - Position along the root, 0 at the leading end.
 * @param shape - The fin's own build.
 * @returns The ray's length as a fraction of the fin's span.
 */
function rayReach(along: number, shape: KoiFinShape): number {
  // magic: A sine raised to a low power gives a rounded fan that is longest just past the leading edge, which is the outline a pectoral fin actually cuts.
  const fan = Math.sin(Math.PI * (0.12 + 0.76 * along)) ** 0.62
  // magic: The dorsal and anal fins instead climb out of the back in the first third and trail away to a low rear edge, which is the line that reads as a koi rather than as a sail.
  const trailing = Math.sin(Math.PI * 0.5 * Math.min(1, along * 3.2)) * (1 - along * 0.7)
  const notch = 1 - shape.scallop * 0.09 * (1 - Math.cos(Math.PI * 2 * along * SCALLOP_RAYS)) * 0.5
  return (fan + (trailing - fan) * shape.taper) * notch
}

/** A membrane's grid before it is triangulated. */
type Lattice = (number | undefined)[][]

/**
 * Triangulates a membrane lattice, skipping any degenerate corner.
 *
 * @param builder - The mesh under construction.
 * @param lattice - Vertex indices, addressed as `[along][outward]`.
 */
function stitch(builder: ReturnType<typeof createMeshBuilder>, lattice: Lattice): void {
  for (let along = 0; along < lattice.length - 1; along += 1) {
    const near = lattice[along]
    const far = lattice[along + 1]
    if (near === undefined || far === undefined) {
      continue
    }
    for (let out = 0; out < near.length - 1; out += 1) {
      const a = near[out]
      const b = near[out + 1]
      const c = far[out + 1]
      const d = far[out]
      if (a === undefined || b === undefined || c === undefined || d === undefined) {
        continue
      }
      pushQuad(builder, a, b, c, d)
    }
  }
}

/**
 * Builds one membrane fin off the koi's skin.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate.
 * @param shape - The fin's own build.
 * @param part - Which fin this is.
 * @param side - `1` for the left flank, `-1` for the right, `0` for a midline fin.
 * @returns The fin mesh, in the koi's model space.
 *
 * @example Building the right pectoral
 * ```typescript
 * const fin = buildMembraneFin(physical, resolution, physical.pectoral, FIN_PART.pectoral, -1)
 * ```
 */
export function buildMembraneFin(
  physical: KoiPhysical,
  resolution: KoiResolution,
  shape: KoiFinShape,
  part: FinPart,
  side: -1 | 0 | 1
): MeshData {
  const builder = createMeshBuilder()
  const lattice: Lattice = []
  const girth = side < 0 ? 1 - shape.girth : shape.girth
  const scale = physical.length

  for (let step = 0; step <= resolution.finSegments; step += 1) {
    const along = step / resolution.finSegments
    const station = shape.station + shape.root * along
    const root = surfacePoint(physical, station / CAUDAL_ROOT, girth)
    const normal = surfaceNormal(physical, station / CAUDAL_ROOT, girth)
    const reach = shape.span * rayReach(along, shape)
    // magic: Raking the rear rays harder than the leading one is what gives a fin its swept outline instead of a flat paddle.
    const rake = shape.sweep * Math.PI * 0.5 * (0.5 + 0.5 * along)
    // how: The cup axis is the membrane's own out-of-plane direction — sideways for a fin on the back, up for one on the flank — so one term dishes every fin correctly.
    const cupY = normal[2]
    const cupZ = -normal[1]
    const cupScale = Math.hypot(cupY, cupZ) || 1
    // why: A cross product is a pseudovector, so the cup axis flips the wrong way across the midline; folding the flank in is what keeps the pair mirrored.
    const dish = shape.cup * (side === 0 ? 1 : side) * Math.sin(Math.PI * along) ** 0.7
    const row: (number | undefined)[] = []

    for (let out = 0; out <= resolution.finSpans; out += 1) {
      const outward = out / resolution.finSpans
      // how: Curving the ray progressively rather than tilting it once means the membrane leaves the body perpendicular and only then sweeps back, which is what stops the join reading as a seam.
      const bend = rake * outward
      const distance = reach * outward
      const cup = dish * reach * outward * outward
      const position: [number, number, number] = [
        (root[0] + normal[0] * distance * Math.cos(bend) - distance * Math.sin(bend)) * scale,
        (root[1] + normal[1] * distance * Math.cos(bend) + (cupY / cupScale) * cup) * scale,
        (root[2] + normal[2] * distance * Math.cos(bend) + (cupZ / cupScale) * cup) * scale,
      ]
      row.push(pushVertex(builder, position, normal, [station, girth], [outward, along, side, part]))
    }
    lattice.push(row)
  }

  stitch(builder, lattice)
  const mesh = finishMesh(builder)
  refineMembraneNormals(mesh, resolution.finSegments + 1, resolution.finSpans + 1)
  return mesh
}

/**
 * Replaces a membrane's placeholder normals with ones taken across its own grid.
 *
 * @param mesh - The membrane, whose vertices are laid out row-major along the root.
 * @param rows - How many rows the lattice has.
 * @param columns - How many columns each row has.
 */
function refineMembraneNormals(mesh: MeshData, rows: number, columns: number): void {
  const at = (row: number, column: number, axis: number): number =>
    mesh.positions[(Math.min(rows - 1, Math.max(0, row)) * columns + Math.min(columns - 1, Math.max(0, column))) * 3 + axis] ?? 0
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const alongX = at(row + 1, column, 0) - at(row - 1, column, 0)
      const alongY = at(row + 1, column, 1) - at(row - 1, column, 1)
      const alongZ = at(row + 1, column, 2) - at(row - 1, column, 2)
      const outX = at(row, column + 1, 0) - at(row, column - 1, 0)
      const outY = at(row, column + 1, 1) - at(row, column - 1, 1)
      const outZ = at(row, column + 1, 2) - at(row, column - 1, 2)
      const x = alongY * outZ - alongZ * outY
      const y = alongZ * outX - alongX * outZ
      const z = alongX * outY - alongY * outX
      const magnitude = Math.hypot(x, y, z)
      if (magnitude === 0) {
        continue
      }
      const base = (row * columns + column) * 3
      mesh.normals[base] = x / magnitude
      mesh.normals[base + 1] = y / magnitude
      mesh.normals[base + 2] = z / magnitude
    }
  }
}

/**
 * Builds the tail as a forked blade continuing off the peduncle.
 *
 * The caudal fin's stations run past the body's, so the travelling wave that
 * bends the koi keeps going through the tail instead of stopping at its root.
 * That is what makes the tail push rather than trail.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate.
 * @returns The tail mesh, in the koi's model space.
 */
export function buildCaudalFin(physical: KoiPhysical, resolution: KoiResolution): MeshData {
  const builder = createMeshBuilder()
  const lattice: Lattice = []
  const { caudal } = physical
  const section = sampleSection(physical, 1)
  // why: The blade starts where the peduncle's flesh has finished flattening, not at the profile's last station, so the two meet as one surface instead of overlapping.
  const rootX = PIVOT_STATION - CAUDAL_ROOT - CAUDAL_BLEND
  const topY = (section.rise + section.top * CAUDAL_BLEND_HEIGHT) * CAUDAL_ROOT
  const bottomY = (section.rise - section.bottom * CAUDAL_BLEND_HEIGHT) * CAUDAL_ROOT
  const centreY = (topY + bottomY) * 0.5
  const reachMax = 1 - CAUDAL_ROOT - CAUDAL_BLEND
  const spans = resolution.finSpans * 2
  const segments = Math.max(6, resolution.finSegments * 2)
  const scale = physical.length

  for (let step = 0; step <= spans; step += 1) {
    const across = (step / spans) * 2 - 1
    // magic: Cutting the chord back toward the notch by the fork amount is the whole difference between a koi's flowing tail and a paddle.
    const chord = reachMax * (1 - caudal.fork * (1 - Math.abs(across)) ** 1.6) * (1 - caudal.sweep * 0.35 * (1 - Math.abs(across)))
    const row: (number | undefined)[] = []

    for (let out = 0; out <= segments; out += 1) {
      const outward = out / segments
      const flare = outward ** 0.78
      const rootEdge = bottomY + (topY - bottomY) * ((across + 1) * 0.5)
      const y = rootEdge + (centreY + caudal.span * 0.5 * across - rootEdge) * flare
      const x = rootX - chord * outward
      // why: A slight cupping keeps the two lobes from being coplanar, so the tail catches a highlight even when it is momentarily straight — and the lobes fan sideways off the blade's plane so the fork stays a fork when the pond is watched from straight above, instead of collapsing into an edge-on sliver.
      const z = caudal.thickness * across * (1 - Math.abs(across)) * flare * 2.2 + caudal.spread * 0.5 * across * flare
      // why: The blade's span maps onto one half of the peduncle's ring — dorsal at the upper lobe, ventral at the lower — so the pattern bleeding out of the body arrives on the right lobe.
      row.push(
        pushVertex(
          builder,
          [x * scale, y * scale, z * scale],
          [0, 0, 1],
          [PIVOT_STATION - x, (1 - across) * 0.25],
          [outward, (across + 1) * 0.5, 0, FIN_PART.caudal]
        )
      )
    }
    lattice.push(row)
  }

  stitch(builder, lattice)
  const mesh = finishMesh(builder)
  refineMembraneNormals(mesh, spans + 1, segments + 1)
  return mesh
}

/**
 * Builds every fin the koi wears, merged into one mesh for one draw call.
 *
 * @param physical - The koi's build.
 * @param resolution - How finely to tessellate.
 * @returns One mesh containing the pectorals, pelvics, dorsal, anal and tail.
 *
 * @example Mounting the fins beside the body
 * ```typescript
 * const fins = new Mesh(toBufferGeometry(buildFinSet(physical, resolution)), finMaterial)
 * ```
 */
export function buildFinSet(physical: KoiPhysical, resolution: KoiResolution): MeshData {
  return mergeMeshes([
    buildMembraneFin(physical, resolution, physical.pectoral, FIN_PART.pectoral, 1),
    buildMembraneFin(physical, resolution, physical.pectoral, FIN_PART.pectoral, -1),
    buildMembraneFin(physical, resolution, physical.pelvic, FIN_PART.pelvic, 1),
    buildMembraneFin(physical, resolution, physical.pelvic, FIN_PART.pelvic, -1),
    buildMembraneFin(physical, resolution, physical.dorsal, FIN_PART.dorsal, 0),
    buildMembraneFin(physical, resolution, physical.anal, FIN_PART.anal, 0),
    buildCaudalFin(physical, resolution),
  ])
}
