import type { Mesh, ShaderMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { BackSide } from 'three'
import { createKoi } from '../koi.js'

/** Reads the silhouette meshes off a koi's object graph. */
function outlinesOf(koi: ReturnType<typeof createKoi>): Mesh[] {
  return <Mesh[]>koi.object.children.filter((child) => child.name.startsWith('koi-outline'))
}

describe('the silhouette trace', () => {
  it('exists for the body and the fins, hidden until asked for', () => {
    const outlines = outlinesOf(createKoi())
    expect(outlines).toHaveLength(2)
    expect(outlines.every((mesh) => !mesh.visible)).toBe(true)
  })

  it('borrows the live surfaces’ geometry so it deforms with them for free', () => {
    const koi = createKoi()
    const [skinTrace, finTrace] = outlinesOf(koi)
    expect(skinTrace?.geometry).toBe(koi.surfaces.skin.geometry)
    expect(finTrace?.geometry).toBe(koi.surfaces.fins.geometry)
  })

  it('shows at the asked strength and hides again at zero', () => {
    const koi = createKoi()
    koi.setOutline(1)
    const outlines = outlinesOf(koi)
    expect(outlines.every((mesh) => mesh.visible)).toBe(true)
    koi.setOutline(0)
    expect(outlines.every((mesh) => !mesh.visible)).toBe(true)
  })

  it('reads softer at a partial strength', () => {
    const koi = createKoi()
    koi.setOutline(1)
    const material = <ShaderMaterial>outlinesOf(koi)[0]?.material
    const full = <number>material.uniforms['uOutlineOpacity']?.value
    koi.setOutline(0.35)
    expect(<number>material.uniforms['uOutlineOpacity']?.value).toBeCloseTo(full * 0.35)
  })

  it('keeps tracing the rebuilt body after a physical change', () => {
    const koi = createKoi()
    koi.setPhysical({ width: 1.2 })
    const [skinTrace, finTrace] = outlinesOf(koi)
    expect(skinTrace?.geometry).toBe(koi.surfaces.skin.geometry)
    expect(finTrace?.geometry).toBe(koi.surfaces.fins.geometry)
  })

  it('draws only its far side so the body occludes everything but the rim', () => {
    const koi = createKoi()
    for (const trace of outlinesOf(koi)) {
      expect(trace.renderOrder).toBeLessThan(koi.surfaces.skin.renderOrder)
      expect((<ShaderMaterial>trace.material).depthWrite).toBe(false)
      expect((<ShaderMaterial>trace.material).side).toBe(BackSide)
    }
  })
})
