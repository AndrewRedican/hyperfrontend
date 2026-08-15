import type { PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Camera, Group, Scene } from 'three'
import type { GlRenderer } from '../koi-render'
import type { KoiState } from '../koi-motion'
import { createSpine, describePond, koiProfile, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createKoiRenderer } from '../koi-render'

/** The world every spec here swims in. */
const POND: PondEnvironment = describePond(1280, 800, 1280, 800, false)

/** The Vue koi's unchanging profile. */
const PROFILE = koiProfile('vue')

/** A GL stand-in that records what the renderer was asked to draw. */
interface FakeGl extends GlRenderer {
  frames: { scene: Scene; camera: Camera }[]
  sizes: [number, number][]
}

/**
 * Builds the GL stand-in the specs inject.
 *
 * @returns The fake, recording every render and resize.
 */
function fakeGl(): FakeGl {
  const frames: FakeGl['frames'] = []
  const sizes: FakeGl['sizes'] = []
  return {
    frames,
    sizes,
    render(scene, camera) {
      frames.push({ scene: <Scene>scene, camera })
    },
    setSize(width, height) {
      sizes.push([width, height])
    },
    setPixelRatio: vi.fn<(ratio: number) => void>(),
    dispose: vi.fn<() => void>(),
  }
}

/**
 * A koi state fixture cruising at a chosen spot.
 *
 * @param overrides - Fields to change from the cruising default.
 * @returns The state.
 */
function cruising(overrides: Partial<KoiState> = {}): KoiState {
  const position = overrides.position ?? { x: 640, y: 400 }
  return {
    heading: 0,
    speed: 60,
    phase: 'relaxed',
    depth: 3,
    length: POND.fishLength,
    spine: createSpine(position, overrides.heading ?? 0, POND.fishLength),
    ...overrides,
    position,
  }
}

