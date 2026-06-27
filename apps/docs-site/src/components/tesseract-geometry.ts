/** A point in 4D space; each coordinate is one of the tesseract's two extents. */
export interface Vertex4D {
  /** Position along the first spatial axis (−1 or +1). */
  x: number
  /** Position along the second spatial axis (−1 or +1). */
  y: number
  /** Position along the third spatial axis (−1 or +1). */
  z: number
  /** Position along the fourth (ana–kata) axis (−1 or +1). */
  w: number
}

/** A point in 3D space — a tunnel cube corner, or a vertex after rotation. */
export interface Point3D {
  /** Horizontal position before screen projection. */
  x: number
  /** Vertical position before screen projection. */
  y: number
  /** Depth toward the viewer before projection. */
  z: number
}

/** A screen-space point in CSS pixels. */
export interface Point2D {
  /** Horizontal canvas coordinate. */
  x: number
  /** Vertical canvas coordinate. */
  y: number
}

/** A vertex after projection, retaining the data shading and fade need. */
export interface ProjectedVertex {
  /** Screen-space horizontal pixel after projection. */
  x: number
  /** Screen-space vertical pixel after projection. */
  y: number
  /** Pre-projection model-space x, kept for face-normal lighting. */
  x3: number
  /** Pre-projection model-space y, kept for face-normal lighting. */
  y3: number
  /** Pre-projection model-space z, kept for face-normal lighting. */
  z3: number
  /** Normalised camera depth driving the per-vertex alpha falloff. */
  depth: number
  /** Edge-proximity multiplier that dims vertices near the canvas border. */
  fade: number
}

/** Per-theme RGB triples (as `r, g, b` strings) for the structure's strokes. */
export interface Palette {
  /** RGB triple for resting edge strokes. */
  line: string
  /** RGB triple for cursor-highlighted edge strokes. */
  lineHi: string
  /** RGB triple for resting vertex dots. */
  node: string
  /** RGB triple for cursor-highlighted vertex dots. */
  nodeHi: string
}

/**
 * A falling purple-rain droplet with an angled, speed-varied trajectory and fading tail.
 * While `onSurface`, each frame rolls `splashP` — a per-traversal chance divided across the
 * frames the drop spends crossing a facet — so its one splash lands anywhere along the
 * surface rather than firing at the entry edge.
 */
export interface RainDrop {
  /** Current head x in screen pixels. */
  x: number
  /** Current head y in screen pixels. */
  y: number
  /** Horizontal drift velocity per frame. */
  vx: number
  /** Vertical fall velocity per frame. */
  vy: number
  /** Streak length as a multiple of the per-frame step. */
  tail: number
  /** Base opacity, skewed toward faint drops. */
  alpha: number
  /** Whether the head currently overlaps a landing facet. */
  onSurface: boolean
  /** Per-frame splash probability for the current traversal. */
  splashP: number
  /** True when drawn in front of the lattice, false when behind it. */
  front: boolean
}

/** A projected landscape (wide-trapezoid) facet rain can land on, weighted by how strongly the top light hits it. */
export interface TopFace {
  /** The four screen-space corners of the landing facet. */
  poly: Array<Point2D>
  /** How strongly the top light hits it, used as the splash-strength weight. */
  upness: number
}

/**
 * A short-lived purple highlight where a droplet struck a facet. It traces the
 * surface as an oriented ellipse (`angle`, `rx`, `ry`), leans into the impact
 * direction (`ix`, `iy`) rather than a uniform circle, and is clipped to the
 * snapshot of the contacted facet (`poly`) so it never spills past the edges.
 */
export interface Splash {
  /** Impact x in screen pixels. */
  x: number
  /** Impact y in screen pixels. */
  y: number
  /** Remaining life from 1 (fresh) down to 0 (gone). */
  life: number
  /** Semi-major bloom radius along the facet. */
  rx: number
  /** Semi-minor bloom radius across the facet. */
  ry: number
  /** Orientation of the bloom, aligned to the facet's long edge. */
  angle: number
  /** Unit impact-direction x the bloom leans toward. */
  ix: number
  /** Unit impact-direction y the bloom leans toward. */
  iy: number
  /** Peak brightness at the moment of impact. */
  strength: number
  /** Snapshot of the facet corners, clipping the bloom to the surface. */
  poly: Array<Point2D>
}

export const darkPalette: Palette = { line: '34, 211, 238', lineHi: '103, 232, 249', node: '34, 211, 238', nodeHi: '165, 243, 252' }
export const lightPalette: Palette = { line: '37, 99, 235', lineHi: '29, 78, 216', node: '37, 99, 235', nodeHi: '29, 78, 216' }

// why: shared camera distances for the static (non-dive) tesseract's 4D→3D and 3D→2D perspective divides.
export const CAMERA_4D = 2.2
export const CAMERA_3D = 2.4

