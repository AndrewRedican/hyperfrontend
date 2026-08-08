import type { PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Camera, Group, Scene } from 'three'
import type { KoiState } from '../koi-motion'
import type { KoiRenderer } from '../koi-render'
import type { GlRenderer } from '../koi-stage'
import { createSpine, describePond, koiProfile } from '@hyperfrontend/demo-koi-lib'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createKoiRenderer } from '../koi-render'

// why: React refuses to let `act` drive a tree until the environment declares itself a test runner, and vitest sets no such flag on its own.
const testEnvironment = <{ IS_REACT_ACT_ENVIRONMENT?: boolean }>globalThis
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true

/** The world every spec here swims in. */
const POND: PondEnvironment = describePond(1280, 800, false)

/** The React koi's unchanging profile. */
const PROFILE = koiProfile('react')

/** The URL this koi reveals when the host says the pointer is on it. */
const APP_URL = 'https://pond.test/fish-react/'

/** A GL stand-in that records what the renderer was asked to draw. */
interface FakeGl extends GlRenderer {
  frames: { scene: Scene; camera: Camera }[]
  sizes: [number, number][]
}

/** The injectable factory, remembering every fake it built. */
interface GlHarness {
  /** Every fake built, in creation order; StrictMode mounts the stage twice. */
  created: FakeGl[]
  /** The fake behind the currently mounted stage. */
  gl(): FakeGl
  /** The factory the specs inject. */
  factory(canvas: HTMLCanvasElement): GlRenderer
}

/**
 * Builds the GL factory the specs inject.
 *
 * @returns The harness, recording every fake it hands out.
 */
function glHarness(): GlHarness {
  const created: FakeGl[] = []
  return {
    created,
    gl() {
      const latest = created.at(-1)
      if (latest === undefined) {
        throw new Error('no GL renderer has been created')
      }
      return latest
    },
    factory() {
      const frames: FakeGl['frames'] = []
      const sizes: FakeGl['sizes'] = []
      const fake: FakeGl = {
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
      created.push(fake)
      return fake
    },
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
  let harness: GlHarness

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    root = <HTMLElement>document.querySelector('#app')
    harness = glHarness()
  })

  /**
   * Mounts a renderer and waits for React to commit its tree.
   *
   * @returns The renderer, its stage already built.
   */
  async function mounted(): Promise<KoiRenderer> {
    // why: `createRoot().render()` only schedules the tree, so the act scope is what has the canvas committed before anything asserts on it.
    return act(async () => createKoiRenderer(root, PROFILE, APP_URL, POND, harness.factory))
  }

  it('builds a transparent canvas and a hidden identity card', async () => {
    await mounted()
    const canvas = root.querySelector('canvas.koi-canvas')
    const card = root.querySelector<HTMLElement>('.koi-card')
    expect(canvas).not.toBeNull()
    expect(card?.hidden).toBe(true)
    expect(card?.querySelector('.koi-card-name')?.textContent).toBe(PROFILE.label)
    expect(card?.querySelector('.koi-card-url')?.textContent).toBe(APP_URL)
    expect(harness.gl().sizes.at(-1)).toEqual([POND.width, POND.height])
  })

  it('puts a whole koi in the scene it renders', async () => {
    const renderer = await mounted()
    renderer.draw(cruising(), 1 / 60)
    const frame = harness.gl().frames.at(-1)
    expect(frame).toBeDefined()
    const koi = <Group>frame?.scene.getObjectByName('koi')
    expect(koi).toBeDefined()
    // why: The koi's three surfaces are the visible output; a scene without them renders empty water.
    for (const surface of ['koi-skin', 'koi-fins', 'koi-eyes']) {
      expect(koi.getObjectByName(surface)).toBeDefined()
    }
    expect(frame?.scene.getObjectByName('koi-lighting-pond')).toBeDefined()
  })

  it('moves the koi where the brain says it is', async () => {
    const renderer = await mounted()
    renderer.draw(cruising({ position: { x: 200, y: 300 } }), 1 / 60)
    const koi = <Group>harness.gl().frames.at(-1)?.scene.getObjectByName('koi')
    const before = koi.position.clone()
    renderer.draw(cruising({ position: { x: 1000, y: 500 } }), 1 / 60)
    expect(koi.position.x).toBeGreaterThan(before.x)
    expect(koi.position.z).toBeGreaterThan(before.z)
  })

  it('faces the koi along its pond heading', async () => {
    const renderer = await mounted()
    renderer.draw(cruising({ heading: Math.PI / 2 }), 1 / 60)
    const koi = <Group>harness.gl().frames.at(-1)?.scene.getObjectByName('koi')
    expect(koi.rotation.y).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('shrinks the koi with depth exactly as the wire promises', async () => {
    const renderer = await mounted()
    renderer.draw(cruising({ depth: 6 }), 1 / 60)
    const koi = <Group>harness.gl().frames.at(-1)?.scene.getObjectByName('koi')
    const surface = koi.scale.x
    renderer.draw(cruising({ depth: 0 }), 1 / 60)
    // why: The renderer's deepest shrink and the model's depthScale share the 0.72 floor, so hit-testing agrees with pixels.
    expect(koi.scale.x / surface).toBeCloseTo(0.72, 2)
  })

  it('feeds the swimming model pond speeds in this body-lengths', async () => {
    const renderer = await mounted()
    const bodyPx = POND.fishLength * PROFILE.build.lengthScale
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ speed: bodyPx * 0.5 }), 1 / 60)
    }
    // why: The swim state eases toward its input, so after two seconds of a steady half-body-length cruise it must have arrived there.
    expect(renderer.koi.swim.motion.speed).toBeCloseTo(0.5, 1)
  })

  it('drives the swim into a full escape when the brain flees', async () => {
    const renderer = await mounted()
    renderer.draw(cruising(), 1 / 60)
    expect(renderer.koi.swim.motion.escapeIntensity).toBeLessThan(0.2)
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ phase: 'escape', speed: 400 }), 1 / 60)
    }
    expect(renderer.koi.swim.motion.escapeIntensity).toBeGreaterThan(0.8)
  })

  it('resizes camera and canvas together on a pond re-announcement', async () => {
    const renderer = await mounted()
    const card = describePond(420, 300, false)
    renderer.setPond({ ...card, fishLength: card.fishLength * 0.72 })
    expect(harness.gl().sizes.at(-1)).toEqual([420, 300])
  })

  it('reveals and places the card only while hovered', async () => {
    const renderer = await mounted()
    const card = <HTMLElement>root.querySelector('.koi-card')
    renderer.setHovered(true)
    expect(card.hidden).toBe(false)
    renderer.placeCard(cruising({ position: { x: 500, y: 320 } }))
    expect(card.style.transform).toContain('translate(')
    renderer.setHovered(false)
    expect(card.hidden).toBe(true)
  })

  it('tears the whole koi down on dispose', async () => {
    const renderer = await mounted()
    await act(async () => {
      renderer.dispose()
    })
    expect(root.querySelector('canvas')).toBeNull()
    expect(root.querySelector('.koi-card')).toBeNull()
    // why: StrictMode mounts the stage, tears it down, and mounts it again — every stage ever built must have released its GPU handle by now.
    for (const fake of harness.created) {
      expect(fake.dispose).toHaveBeenCalledOnce()
    }
  })
})
