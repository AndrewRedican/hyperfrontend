import type { PondViewport } from '../pond-view.js'
import { Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { POND_VIEW, pxPerUnit } from '../../model/pond-view.js'
import { createPondView } from '../pond-view.js'

/** A landscape pond the size of a typical demo frame. */
const POND: PondViewport = { width: 1280, height: 800, fishLength: 150 }

/**
 * Projects a world point back onto pond-space pixels through a view's camera.
 *
 * @param view - The view whose camera to project through.
 * @param world - The world point.
 * @param pond - The viewport the view was built for.
 * @returns The pond-space position in CSS pixels.
 */
function pondFromWorld(view: ReturnType<typeof createPondView>, world: Vector3, pond: PondViewport): { x: number; y: number } {
  const projected = world.clone().project(view.camera)
  return { x: ((projected.x + 1) / 2) * pond.width, y: ((1 - projected.y) / 2) * pond.height }
}

describe('POND_VIEW', () => {
  it('freezes the numbers every fish must agree on', () => {
    expect(POND_VIEW).toEqual({ tiltDeg: 10, fovDeg: 26, exposure: 1.15, lighting: 'pond' })
  })

  it('scales one world unit to one nominal fish length of pixels', () => {
    expect(pxPerUnit(150)).toBe(150)
  })
})

describe('createPondView', () => {
  it('anchors any pond pixel exactly, corners and margin included', () => {
    const view = createPondView(POND)
    const points = [
      { x: POND.width / 2, y: POND.height / 2 },
      { x: 0, y: 0 },
      { x: POND.width, y: 0 },
      { x: 0, y: POND.height },
      { x: POND.width, y: POND.height },
      { x: -220, y: POND.height / 3 },
      { x: POND.width + 220, y: POND.height + 220 },
    ]
    for (const point of points) {
      const world = view.worldFromPond(point, new Vector3())
      expect(world.y).toBeCloseTo(0, 10)
      const back = pondFromWorld(view, world, POND)
      expect(back.x).toBeCloseTo(point.x, 4)
      expect(back.y).toBeCloseTo(point.y, 4)
    }
  })

  it('projects a fish-length of world onto a fish-length of pixels at the centre', () => {
    const view = createPondView(POND)
    const centre = view.worldFromPond({ x: POND.width / 2, y: POND.height / 2 }, new Vector3())
    const half = 0.5
    const nose = pondFromWorld(view, centre.clone().add(new Vector3(half, 0, 0)), POND)
    const tail = pondFromWorld(view, centre.clone().add(new Vector3(-half, 0, 0)), POND)
    const spanPx = Math.hypot(nose.x - tail.x, nose.y - tail.y)
    // why: A tilted perspective compresses the plane slightly, so the tolerance is a few percent rather than exact.
    expect(spanPx).toBeGreaterThan(POND.fishLength * 0.96)
    expect(spanPx).toBeLessThan(POND.fishLength * 1.04)
  })

  it('keeps the pond axes on screen: +x right, +y down', () => {
    const view = createPondView(POND)
    const centre = { x: POND.width / 2, y: POND.height / 2 }
    const right = view.worldFromPond({ x: centre.x + 100, y: centre.y }, new Vector3())
    const down = view.worldFromPond({ x: centre.x, y: centre.y + 100 }, new Vector3())
    const origin = view.worldFromPond(centre, new Vector3())
    expect(right.x).toBeGreaterThan(origin.x)
    expect(Math.abs(right.z - origin.z)).toBeLessThan(1e-6)
    expect(down.z).toBeGreaterThan(origin.z)
    expect(Math.abs(down.x - origin.x)).toBeLessThan(1e-6)
  })

  it('turns a pond heading into the yaw that points the nose along it', () => {
    const view = createPondView(POND)
    const koi = new Object3D()
    // why: A heading of a half-pi points down-screen in pond space, which is +z in the world.
    view.place(koi, { x: POND.width / 2, y: POND.height / 2 }, Math.PI / 2)
    koi.updateMatrixWorld()
    const nose = new Vector3(1, 0, 0).applyEuler(koi.rotation)
    expect(nose.x).toBeCloseTo(0, 6)
    expect(nose.z).toBeCloseTo(1, 6)
  })

  it('places without touching the object scale', () => {
    const view = createPondView(POND)
    const koi = new Object3D()
    koi.scale.setScalar(0.8)
    view.place(koi, { x: 200, y: 300 }, 1.2)
    expect(koi.scale.x).toBeCloseTo(0.8, 10)
    const back = pondFromWorld(view, koi.position.clone(), POND)
    expect(back.x).toBeCloseTo(200, 4)
    expect(back.y).toBeCloseTo(300, 4)
  })

  it('follows a pond re-announcement, card scale included', () => {
    const view = createPondView(POND)
    const card: PondViewport = { width: 420, height: 300, fishLength: POND.fishLength * 0.72 }
    view.setPond(card)
    expect(view.camera.aspect).toBeCloseTo(card.width / card.height, 10)
    const corner = view.worldFromPond({ x: card.width, y: card.height }, new Vector3())
    const back = pondFromWorld(view, corner, card)
    expect(back.x).toBeCloseTo(card.width, 4)
    expect(back.y).toBeCloseTo(card.height, 4)
  })
})
