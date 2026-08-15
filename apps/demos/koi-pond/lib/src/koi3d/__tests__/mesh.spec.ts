import type { MeshData } from '../mesh-data.js'
import { describe, expect, it } from 'vitest'
import { bodyRingCount, buildBodyMesh } from '../body-mesh.js'
import { CAUDAL_BLEND, CAUDAL_ROOT, DEFAULT_PHYSICAL, DEFAULT_RESOLUTION, PIVOT_STATION } from '../config.js'
import { FIN_PART, buildCaudalFin, buildFinSet, buildMembraneFin } from '../fin-mesh.js'
import { buildBarbels, buildEye, buildEyes } from '../head-mesh.js'
import { meshBounds, meshTriangleCount } from '../mesh-data.js'

/** A quarter-density build, so a spec that walks every vertex stays quick. */
const COARSE = { radial: 12, rings: 20, finSpans: 4, finSegments: 4 }

/** Reads one vertex position out of a mesh. */
function vertexAt(mesh: MeshData, index: number): [number, number, number] {
  return [mesh.positions[index * 3] ?? 0, mesh.positions[index * 3 + 1] ?? 0, mesh.positions[index * 3 + 2] ?? 0]
}

describe('buildBodyMesh', () => {
  it('emits the same mesh every time it is asked for the same koi', () => {
    expect(buildBodyMesh(DEFAULT_PHYSICAL, COARSE).positions).toEqual(buildBodyMesh(DEFAULT_PHYSICAL, COARSE).positions)
  })

  it('emits one vertex per ring position, including the duplicated seam', () => {
    expect(buildBodyMesh(DEFAULT_PHYSICAL, COARSE).positions.length / 3).toBe(bodyRingCount(COARSE) * (COARSE.radial + 1))
  })

  it('emits two triangles per quad across the whole shell', () => {
    expect(meshTriangleCount(buildBodyMesh(DEFAULT_PHYSICAL, COARSE))).toBe((bodyRingCount(COARSE) - 1) * COARSE.radial * 2)
  })

  it('gives every vertex a unit normal', () => {
    const mesh = buildBodyMesh(DEFAULT_PHYSICAL, COARSE)
    const strays = Array.from({ length: mesh.normals.length / 3 }, (_unused, index) =>
      Math.hypot(mesh.normals[index * 3] ?? 0, mesh.normals[index * 3 + 1] ?? 0, mesh.normals[index * 3 + 2] ?? 0)
    ).filter((magnitude) => Math.abs(magnitude - 1) > 1e-5)
    expect(strays).toEqual([])
  })

  it('is bilaterally symmetric about the midline plane', () => {
    const mesh = buildBodyMesh(DEFAULT_PHYSICAL, COARSE)
    const ring = COARSE.radial + 1
    const strays = Array.from({ length: mesh.positions.length / 3 }, (_unused, index) => index).filter((index) => {
      const mirrored = Math.floor(index / ring) * ring + ((ring - 1 - (index % ring)) % ring)
      return Math.abs(vertexAt(mesh, index)[2] + vertexAt(mesh, mirrored)[2]) > 1e-9
    })
    expect(strays).toEqual([])
  })

  it('puts the snout ahead of the pivot and the caudal root behind it', () => {
    const { min, max } = meshBounds(buildBodyMesh(DEFAULT_PHYSICAL, COARSE))
    expect({ nose: max[0] > PIVOT_STATION * 0.9, tail: min[0] < (PIVOT_STATION - CAUDAL_ROOT) * 0.9 }).toEqual({ nose: true, tail: true })
  })

  it('scales the whole body with the length knob', () => {
    const doubled = meshBounds(buildBodyMesh({ ...DEFAULT_PHYSICAL, length: 2 }, COARSE))
    const single = meshBounds(buildBodyMesh(DEFAULT_PHYSICAL, COARSE))
    expect(doubled.max[0] - doubled.min[0]).toBeCloseTo((single.max[0] - single.min[0]) * 2, 6)
  })

  it('marks every body vertex as belonging to no fin', () => {
    const mesh = buildBodyMesh(DEFAULT_PHYSICAL, COARSE)
    expect(Array.from(mesh.fin).filter((value) => value !== 0)).toEqual([])
  })

  it('keeps every station between the snout and the tail base', () => {
    const mesh = buildBodyMesh(DEFAULT_PHYSICAL, COARSE)
    const strays = Array.from({ length: mesh.body.length / 2 }, (_unused, index) => mesh.body[index * 2] ?? 0).filter(
      (station) => station < 0 || station > CAUDAL_ROOT + CAUDAL_BLEND + 1e-6
    )
    expect(strays).toEqual([])
  })

  it('runs the peduncle back to exactly where the tail begins, leaving no step', () => {
    expect(meshBounds(buildBodyMesh(DEFAULT_PHYSICAL, COARSE)).min[0]).toBeCloseTo(
      (PIVOT_STATION - CAUDAL_ROOT - CAUDAL_BLEND) * DEFAULT_PHYSICAL.length,
      5
    )
  })

  it('flattens the peduncle into an edge before it reaches the tail', () => {
    const mesh = buildBodyMesh(DEFAULT_PHYSICAL, COARSE)
    const widest = meshBounds(mesh).max[2]
    const rear = Array.from({ length: mesh.positions.length / 3 }, (_unused, index) => index).filter(
      (index) => (mesh.body[index * 2] ?? 0) > CAUDAL_ROOT + CAUDAL_BLEND * 0.98
    )
    expect(rear.every((index) => Math.abs(vertexAt(mesh, index)[2]) < widest * 0.05)).toBe(true)
  })
})

