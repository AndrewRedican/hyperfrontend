import type { KoiSwimState, MeshData } from '@hyperfrontend/demo-koi-lib'
import {
  bodyRingCount,
  buildBodyMesh,
  buildFinSet,
  CAUDAL_ROOT,
  createSwimState,
  DEFAULT_PHYSICAL,
  evaluateSpine,
  eyeTheta,
  PIVOT_STATION,
  SPINE_SAMPLES,
  surfacePoint,
} from '@hyperfrontend/demo-koi-lib'
import { cos, floor, max, min, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createFloat32Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * How finely the sketch samples the koi's build: far below the pond's own
 * tessellation, because a sketch is a few confident lines, not a surface.
 */
const RESOLUTION = { radial: 16, rings: 16, finSpans: 3, finSegments: 4 }

/** Every second ring of the body is drawn; the rest only carry the longitudinal lines. */
const RING_STRIDE = 2

/** Columns of the body grid drawn nose to tail: the dorsal line, each flank, and the belly, at quarter turns of sixteen. */
const LONGITUDES: readonly number[] = [0, 4, 8, 12]

/** How far the view leans off straight down, in radians, so the dorsal fin and the back's ridge are part of the silhouette. */
const LEAN = (24 * PI) / 180

/** Cosine and sine of the lean, precomputed. */
const LEAN_COS = cos(LEAN)
const LEAN_SIN = sin(LEAN)

/** The koi's build, which the sketch never varies: one fish, always the same fish. */
const PHYSICAL = DEFAULT_PHYSICAL

/** Radius of an eye, as a fraction of the koi's length. */
const EYE_RADIUS = PHYSICAL.eyes.size

/** The colour and presence one drawing of the koi is made with. */
export interface KoiSketchStyle {
  /** The `r g b` triple every line is drawn in; the strokes differ only in how much of it they carry */
  color: string
  /** How present the whole drawing is, 0 to 1 */
  alpha: number
}

/** A posed koi, ready to draw anywhere on a canvas. */
export interface KoiSketch {
  /**
   * Advance the swim and re-pose the body.
   *
   * @param dt - Seconds since the previous frame
   * @param speed - How fast the koi is swimming, in body lengths per second
   * @param turnRate - How fast it is turning, in radians per second; positive turns toward its right flank
   */
  advance(dt: number, speed: number, turnRate: number): void
  /**
   * Draw the posed koi.
   *
   * @param ctx - The canvas to draw on
   * @param x - Where the koi's pivot sits, in canvas pixels
   * @param y - Where the koi's pivot sits, in canvas pixels
   * @param heading - Which way the nose points, in radians, 0 to the right
   * @param length - Nose-to-tail length in canvas pixels
   * @param style - The colours and presence to draw with
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, length: number, style: KoiSketchStyle): void
}

/** A run of vertices joined by lines. */
interface Stroke {
  /** Vertex indices, in order */
  indices: readonly number[]
  /** Which weight the run is drawn at */
  weight: 'ring' | 'line' | 'fin'
}

/**
 * The unique edges of a mesh's quads, as pairs of vertex indices.
 *
 * The generators push every quad as two triangles that share a diagonal, so
 * walking the index list six at a time recovers the quads, and only their
 * four outer edges are kept: a sketch of a fin is its rays and its arcs, not
 * a triangulation of its membrane.
 *
 * @param mesh - The mesh to read
 * @param base - What to add to every index, for a mesh appended after another
 * @returns The edges, two indices each
 */
function quadEdges(mesh: MeshData, base: number): number[] {
  const seen = createSet<number>()
  const edges: number[] = []
  const take = (from: number, to: number) => {
    const low = min(from, to)
    const high = max(from, to)
    const key = low * 1_000_000 + high
    if (seen.has(key)) return
    seen.add(key)
    edges.push(low + base, high + base)
  }
  for (let at = 0; at + 5 < mesh.indices.length; at += 6) {
    const a = mesh.indices[at] ?? 0
    const b = mesh.indices[at + 1] ?? 0
    const c = mesh.indices[at + 2] ?? 0
    const d = mesh.indices[at + 5] ?? 0
    take(a, b)
    take(b, c)
    take(c, d)
    take(d, a)
  }
  return edges
}

/**
 * Build the sketch: the koi's rest geometry, reduced to the lines a drawing
 * needs, and the swimming state that poses it.
 *
 * The body is the lofted shell the pond's koi is skinned over, sampled coarsely
 * and drawn as its cross-section rings and four lines nose to tail; the fins
 * are the same membranes, drawn as their lattice; the spine is the posed
 * centreline itself. Posing bends every point along the spine exactly as the
 * pond's vertex program does, one interpolation and one rotation each, so the
 * sketch moves the way the rendered fish moves.
 *
 * @returns The sketch, holding still until it is advanced
 */
export function createKoiSketch(): KoiSketch {
  const body = buildBodyMesh(PHYSICAL, RESOLUTION)
  const fins = buildFinSet(PHYSICAL, RESOLUTION)
  const bodyCount = body.positions.length / 3
  const finCount = fins.positions.length / 3
  const eyeStation = PHYSICAL.eyes.station
  const leftEye = surfacePoint(PHYSICAL, eyeStation / CAUDAL_ROOT, eyeTheta(PHYSICAL))
  const rightEye = surfacePoint(PHYSICAL, eyeStation / CAUDAL_ROOT, 1 - eyeTheta(PHYSICAL))
  const count = bodyCount + finCount + 2

  const rest = createFloat32Array(count * 3)
  const stations = createFloat32Array(count)
  rest.set(body.positions, 0)
  rest.set(fins.positions, bodyCount * 3)
  rest.set(leftEye, (bodyCount + finCount) * 3)
  rest.set(rightEye, (bodyCount + finCount + 1) * 3)
  for (let index = 0; index < bodyCount; index += 1) stations[index] = body.body[index * 2] ?? 0
  for (let index = 0; index < finCount; index += 1) stations[bodyCount + index] = fins.body[index * 2] ?? 0
  stations[bodyCount + finCount] = eyeStation
  stations[bodyCount + finCount + 1] = eyeStation

  const columns = RESOLUTION.radial + 1
  const rows = bodyRingCount(RESOLUTION)
  const strokes: Stroke[] = []
  for (let row = 0; row < rows; row += RING_STRIDE) {
    const indices: number[] = []
    for (let column = 0; column < columns; column += 1) indices.push(row * columns + column)
    strokes.push({ indices, weight: 'ring' })
  }
  for (const column of LONGITUDES) {
    const indices: number[] = []
    for (let row = 0; row < rows; row += 1) indices.push(row * columns + column)
    strokes.push({ indices, weight: 'line' })
  }
  const finEdges = quadEdges(fins, bodyCount)

  const screen = createFloat32Array(count * 2)
  const spineScreen = createFloat32Array(SPINE_SAMPLES * 2)
  const swim: KoiSwimState = createSwimState({ speed: 0.55 })

  /**
   * Project a posed model-space point onto the drawing plane.
   *
   * @param x - Along the body
   * @param y - Dorsal
   * @param z - Lateral
   * @param out - Where to write
   * @param at - Index of the point in `out`
   */
  const project = (x: number, y: number, z: number, out: Float32Array, at: number) => {
    out[at * 2] = x
    out[at * 2 + 1] = z * LEAN_COS - y * LEAN_SIN
  }

  const pose = () => {
    const spine = evaluateSpine(1, swim.swim, swim.phase)
    const stationsPosed = spine.stations
    for (let index = 0; index < SPINE_SAMPLES; index += 1) {
      const station = stationsPosed[index]
      if (station) project(station.position[0], station.position[1], station.position[2], spineScreen, index)
    }
    const last = SPINE_SAMPLES - 1
    for (let index = 0; index < count; index += 1) {
      const station = stations[index] ?? 0
      const scaled = min(1, max(0, station)) * last
      const near = floor(scaled)
      const far = min(near + 1, last)
      const blend = scaled - near
      const a = stationsPosed[near]
      const b = stationsPosed[far]
      if (!a || !b) continue
      const cx = a.position[0] + (b.position[0] - a.position[0]) * blend
      const cy = a.position[1] + (b.position[1] - a.position[1]) * blend
      const cz = a.position[2] + (b.position[2] - a.position[2]) * blend
      const yaw = a.yaw + (b.yaw - a.yaw) * blend
      const roll = a.roll + (b.roll - a.roll) * blend
      const pitch = a.pitch + (b.pitch - a.pitch) * blend
      // how: the rest vertex is read as an offset from its own station's centre, then carried rigidly by that station's frame: roll, then pitch, then yaw, exactly as the pond's vertex program composes them
      const lx = (rest[index * 3] ?? 0) - (PIVOT_STATION - station)
      const ly = rest[index * 3 + 1] ?? 0
      const lz = rest[index * 3 + 2] ?? 0
      const cr = cos(roll)
      const sr = sin(roll)
      const ry = cr * ly - sr * lz
      const rz = sr * ly + cr * lz
      const cp = cos(pitch)
      const sp = sin(pitch)
      const px = cp * lx - sp * ry
      const py = sp * lx + cp * ry
      const cy2 = cos(yaw)
      const sy = sin(yaw)
      const wx = cy2 * px - sy * rz
      const wz = sy * px + cy2 * rz
      project(cx + wx, cy + py, cz + wz, screen, index)
    }
  }
  pose()

  return {
    advance(dt, speed, turnRate) {
      swim.setMotion({ speed, turnRate })
      swim.advance(dt)
      pose()
    },
    draw(ctx, x, y, heading, length, style) {
      const ch = cos(heading)
      const sh = sin(heading)
      const place = (source: Float32Array, index: number): [number, number] => {
        const sx = (source[index * 2] ?? 0) * length
        const sy = (source[index * 2 + 1] ?? 0) * length
        return [x + sx * ch - sy * sh, y + sx * sh + sy * ch]
      }
      const strokeRun = (source: Float32Array, indices: readonly number[]) => {
        ctx.beginPath()
        indices.forEach((index, at) => {
          const [px, py] = place(source, index)
          if (at === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }
      ctx.save()
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = `rgb(${style.color} / ${(0.22 * style.alpha).toFixed(3)})`
      for (const stroke of strokes) if (stroke.weight === 'ring') strokeRun(screen, stroke.indices)
      ctx.strokeStyle = `rgb(${style.color} / ${(0.26 * style.alpha).toFixed(3)})`
      ctx.beginPath()
      for (let at = 0; at + 1 < finEdges.length; at += 2) {
        const [ax, ay] = place(screen, finEdges[at] ?? 0)
        const [bx, by] = place(screen, finEdges[at + 1] ?? 0)
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
      }
      ctx.stroke()
      ctx.strokeStyle = `rgb(${style.color} / ${(0.38 * style.alpha).toFixed(3)})`
      for (const stroke of strokes) if (stroke.weight === 'line') strokeRun(screen, stroke.indices)
      // why: the centreline was drawn as the one heavy stroke, and it read as a bright rod through the body; at the eyes' weight plus a touch it is still the spine, without being the first thing seen
      ctx.strokeStyle = `rgb(${style.color} / ${(0.3 * style.alpha).toFixed(3)})`
      const spineIndices: number[] = []
      for (let index = 0; index < SPINE_SAMPLES; index += 1) spineIndices.push(index)
      strokeRun(spineScreen, spineIndices)
      // why: a filled eye is the one solid mark on a drawing made of hairlines, and the pair read as two bright dots; outlined at the rings' weight they stay eyes without pulling the gaze
      ctx.strokeStyle = `rgb(${style.color} / ${(0.22 * style.alpha).toFixed(3)})`
      for (const eye of [count - 2, count - 1]) {
        const [ex, ey] = place(screen, eye)
        ctx.beginPath()
        ctx.arc(ex, ey, EYE_RADIUS * length, 0, PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    },
  }
}
