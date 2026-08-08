/**
 * The engine-neutral mesh the generators emit.
 *
 * Nothing here knows what a renderer is. A mesh is four parallel vertex streams
 * and an index list, which any WebGL layer can upload without translation — the
 * three.js adapter wraps them in buffer attributes, and a future adapter for
 * something else would not have to regenerate a single vertex.
 *
 * The two extra streams beside position and normal are what make the koi
 * deformable and paintable without a texture. `body` gives every vertex its
 * place on the animal — how far along the spine it sits, and where around the
 * body it is — which the vertex shader uses to bend it and the fragment shader
 * uses to paint it. `fin` gives membrane vertices their distance from the fin's
 * root, which is what lets a fin flex instead of hinging.
 */

/** One generated mesh, ready for a renderer to upload. */
export interface MeshData {
  /** Vertex positions in model space, three floats each. */
  positions: Float32Array
  /** Vertex normals, three floats each. */
  normals: Float32Array
  /** Per-vertex `(station, ring)`: position along the deformation curve, then position around the body in turns. */
  body: Float32Array
  /** Per-vertex `(outward, along, side, part)`: how far from a fin's root, how far along it, which flank it hangs on, and which fin it belongs to. */
  fin: Float32Array
  /** Triangle indices. */
  indices: Uint32Array
}

/** A mesh under construction, before its streams are frozen into typed arrays. */
export interface MeshBuilder {
  /** Interleaved positions, three per vertex. */
  positions: number[]
  /** Interleaved normals, three per vertex. */
  normals: number[]
  /** Interleaved body coordinates, two per vertex. */
  body: number[]
  /** Interleaved fin coordinates, four per vertex. */
  fin: number[]
  /** Triangle indices. */
  indices: number[]
}

/**
 * Opens an empty mesh builder.
 *
 * @returns The builder.
 */
export function createMeshBuilder(): MeshBuilder {
  return { positions: [], normals: [], body: [], fin: [], indices: [] }
}

/**
 * Appends one vertex to a builder.
 *
 * @param builder - The mesh under construction.
 * @param position - Model-space position, three components.
 * @param normal - Vertex normal, three components.
 * @param body - Station along the deformation curve, then position around the body in turns.
 * @param fin - How far from a fin's root, how far along it, which flank, and which fin; pass zeros on body vertices.
 * @returns The index the vertex was written at.
 */
export function pushVertex(
  builder: MeshBuilder,
  position: readonly [number, number, number],
  normal: readonly [number, number, number],
  body: readonly [number, number],
  fin: readonly [number, number, number, number] = [0, 0, 0, 0]
): number {
  const index = builder.positions.length / 3
  builder.positions.push(position[0], position[1], position[2])
  builder.normals.push(normal[0], normal[1], normal[2])
  builder.body.push(body[0], body[1])
  builder.fin.push(fin[0], fin[1], fin[2], fin[3])
  return index
}

/**
 * Appends one quad as two triangles, wound counter-clockwise from outside.
 *
 * @param builder - The mesh under construction.
 * @param a - First corner index.
 * @param b - Second corner index.
 * @param c - Third corner index.
 * @param d - Fourth corner index.
 */
export function pushQuad(builder: MeshBuilder, a: number, b: number, c: number, d: number): void {
  builder.indices.push(a, b, c, a, c, d)
}

/**
 * Freezes a builder into typed arrays.
 *
 * @param builder - The finished mesh.
 * @returns The mesh data.
 */
export function finishMesh(builder: MeshBuilder): MeshData {
  return {
    positions: new Float32Array(builder.positions),
    normals: new Float32Array(builder.normals),
    body: new Float32Array(builder.body),
    fin: new Float32Array(builder.fin),
    indices: new Uint32Array(builder.indices),
  }
}

/**
 * Concatenates meshes into one, so parts that share a material share a draw call.
 *
 * @param parts - The meshes to merge, in draw order.
 * @returns One mesh containing every part.
 *
 * @example Collapsing six fins into a single draw
 * ```typescript
 * const fins = mergeMeshes([pectoralLeft, pectoralRight, dorsal, pelvicLeft, pelvicRight, anal])
 * ```
 */
export function mergeMeshes(parts: readonly MeshData[]): MeshData {
  const vertices = parts.reduce((total, part) => total + part.positions.length / 3, 0)
  const triangles = parts.reduce((total, part) => total + part.indices.length, 0)
  const merged: MeshData = {
    positions: new Float32Array(vertices * 3),
    normals: new Float32Array(vertices * 3),
    body: new Float32Array(vertices * 2),
    fin: new Float32Array(vertices * 4),
    indices: new Uint32Array(triangles),
  }
  let vertexOffset = 0
  let indexOffset = 0
  for (const part of parts) {
    merged.positions.set(part.positions, vertexOffset * 3)
    merged.normals.set(part.normals, vertexOffset * 3)
    merged.body.set(part.body, vertexOffset * 2)
    merged.fin.set(part.fin, vertexOffset * 4)
    for (let index = 0; index < part.indices.length; index += 1) {
      merged.indices[indexOffset + index] = (part.indices[index] ?? 0) + vertexOffset
    }
    vertexOffset += part.positions.length / 3
    indexOffset += part.indices.length
  }
  return merged
}

/** An axis-aligned box around a mesh, in model space. */
export interface MeshBounds {
  /** The lowest corner. */
  min: readonly [number, number, number]
  /** The highest corner. */
  max: readonly [number, number, number]
}

/**
 * Measures the axis-aligned box a mesh occupies.
 *
 * @param mesh - The mesh to measure.
 * @returns Its bounds in model space; a zero box when the mesh is empty.
 *
 * @example Framing the development camera on a koi
 * ```typescript
 * const { min, max } = meshBounds(koi.meshes.body)
 * camera.position.setY(max[1] + (max[0] - min[0]) * 1.6)
 * ```
 */
export function meshBounds(mesh: MeshData): MeshBounds {
  if (mesh.positions.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] }
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < mesh.positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = mesh.positions[index + axis] ?? 0
      min[axis] = Math.min(min[axis] ?? 0, value)
      max[axis] = Math.max(max[axis] ?? 0, value)
    }
  }
  return { min, max }
}

/**
 * Counts a mesh's triangles.
 *
 * @param mesh - The mesh to count.
 * @returns How many triangles it draws.
 */
export function meshTriangleCount(mesh: MeshData): number {
  return mesh.indices.length / 3
}
