/**
 * Uploading a generated mesh to three.js, and nothing else.
 *
 * This is the entire width of the coupling between the koi's geometry and its
 * renderer. Everything upstream of here is typed arrays and arithmetic; swapping
 * three.js for something else would mean rewriting this file and no other.
 */
import type { MeshData } from '../koi3d/mesh-data.js'
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three'
import { meshBounds } from '../koi3d/mesh-data.js'

/**
 * How far the culling sphere is grown past the rest mesh.
 *
 * The koi is bent on the GPU, so the CPU never sees where its vertices actually
 * end up. Without slack, a koi curled into a hard turn culls itself off screen.
 */
const CULLING_SLACK = 1.45

/**
 * Wraps generated mesh data in a three.js geometry.
 *
 * @param mesh - The generated mesh.
 * @returns The geometry, with the koi's body and fin attributes bound and a culling sphere sized for a bent fish.
 *
 * @example Mounting a generated body
 * ```typescript
 * const body = new Mesh(toBufferGeometry(buildBodyMesh(physical, resolution)), skinMaterial)
 * ```
 */
export function toBufferGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3))
  geometry.setAttribute('aBody', new BufferAttribute(mesh.body, 2))
  geometry.setAttribute('aFin', new BufferAttribute(mesh.fin, 4))
  geometry.setIndex(new BufferAttribute(mesh.indices, 1))

  const { min, max } = meshBounds(mesh)
  const centre = new Vector3((min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5)
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.5
  geometry.boundingSphere = new Sphere(centre, radius * CULLING_SLACK)
  geometry.boundingBox = null

  return geometry
}
