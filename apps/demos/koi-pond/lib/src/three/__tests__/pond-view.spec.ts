import type { PondViewport } from '../pond-view.js'
import { Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { POND_VIEW, pxPerUnit } from '../../model/pond-view.js'
import { createPondView } from '../pond-view.js'

/** A landscape window onto a larger virtual pond, deliberately offset so the anchoring must respect it. */
const POND: PondViewport = { view: { x: 320, y: 140, width: 1280, height: 800 }, fishLength: 150 }

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
  return {
    x: pond.view.x + ((projected.x + 1) / 2) * pond.view.width,
    y: pond.view.y + ((1 - projected.y) / 2) * pond.view.height,
  }
}

/** The pond-space centre of a viewport's window. */
function windowCentre(pond: PondViewport): { x: number; y: number } {
  return { x: pond.view.x + pond.view.width / 2, y: pond.view.y + pond.view.height / 2 }
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
      windowCentre(POND),
      { x: POND.view.x, y: POND.view.y },
      { x: POND.view.x + POND.view.width, y: POND.view.y },
      { x: POND.view.x, y: POND.view.y + POND.view.height },
      { x: POND.view.x + POND.view.width, y: POND.view.y + POND.view.height },
      { x: POND.view.x - 220, y: POND.view.y + POND.view.height / 3 },
      { x: 0, y: 0 },
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
    const centre = view.worldFromPond(windowCentre(POND), new Vector3())
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
    const centre = windowCentre(POND)
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
    view.place(koi, windowCentre(POND), Math.PI / 2)
    koi.updateMatrixWorld()
    const nose = new Vector3(1, 0, 0).applyEuler(koi.rotation)
    expect(nose.x).toBeCloseTo(0, 6)
    expect(nose.z).toBeCloseTo(1, 6)
  })

  it('places without touching the object scale', () => {
    const view = createPondView(POND)
    const koi = new Object3D()
    koi.scale.setScalar(0.8)
    view.place(koi, { x: 400, y: 300 }, 1.2)
    expect(koi.scale.x).toBeCloseTo(0.8, 10)
    const back = pondFromWorld(view, koi.position.clone(), POND)
    expect(back.x).toBeCloseTo(400, 4)
    expect(back.y).toBeCloseTo(300, 4)
  })

  it('follows the window through a re-announcement without moving the pond', () => {
    const view = createPondView(POND)
    // how: The same pond seen through a card-sized window — the fish length is untouched because the pond itself has not changed.
    const card: PondViewport = { view: { x: 750, y: 390, width: 420, height: 300 }, fishLength: POND.fishLength }
    view.setPond(card)
    expect(view.camera.aspect).toBeCloseTo(card.view.width / card.view.height, 10)
    const corner = view.worldFromPond({ x: card.view.x + card.view.width, y: card.view.y + card.view.height }, new Vector3())
    const back = pondFromWorld(view, corner, card)
    expect(back.x).toBeCloseTo(card.view.x + card.view.width, 4)
    expect(back.y).toBeCloseTo(card.view.y + card.view.height, 4)
  })

  it('keeps a pond point anchored to the same world point across window sizes', () => {
    // why: Continuity between the gallery card and the expanded overlay depends on this — the window growing must reveal more pond, not re-place it.
    const view = createPondView(POND)
    const centre = windowCentre(POND)
    const anchored = view.worldFromPond(centre, new Vector3()).clone()
    view.setPond({ view: { x: 460, y: 240, width: 1000, height: 600 }, fishLength: POND.fishLength })
    const after = view.worldFromPond(centre, new Vector3())
    expect(after.x).toBeCloseTo(anchored.x, 6)
    expect(after.z).toBeCloseTo(anchored.z, 6)
  })
})

describe('createPondView frame', () => {
  it('renders a sub-rect pixel-identical to the full view', () => {
    const view = createPondView(POND)
    const at = { x: 900, y: 500 }
    const anchored = view.worldFromPond(at, new Vector3()).clone()
    // how: Narrow the camera onto a koi-sized box; the box's NDC must map the same pond pixel onto the same world point, so the sub-rect canvas paints exactly what the full view would have put there.
    const box = { x: 760, y: 380, size: 280 }
    view.frame(box)
    const projected = anchored.clone().project(view.camera)
    expect(box.x + ((projected.x + 1) / 2) * box.size).toBeCloseTo(at.x, 4)
    expect(box.y + ((1 - projected.y) / 2) * box.size).toBeCloseTo(at.y, 4)
  })

  it('unprojects through the narrowed camera consistently', () => {
    const view = createPondView(POND)
    const at = { x: 900, y: 500 }
    const full = view.worldFromPond(at, new Vector3()).clone()
    view.frame({ x: 760, y: 380, size: 280 })
    const framed = view.worldFromPond(at, new Vector3())
    expect(framed.x).toBeCloseTo(full.x, 6)
    expect(framed.z).toBeCloseTo(full.z, 6)
  })

  it('keeps an anchored object in place across frame moves', () => {
    const view = createPondView(POND)
    const koi = new Object3D()
    view.place(koi, { x: 900, y: 500 }, 0)
    const anchored = koi.position.clone()
    view.frame({ x: 700, y: 300, size: 300 })
    view.place(koi, { x: 900, y: 500 }, 0)
    expect(koi.position.x).toBeCloseTo(anchored.x, 6)
    expect(koi.position.z).toBeCloseTo(anchored.z, 6)
  })

  it('drops the narrowing when the pond is re-announced', () => {
    const view = createPondView(POND)
    view.frame({ x: 760, y: 380, size: 280 })
    view.setPond(POND)
    const at = { x: POND.view.x + POND.view.width / 2, y: POND.view.y + POND.view.height / 2 }
    const world = view.worldFromPond(at, new Vector3())
    const back = pondFromWorld(view, world.clone(), POND)
    expect(back.x).toBeCloseTo(at.x, 4)
    expect(back.y).toBeCloseTo(at.y, 4)
  })
})