describe('createKoiRenderer', () => {
  let root: HTMLElement
  let gl: FakeGl

  beforeEach(() => {
    root = document.createElement('div')
    root.id = 'app'
    document.body.replaceChildren(root)
    gl = fakeGl()
  })

  it('builds a transparent canvas and a hidden identity card', () => {
    createKoiRenderer(root, PROFILE, 'https://pond.example/fish-vue/', POND, () => gl)
    const canvas = root.querySelector('canvas.koi-canvas')
    const card = root.querySelector<HTMLElement>('.koi-card')
    expect(canvas).not.toBeNull()
    expect(card?.hidden).toBe(true)
    expect(card?.querySelector('.koi-card-title')?.textContent).toBe(PROFILE.label)
    expect(card?.querySelector('.koi-card-url')?.textContent).toBe('https://pond.example/fish-vue/')
    const site = card?.querySelector<HTMLAnchorElement>('.koi-card-site')
    expect(site?.href).toContain('vuejs.org')
    expect(site?.rel).toBe('noopener noreferrer')
  })

  it('sizes its buffer to the koi frame box, never the viewport', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    const size = gl.sizes.at(-1)
    expect(size).toBeDefined()
    // why: The box is square and covers one fish plus its sweep — a viewport-sized buffer here is exactly the fill-rate and memory cost the frame box exists to remove.
    expect(size?.[0]).toBe(size?.[1])
    expect(size?.[0] ?? Number.POSITIVE_INFINITY).toBeLessThan(POND.view.width)
  })

  it('re-fits the buffer only when the box genuinely changes size', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    renderer.draw(cruising({ position: { x: 700, y: 420 } }), 1 / 60)
    renderer.draw(cruising({ position: { x: 760, y: 440 } }), 1 / 60)
    expect(gl.sizes).toHaveLength(1)
  })

  it('slides the canvas with the koi instead of repainting the world', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ position: { x: 400, y: 300 } }), 1 / 60)
    const canvas = <HTMLElement>root.querySelector<HTMLElement>('canvas.koi-canvas')
    const before = canvas.style.transform
    renderer.draw(cruising({ position: { x: 900, y: 500 } }), 1 / 60)
    expect(canvas.style.transform).toContain('translate3d(')
    expect(canvas.style.transform).not.toBe(before)
  })

  it('draws nothing at all for a koi outside the visible window', () => {
    const card = describePond(1280, 800, 420, 300, false)
    const renderer = createKoiRenderer(root, PROFILE, 'url', card, () => gl)
    const canvas = <HTMLElement>root.querySelector<HTMLElement>('canvas.koi-canvas')
    renderer.draw(cruising({ position: { x: 40, y: 40 }, spine: createSpine({ x: 40, y: 40 }, 0, card.fishLength) }), 1 / 60)
    // why: An off-screen koi pays nothing — no pose, no render, no composite; the brain keeps swimming and the canvas comes back the moment it does.
    expect(gl.frames).toHaveLength(0)
    expect(canvas.style.display).toBe('none')
    renderer.draw(cruising({ position: { x: 640, y: 400 } }), 1 / 60)
    expect(gl.frames).toHaveLength(1)
    expect(canvas.style.display).not.toBe('none')
  })

  it('puts a whole koi in the scene it renders', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    const frame = gl.frames.at(-1)
    expect(frame).toBeDefined()
    const koi = <Group>frame?.scene.getObjectByName('koi')
    expect(koi).toBeDefined()
    // why: The koi's three surfaces are the visible output; a scene without them renders empty water.
    for (const surface of ['koi-skin', 'koi-fins', 'koi-eyes']) {
      expect(koi.getObjectByName(surface)).toBeDefined()
    }
    expect(frame?.scene.getObjectByName('koi-lighting-pond')).toBeDefined()
  })

  it('moves the koi where the brain says it is', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ position: { x: 200, y: 300 } }), 1 / 60)
    const koi = <Group>gl.frames.at(-1)?.scene.getObjectByName('koi')
    const before = koi.position.clone()
    renderer.draw(cruising({ position: { x: 1000, y: 500 } }), 1 / 60)
    expect(koi.position.x).toBeGreaterThan(before.x)
    expect(koi.position.z).toBeGreaterThan(before.z)
  })

  it('faces the koi along its pond heading', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ heading: Math.PI / 2 }), 1 / 60)
    const koi = <Group>gl.frames.at(-1)?.scene.getObjectByName('koi')
    expect(koi.rotation.y).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('shrinks the koi with depth exactly as the wire promises', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ depth: 6 }), 1 / 60)
    const koi = <Group>gl.frames.at(-1)?.scene.getObjectByName('koi')
    const surface = koi.scale.x
    renderer.draw(cruising({ depth: 0 }), 1 / 60)
    // why: The renderer's deepest shrink and the model's depthScale share the 0.72 floor, so hit-testing agrees with pixels.
    expect(koi.scale.x / surface).toBeCloseTo(0.72, 2)
  })

  it('feeds the swimming model pond speeds in this body-lengths', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const bodyPx = POND.fishLength * PROFILE.build.lengthScale
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ speed: bodyPx * 0.5 }), 1 / 60)
    }
    // why: The swim state eases toward its input, so after two seconds of a steady half-body-length cruise it must have arrived there.
    expect(renderer.koi.swim.motion.speed).toBeCloseTo(0.5, 1)
  })

  it('drives the swim into a full escape when the brain flees', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    expect(renderer.koi.swim.motion.escapeIntensity).toBeLessThan(0.2)
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ phase: 'escape', speed: 400 }), 1 / 60)
    }
    expect(renderer.koi.swim.motion.escapeIntensity).toBeGreaterThan(0.8)
  })

  it('re-fits against the new window after a pond re-announcement', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    const fitted = gl.sizes.length
    // why: The pond itself never changes size — only the window onto it follows the presenting frame, and the next draw must size against that window rather than trust the old fit.
    renderer.setPond({ ...POND, view: pondWindow(POND, 420, 300) })
    renderer.draw(cruising(), 1 / 60)
    expect(gl.sizes.length).toBe(fitted + 1)
  })

  it('feeds a clockwise turn in as a positive turn rate, so the head bends into it', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ heading: 0 }), 1 / 60)
    renderer.draw(cruising({ heading: 0.1 }), 1 / 60)
    // why: Pond headings grow clockwise on screen and the model's positive turn bends toward the right flank — the same way. A negation here is exactly the head-opposing-the-turn defect.
    expect(renderer.koi.swim.motion.turnRate).toBeGreaterThan(0)
  })

  it('hangs a contact shadow beneath the body', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    const koi = <Group>gl.frames.at(-1)?.scene.getObjectByName('koi')
    expect(koi.getObjectByName('koi-shadow')).toBeDefined()
  })

  it('keeps the card closed on hover — hovering only says selectable', async () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const card = <HTMLElement>root.querySelector<HTMLElement>('.koi-card')
    renderer.setHovered(true)
    // why: Card visibility rides the selection ref's reactive binding, so any flip would land on Vue's next flush — the assertion has to wait for it.
    await nextTick()
    expect(card.hidden).toBe(true)
  })

  it('traces the silhouette softly on hover and fully while held', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const outline = renderer.koi.object.getObjectByName('koi-outline-skin')
    expect(outline?.visible).toBe(false)
    renderer.setHovered(true)
    expect(outline?.visible).toBe(true)
    renderer.setHovered(false)
    expect(outline?.visible).toBe(false)
    renderer.setSelected(true)
    expect(outline?.visible).toBe(true)
  })

  it('opens the card with the hold and keeps it open however the pointer moves', async () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const card = <HTMLElement>root.querySelector<HTMLElement>('.koi-card')
    renderer.setSelected(true)
    // why: Card visibility rides the selection ref's reactive binding, so it lands on Vue's next flush rather than inside the call.
    await nextTick()
    expect(card.hidden).toBe(false)
    // why: The visitor is about to move the pointer off the fish and into the card — losing the card to that move is exactly the regression this pins.
    renderer.setHovered(true)
    renderer.setHovered(false)
    await nextTick()
    expect(card.hidden).toBe(false)
    renderer.placeCard(cruising({ position: { x: 500, y: 320 } }))
    expect(card.style.transform).toContain('translate(')
    renderer.setSelected(false)
    await nextTick()
    expect(card.hidden).toBe(true)
  })

  it('rewrites the inspector rows from the live facts', async () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.updateCard({
      held: true,
      phase: 'relaxed',
      speedBL: 0.4,
      neighbours: 2,
      hosted: true,
      origin: 'same-origin',
      uptimeS: 30,
      fps: 60,
      memoryBytes: null,
      memoryState: 'unavailable',
      lastEvent: { kind: 'disturbance', ageS: 1.5 },
    })
    // why: The rows ride reactive bindings, so the text lands on Vue's next flush rather than inside the call.
    await nextTick()
    expect(root.querySelector('.koi-card-state')?.textContent).toContain('Held')
    expect(root.querySelector('.koi-card-runtime')?.textContent).toContain('same-origin')
    expect(root.querySelector('.koi-card-memory')?.textContent).toBe('Memory · unavailable')
    expect(root.querySelector('.koi-card-event')?.textContent).toContain('disturbance')
  })

  it('reports the card frame and both link rectangles only while held', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    expect(renderer.cardRects()).toBeNull()
    renderer.setSelected(true)
    const rects = renderer.cardRects()
    expect(rects).not.toBeNull()
    expect(rects?.frame).toBeDefined()
    expect(rects?.app).toBeDefined()
    expect(rects?.site).toBeDefined()
  })

  it('tears the whole koi down on dispose', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.dispose()
    expect(root.querySelector('canvas')).toBeNull()
    expect(root.querySelector('.koi-card')).toBeNull()
    expect(gl.dispose).toHaveBeenCalledOnce()
  })
})