// why: the dive is an *exact* infinite tunnel — a chain of cubes where each cell's inner cube IS the next cell's outer cube. Only one representation of each shared boundary exists, so consecutive cells can never drift apart however the structure rotates. This replaces the old "overlapping scaled copies" model, which could only approximate the seam: the inner and outer cells of a rotating tesseract shear differently under perspective, so no single scale or rotation aligns them.
// why: two adjacent cubes differing in scale by TUNNEL_RATIO are exactly the outer and inner cells of one genuine tesseract under a 4D perspective camera at CAMERA_4D, so the tunnel is a true Schlegel chain rather than a stylised stack.
export const TUNNEL_RATIO = (CAMERA_4D + 1) / (CAMERA_4D - 1)
// why: per-level twist (radians) between consecutive cubes reproduces the way a 4D rotation shears a tesseract's inner cell relative to its outer cell — the characteristic hypercube morph, expressed as a continuous spiral down the tunnel.
export const TUNNEL_TWIST = 0.42
// why: the cube-level depth `f = phase - level` is rendered across this window. Below F_MIN a cube is an imperceptible speck at the vanishing point; above F_MAX it has grown past the viewport. Cubes fade in/out over FADE_SPAN at each end so none ever pops in or out.
export const TUNNEL_F_MIN = -6
export const TUNNEL_F_MAX = 2
export const TUNNEL_FADE_SPAN = 1.2

// why: ~30% chance a drop splashes somewhere across a facet it crosses, spread over the traversal rather than a single roll at the entry edge; divided per-frame in processHits so the splash point varies along the surface.
export const SPLASH_CHANCE = 0.3
// why: cap concurrent splashes so a dense shower never floods the canvas.
export const MAX_SPLASHES = 30
// why: total drop speed the splash amplitude scales around — faster drops bloom wider, slower drips smaller.
export const NOMINAL_RAIN_SPEED = 3.3

// why: the 16 corners of a tesseract are every combination of ±1 across four axes.
export const vertices4D: Array<Vertex4D> = []
for (let x = -1; x <= 1; x += 2) {
  for (let y = -1; y <= 1; y += 2) {
    for (let z = -1; z <= 1; z += 2) {
      for (let w = -1; w <= 1; w += 2) {
        vertices4D.push({ x, y, z, w })
      }
    }
  }
}

// why: two corners share an edge when exactly one of their four coordinates differs.
export const edges: Array<[number, number]> = []
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    let diff = 0
    if (vertices4D[i].x !== vertices4D[j].x) diff++
    if (vertices4D[i].y !== vertices4D[j].y) diff++
    if (vertices4D[i].z !== vertices4D[j].z) diff++
    if (vertices4D[i].w !== vertices4D[j].w) diff++
    if (diff === 1) edges.push([i, j])
  }
}

/**
 * Counts how many of the four spatial axes take both extents across a quad of
 * vertices. A genuine square facet of the tesseract varies in exactly two axes.
 *
 * @param a First vertex of the quad.
 * @param b Second vertex of the quad.
 * @param c Third vertex of the quad.
 * @param d Fourth vertex of the quad.
 * @returns The number of axes (0-4) that fluctuate across the quad.
 */
function varyingAxes(a: Vertex4D, b: Vertex4D, c: Vertex4D, d: Vertex4D): number {
  let varying = 0
  if (!(a.x === b.x && b.x === c.x && c.x === d.x)) varying++
  if (!(a.y === b.y && b.y === c.y && c.y === d.y)) varying++
  if (!(a.z === b.z && b.z === c.z && c.z === d.z)) varying++
  if (!(a.w === b.w && b.w === c.w && c.w === d.w)) varying++
  return varying
}

// why: the 24 square facets are quads of corners that span exactly two axes.
export const faces: Array<[number, number, number, number]> = []
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    for (let k = j + 1; k < 16; k++) {
      for (let l = k + 1; l < 16; l++) {
        if (varyingAxes(vertices4D[i], vertices4D[j], vertices4D[k], vertices4D[l]) === 2) {
          // note: ordering as i,j,l,k yields a non-self-intersecting winding for fill.
          faces.push([i, j, l, k])
        }
      }
    }
  }
}

// how: the unit cube every tunnel level instantiates — 8 corners, 12 edges, 6 quad faces.
export const cubeVertices3D: Array<Point3D> = []
for (let x = -1; x <= 1; x += 2) {
  for (let y = -1; y <= 1; y += 2) {
    for (let z = -1; z <= 1; z += 2) {
      cubeVertices3D.push({ x, y, z })
    }
  }
}

// why: two corners share an edge when exactly one of their three coordinates differs.
export const cubeEdges: Array<[number, number]> = []
for (let i = 0; i < 8; i++) {
  for (let j = i + 1; j < 8; j++) {
    let diff = 0
    if (cubeVertices3D[i].x !== cubeVertices3D[j].x) diff++
    if (cubeVertices3D[i].y !== cubeVertices3D[j].y) diff++
    if (cubeVertices3D[i].z !== cubeVertices3D[j].z) diff++
    if (diff === 1) cubeEdges.push([i, j])
  }
}

// note: with index = (x+1)·2 + (y+1) + (z+1)/2, these windings trace each face without self-intersection.
export const cubeFaces: Array<[number, number, number, number]> = [
  [0, 1, 3, 2],
  [4, 5, 7, 6],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 3, 7, 5],
]
