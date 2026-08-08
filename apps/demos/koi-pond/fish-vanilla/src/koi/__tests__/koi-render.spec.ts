import type { PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Camera, Group, Scene } from 'three'
import type { GlRenderer } from '../koi-render'
import type { KoiState } from '../koi-motion'
import { createSpine, describePond, koiProfile } from '@hyperfrontend/demo-koi-lib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createKoiRenderer } from '../koi-render'

/** The world every spec here swims in. */
const POND: PondEnvironment = describePond(1280, 800, false)

/** The vanilla koi's unchanging profile. */
const PROFILE = koiProfile('vanilla')

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
      frames.push({ scene: scene as Scene, camera })
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
    document.body.innerHTML = '<div id="app"></div>'
    root = document.querySelector('#app') as HTMLElement
    gl = fakeGl()
  })

  it('builds a transparent canvas and a hidden identity card', () => {
    createKoiRenderer(root, PROFILE, 'https://pond.example/fish-vanilla/', POND, () => gl)
    const canvas = root.querySelector('canvas.koi-canvas')
    const card = root.querySelector<HTMLElement>('.koi-card')
    expect(canvas).not.toBeNull()
    expect(card?.hidden).toBe(true)
    expect(card?.querySelector('.koi-card-name')?.textContent).toBe(PROFILE.label)
    expect(card?.querySelector('.koi-card-url')?.textContent).toBe('https://pond.example/fish-vanilla/')
    expect(gl.sizes.at(-1)).toEqual([POND.width, POND.height])
  })

  it('puts a whole koi in the scene it renders', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising(), 1 / 60)
    const frame = gl.frames.at(-1)
    expect(frame).toBeDefined()
    const koi = frame?.scene.getObjectByName('koi') as Group
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
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    const before = koi.position.clone()
    renderer.draw(cruising({ position: { x: 1000, y: 500 } }), 1 / 60)
    expect(koi.position.x).toBeGreaterThan(before.x)
    expect(koi.position.z).toBeGreaterThan(before.z)
  })

  it('faces the koi along its pond heading', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ heading: Math.PI / 2 }), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    expect(koi.rotation.y).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('shrinks the koi with depth exactly as the wire promises', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.draw(cruising({ depth: 6 }), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
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

  it('resizes camera and canvas together on a pond re-announcement', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const card = describePond(420, 300, false)
    renderer.setPond({ ...card, fishLength: card.fishLength * 0.72 })
    expect(gl.sizes.at(-1)).toEqual([420, 300])
  })

  it('reveals and places the card only while hovered', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    const card = root.querySelector<HTMLElement>('.koi-card') as HTMLElement
    renderer.setHovered(true)
    expect(card.hidden).toBe(false)
    renderer.placeCard(cruising({ position: { x: 500, y: 320 } }))
    expect(card.style.transform).toContain('translate(')
    renderer.setHovered(false)
    expect(card.hidden).toBe(true)
  })

  it('tears the whole koi down on dispose', () => {
    const renderer = createKoiRenderer(root, PROFILE, 'url', POND, () => gl)
    renderer.dispose()
    expect(root.querySelector('canvas')).toBeNull()
    expect(root.querySelector('.koi-card')).toBeNull()
    expect(gl.dispose).toHaveBeenCalledOnce()
  })
})