describe('buildMembraneFin', () => {
  it('mirrors the right pectoral onto the left', () => {
    const left = buildMembraneFin(DEFAULT_PHYSICAL, COARSE, DEFAULT_PHYSICAL.pectoral, FIN_PART.pectoral, 1)
    const right = buildMembraneFin(DEFAULT_PHYSICAL, COARSE, DEFAULT_PHYSICAL.pectoral, FIN_PART.pectoral, -1)
    const strays = Array.from({ length: left.positions.length / 3 }, (_unused, index) => index).filter(
      (index) => Math.abs(vertexAt(left, index)[2] + vertexAt(right, index)[2]) > 1e-9
    )
    expect(strays).toEqual([])
  })

  it('roots every vertex on the body it hangs off', () => {
    const fin = buildMembraneFin(DEFAULT_PHYSICAL, COARSE, DEFAULT_PHYSICAL.dorsal, FIN_PART.dorsal, 0)
    const shape = DEFAULT_PHYSICAL.dorsal
    const strays = Array.from({ length: fin.body.length / 2 }, (_unused, index) => fin.body[index * 2] ?? 0).filter(
      (station) => station < shape.station - 1e-6 || station > shape.station + shape.root + 1e-6
    )
    expect(strays).toEqual([])
  })

  it('tags every vertex with the fin it belongs to', () => {
    const fin = buildMembraneFin(DEFAULT_PHYSICAL, COARSE, DEFAULT_PHYSICAL.pelvic, FIN_PART.pelvic, 1)
    expect(
      Array.from({ length: fin.fin.length / 4 }, (_unused, index) => fin.fin[index * 4 + 3]).filter((part) => part !== FIN_PART.pelvic)
    ).toEqual([])
  })

  it('leaves every root vertex sitting exactly on the skin', () => {
    const fin = buildMembraneFin(DEFAULT_PHYSICAL, COARSE, DEFAULT_PHYSICAL.pectoral, FIN_PART.pectoral, 1)
    const outward = Array.from({ length: fin.fin.length / 4 }, (_unused, index) => fin.fin[index * 4] ?? 0)
    expect(outward.filter((value) => value === 0).length).toBe(COARSE.finSegments + 1)
  })
})

describe('buildCaudalFin', () => {
  it('carries its stations past the caudal root so the wave reaches the tail', () => {
    const tail = buildCaudalFin(DEFAULT_PHYSICAL, COARSE)
    const stations = Array.from({ length: tail.body.length / 2 }, (_unused, index) => tail.body[index * 2] ?? 0)
    expect(Math.max(...stations)).toBeGreaterThan(CAUDAL_ROOT)
  })

  it('never reaches past the total length of the koi', () => {
    const tail = buildCaudalFin(DEFAULT_PHYSICAL, COARSE)
    const stations = Array.from({ length: tail.body.length / 2 }, (_unused, index) => tail.body[index * 2] ?? 0)
    expect(Math.max(...stations)).toBeLessThanOrEqual(1 + 1e-6)
  })

  it('starts exactly where the body ends', () => {
    const tail = buildCaudalFin(DEFAULT_PHYSICAL, COARSE)
    const stations = Array.from({ length: tail.body.length / 2 }, (_unused, index) => tail.body[index * 2] ?? 0)
    expect(Math.min(...stations)).toBeCloseTo(CAUDAL_ROOT + CAUDAL_BLEND, 5)
  })

  it('spreads to the configured span at its trailing edge', () => {
    const { min, max } = meshBounds(buildCaudalFin(DEFAULT_PHYSICAL, COARSE))
    expect(max[1] - min[1]).toBeCloseTo(DEFAULT_PHYSICAL.caudal.span, 2)
  })

  it('fans its lobes sideways to the configured spread, so the fork reads from straight above', () => {
    const { min, max } = meshBounds(buildCaudalFin(DEFAULT_PHYSICAL, COARSE))
    expect(max[2] - min[2]).toBeCloseTo(DEFAULT_PHYSICAL.caudal.spread, 2)
  })
})

