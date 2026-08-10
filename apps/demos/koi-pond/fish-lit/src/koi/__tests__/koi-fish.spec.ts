import type { Camera, Group, Scene } from 'three'
import type { KoiFishElement } from '../koi-fish'
import type { KoiState } from '../koi-motion'
import type { GlRenderer, KoiRenderer } from '../koi-render'
import { createSpine, describePond, koiProfile, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../koi-fish'

/** The world every spec here swims in: the screen snapshot the element takes standalone, windowed by its frame. */
const POND = describePond(window.screen.width, window.screen.height, window.innerWidth, window.innerHeight, false)

/** The Lit koi's unchanging profile. */
const PROFILE = koiProfile('lit')

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

describe('<koi-fish>', () => {
  let gl: FakeGl

  beforeEach(() => {
    document.body.innerHTML = ''
    gl = fakeGl()
    // why: The specs drive the renderer by hand, so the controller's own loop must never race them with frames of real motion.
    vi.stubGlobal('requestAnimationFrame', () => 0)
    vi.stubGlobal('cancelAnimationFrame', () => {})
    // why: jsdom ships no matchMedia, and the standalone fallback reads it once at construction to honour reduced motion.
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })

  afterEach(() => {
    // why: Removing the element runs its disconnect teardown, so no controller outlives the spec that mounted it.
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  /**
   * Mounts a koi element with the fake GL behind its canvas.
   *
   * @param url - The app URL the card reveals.
   * @returns The upgraded element and the renderer its controller built.
   */
  async function mountKoi(url = 'https://pond.example/fish-lit/'): Promise<{ element: KoiFishElement; renderer: KoiRenderer }> {
    const element = document.createElement('koi-fish')
    element.createGl = () => gl
    element.appUrl = url
    document.body.append(element)
    await element.updateComplete
    const renderer = element.swim.renderer
    if (renderer === null) {
      throw new Error('the koi element mounted without a renderer')
    }
    return { element, renderer }
  }

  /**
   * Reads the canvas and card out of a mounted element's shadow root.
   *
   * @param element - The mounted koi element.
   * @returns The stage nodes.
   */
  function stageOf(element: KoiFishElement): { canvas: HTMLCanvasElement; card: HTMLElement } {
    const root = element.shadowRoot
    const canvas = root?.querySelector<HTMLCanvasElement>('canvas.koi-canvas') ?? null
    const card = root?.querySelector<HTMLElement>('.koi-card') ?? null
    if (canvas === null || card === null) {
      throw new Error('the koi element rendered without its canvas or card')
    }
    return { canvas, card }
  }

  it('renders a transparent canvas and a hidden identity card in its shadow root', async () => {
    const { element } = await mountKoi()
    const { card } = stageOf(element)
    expect(card.hidden).toBe(true)
    expect(card.querySelector('.koi-card-name')?.textContent).toBe(PROFILE.label)
    expect(card.querySelector('.koi-card-url')?.textContent).toBe('https://pond.example/fish-lit/')
    expect(gl.sizes.at(-1)).toEqual([POND.view.width, POND.view.height])
  })

  it('colours the card label with this koi accent', async () => {
    const { element } = await mountKoi()
    const name = stageOf(element).card.querySelector<HTMLElement>('.koi-card-name')
    // how: Writing the accent through another element's style normalises the hex the same way jsdom normalised the label's, so the two strings compare exactly.
    const probe = document.createElement('span')
    probe.style.color = PROFILE.palette.accent
    expect(name?.style.color).toBe(probe.style.color)
  })

  it('puts a whole koi in the scene it renders', async () => {
    const { renderer } = await mountKoi()
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

  it('moves the koi where the brain says it is', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising({ position: { x: 200, y: 300 } }), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    const before = koi.position.clone()
    renderer.draw(cruising({ position: { x: 1000, y: 500 } }), 1 / 60)
    expect(koi.position.x).toBeGreaterThan(before.x)
    expect(koi.position.z).toBeGreaterThan(before.z)
  })

  it('faces the koi along its pond heading', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising({ heading: Math.PI / 2 }), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    expect(koi.rotation.y).toBeCloseTo(-Math.PI / 2, 6)
  })

  it('shrinks the koi with depth exactly as the wire promises', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising({ depth: 6 }), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    const surface = koi.scale.x
    renderer.draw(cruising({ depth: 0 }), 1 / 60)
    // why: The renderer's deepest shrink and the model's depthScale share the 0.72 floor, so hit-testing agrees with pixels.
    expect(koi.scale.x / surface).toBeCloseTo(0.72, 2)
  })

  it('feeds the swimming model pond speeds in this body-lengths', async () => {
    const { renderer } = await mountKoi()
    const bodyPx = POND.fishLength * PROFILE.build.lengthScale
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ speed: bodyPx * 0.5 }), 1 / 60)
    }
    // why: The swim state eases toward its input, so after two seconds of a steady half-body-length cruise it must have arrived there.
    expect(renderer.koi.swim.motion.speed).toBeCloseTo(0.5, 1)
  })

  it('drives the swim into a full escape when the brain flees', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising(), 1 / 60)
    expect(renderer.koi.swim.motion.escapeIntensity).toBeLessThan(0.2)
    for (let frame = 0; frame < 120; frame += 1) {
      renderer.draw(cruising({ phase: 'escape', speed: 400 }), 1 / 60)
    }
    expect(renderer.koi.swim.motion.escapeIntensity).toBeGreaterThan(0.8)
  })

  it('resizes camera and canvas to the visible window on a pond re-announcement', async () => {
    const { element } = await mountKoi()
    // why: The pond itself never changes size — only the window onto it follows the presenting frame.
    element.swim.setPond({ ...POND, view: pondWindow(POND, 420, 300) })
    expect(gl.sizes.at(-1)).toEqual([420, 300])
  })

  it('feeds a clockwise turn in as a positive turn rate, so the head bends into it', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising({ heading: 0 }), 1 / 60)
    renderer.draw(cruising({ heading: 0.1 }), 1 / 60)
    // why: Pond headings grow clockwise on screen and the model's positive turn bends toward the right flank — the same way. A negation here is exactly the head-opposing-the-turn defect.
    expect(renderer.koi.swim.motion.turnRate).toBeGreaterThan(0)
  })

  it('hangs a contact shadow beneath the body', async () => {
    const { renderer } = await mountKoi()
    renderer.draw(cruising(), 1 / 60)
    const koi = gl.frames.at(-1)?.scene.getObjectByName('koi') as Group
    expect(koi.getObjectByName('koi-shadow')).toBeDefined()
  })

  it('lays the tune scales over this koi its own build', async () => {
    const { renderer } = await mountKoi()
    renderer.applyTune({ widthScale: 1.3 })
    expect(renderer.koi.config.physical.width).toBeCloseTo((PROFILE.phenotype.width ?? 1) * 1.3, 5)
  })

  it('reveals and places the card only while hovered', async () => {
    const { element } = await mountKoi()
    const { card } = stageOf(element)
    element.swim.setHovered(true)
    expect(card.hidden).toBe(false)
    expect(card.style.transform).toContain('translate(')
    element.swim.setHovered(false)
    expect(card.hidden).toBe(true)
  })

  it('tears the whole koi down when its element leaves the page', async () => {
    const { element } = await mountKoi()
    element.remove()
    // why: The canvas and card are the template's to keep; leaving the page must still release the GPU behind them.
    expect(gl.dispose).toHaveBeenCalledOnce()
    expect(element.swim.renderer).toBeNull()
  })
})