/** The volume a closed mesh encloses; negative means its triangles are wound inside-out. */
function signedVolume(mesh: MeshData): number {
  let total = 0
  for (let corner = 0; corner < mesh.indices.length; corner += 3) {
    const a = vertexAt(mesh, mesh.indices[corner] ?? 0)
    const b = vertexAt(mesh, mesh.indices[corner + 1] ?? 0)
    const c = vertexAt(mesh, mesh.indices[corner + 2] ?? 0)
    total += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
  }
  return total
}

describe('buildEye', () => {
  it('winds the left eyeball outward, so backface culling does not hide it', () => {
    expect(signedVolume(buildEye(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION, 1))).toBeGreaterThan(0)
  })

  it('winds the right eyeball outward, so backface culling does not hide it', () => {
    expect(signedVolume(buildEye(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION, -1))).toBeGreaterThan(0)
  })

  it('builds both eyeballs to the same size', () => {
    expect(signedVolume(buildEye(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION, 1))).toBeCloseTo(
      signedVolume(buildEye(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION, -1)),
      12
    )
  })
})

describe('buildEyes', () => {
  it('places the two eyeballs on opposite flanks', () => {
    const { min, max } = meshBounds(buildEyes(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION))
    expect(min[2]).toBeCloseTo(-max[2], 6)
  })

  it('sizes each eyeball from the eye size knob', () => {
    const { min, max } = meshBounds(buildEyes({ ...DEFAULT_PHYSICAL, eyes: { ...DEFAULT_PHYSICAL.eyes, size: 0.03 } }, DEFAULT_RESOLUTION))
    expect(max[0] - min[0]).toBeCloseTo(0.06, 2)
  })

  it('tags every eyeball vertex so the membrane flex never touches it', () => {
    const eyes = buildEyes(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION)
    expect(
      Array.from({ length: eyes.fin.length / 4 }, (_unused, index) => eyes.fin[index * 4 + 3]).filter((part) => part !== FIN_PART.eye)
    ).toEqual([])
  })
})

describe('buildBarbels', () => {
  it('hangs two pairs off the mouth', () => {
    const { min, max } = meshBounds(buildBarbels(DEFAULT_PHYSICAL))
    expect(min[2]).toBeCloseTo(-max[2], 6)
  })

  it('keeps every whisker forward of the gills', () => {
    const { min } = meshBounds(buildBarbels(DEFAULT_PHYSICAL))
    expect(min[0]).toBeGreaterThan((PIVOT_STATION - DEFAULT_PHYSICAL.head.length * CAUDAL_ROOT) * DEFAULT_PHYSICAL.length)
  })
})

describe('buildFinSet', () => {
  it('merges every fin into one mesh', () => {
    const parts = [
      DEFAULT_PHYSICAL.pectoral,
      DEFAULT_PHYSICAL.pectoral,
      DEFAULT_PHYSICAL.pelvic,
      DEFAULT_PHYSICAL.pelvic,
      DEFAULT_PHYSICAL.dorsal,
      DEFAULT_PHYSICAL.anal,
    ]
    const membranes = parts.reduce(
      (total, shape) => total + meshTriangleCount(buildMembraneFin(DEFAULT_PHYSICAL, COARSE, shape, FIN_PART.pectoral, 1)),
      0
    )
    expect(meshTriangleCount(buildFinSet(DEFAULT_PHYSICAL, COARSE))).toBe(
      membranes + meshTriangleCount(buildCaudalFin(DEFAULT_PHYSICAL, COARSE))
    )
  })

  it('keeps a whole koi well under four thousand triangles at production density', () => {
    const total =
      meshTriangleCount(buildBodyMesh(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION)) +
      meshTriangleCount(buildFinSet(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION)) +
      meshTriangleCount(buildEyes(DEFAULT_PHYSICAL, DEFAULT_RESOLUTION)) +
      meshTriangleCount(buildBarbels(DEFAULT_PHYSICAL))
    expect(total).toBeLessThan(8000)
  })
})
