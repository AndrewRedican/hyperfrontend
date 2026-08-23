/**
 * @vitest-environment jsdom
 */
import type { Camera, Object3D as SceneNode, PerspectiveCamera } from 'three'
import type { GlRenderer, KoiStage, KoiStagePose } from '../koi-stage.js'
import type { PondViewport } from '../pond-view.js'
import { describe, expect, it } from 'vitest'
import { wrapAngle } from '../../geometry/steering.js'
import { koiFrameBox } from '../../geometry/virtual-pond.js'
import { pxPerUnit } from '../../model/pond-view.js'
import { koiProfile, koiSeed } from '../../model/traits.js'
import { createKoiStage } from '../koi-stage.js'

/** A landscape window onto a larger virtual pond, deliberately offset so the frame math must respect it. */
const POND: PondViewport = { view: { x: 320, y: 140, width: 1280, height: 800 }, fishLength: 150 }

/** The profile every spec builds its stage from; which fish it is never matters here. */
const PROFILE = koiProfile('vanilla')

/** A frame long enough that every shim divides by something visible. */
const DT = 0.1

/** A nose position whose whole frame box falls outside the window. */
const OFFSCREEN = { x: 2600, y: 1400 }

/** One camera narrowing, as the renderer saw it at render time. */
interface RecordedFrame {
  /** The full window width the offset was taken against, in CSS pixels. */
  fullWidth: number
  /** The full window height the offset was taken against, in CSS pixels. */
  fullHeight: number
  /** The box's left edge relative to the window, in CSS pixels. */
  offsetX: number
  /** The box's top edge relative to the window, in CSS pixels. */
  offsetY: number
  /** The narrowed width, in CSS pixels. */
  width: number
  /** The narrowed height, in CSS pixels. */
  height: number
}

/** Everything one stage's renderer was asked to do. */
interface RecordingGl extends GlRenderer {
  /** Every render, with the scene it was handed and the camera's narrowing cloned at call time. */
  draws: Array<{ scene: SceneNode; frame: RecordedFrame | null }>
  /** Every buffer edge it was asked to allocate, in CSS pixels. */
  sizes: number[]
  /** Every device-pixel ratio it was asked to adopt. */
  ratios: number[]
  /** How many times it was disposed. */
  disposals: number
}

/** Builds a renderer that records instead of drawing, so the stage runs without a GPU. */
function recordingGl(): RecordingGl {
  const gl: RecordingGl = {
    draws: [],
    sizes: [],
    ratios: [],
    disposals: 0,
    render: (scene: SceneNode, camera: Camera) => {
      // why: The stage reuses one camera, so the narrowing must be copied out at call time or every recorded frame would read as the last one.
      const view = (<PerspectiveCamera>camera).view
      gl.draws.push({
        scene,
        frame:
          view === null
            ? null
            : {
                fullWidth: view.fullWidth,
                fullHeight: view.fullHeight,
                offsetX: view.offsetX,
                offsetY: view.offsetY,
                width: view.width,
                height: view.height,
              },
      })
    },
    setSize: (width: number) => {
      gl.sizes.push(width)
    },
    setPixelRatio: (ratio: number) => {
      gl.ratios.push(ratio)
    },
    dispose: () => {
      gl.disposals += 1
    },
  }
  return gl
}

/** A stage mounted for one spec, with the canvas and renderer it drives. */
interface MountedStage {
  /** The stage under test. */
  stage: KoiStage
  /** The recorded renderer behind it. */
  gl: RecordingGl
  /** The canvas the stage styles. */
  canvas: HTMLCanvasElement
}

/**
 * Mounts a stage against a recording renderer.
 *
 * @param pond - The world the stage opens onto.
 * @returns The stage with its canvas and recorded renderer.
 */
function mount(pond: PondViewport = POND): MountedStage {
  const canvas = document.createElement('canvas')
  const gl = recordingGl()
  return { stage: createKoiStage(canvas, PROFILE, pond, () => gl), gl, canvas }
}

/**
 * A pose in the middle of the window, overridable per scenario.
 *
 * @param over - The fields a scenario cares about.
 * @returns The pose.
 */
function pose(over: Partial<KoiStagePose> = {}): KoiStagePose {
  return { position: { x: 960, y: 540 }, heading: 0.4, speed: 120, phase: 'relaxed', depth: 0, length: 150, ...over }
}

/**
 * The frame box a pose occupies in the shared window.
 *
 * @param state - The pose.
 * @returns The box.
 */
function boxOf(state: KoiStagePose): ReturnType<typeof koiFrameBox> {
  return koiFrameBox(state.position, state.heading, state.length, POND.view)
}

describe('createKoiStage', () => {
  it('builds the koi from the profile it is handed', () => {
    const { stage } = mount()
    expect(stage.koi.config).toEqual(
      expect.objectContaining({
        seed: koiSeed('vanilla'),
        appearance: expect.objectContaining({
          pattern: PROFILE.palette.pattern,
          base: PROFILE.palette.body,
          primary: PROFILE.palette.marking,
          secondary: PROFILE.palette.shade,
          accent: PROFILE.palette.accent,
        }),
        physical: expect.objectContaining({
          length: PROFILE.phenotype.length,
          width: PROFILE.phenotype.width,
          height: PROFILE.phenotype.height,
          shoulder: PROFILE.phenotype.shoulder,
          belly: PROFILE.phenotype.belly,
          dorsalRidge: PROFILE.phenotype.dorsalRidge,
          peduncleWidth: PROFILE.phenotype.peduncleWidth,
          head: expect.objectContaining({ ...PROFILE.phenotype.head }),
          caudal: expect.objectContaining({ ...PROFILE.phenotype.caudal }),
          pectoral: expect.objectContaining({ ...PROFILE.phenotype.pectoral }),
        }),
        trim: expect.objectContaining(PROFILE.trim),
      })
    )
  })

  it('renders the scene its own koi is mounted in', () => {
    const { stage, gl } = mount()
    stage.draw(pose(), DT)
    expect(gl.draws[0]?.scene).toBe(stage.koi.object.parent)
  })

  it('lights the scene with the pond preset', () => {
    const { stage, gl } = mount()
    stage.draw(pose(), DT)
    expect(gl.draws[0]?.scene.children.some((child) => child.name === 'koi-lighting-pond')).toBe(true)
  })

  it('fits the drawing buffer and canvas to the frame box', () => {
    const { stage, gl, canvas } = mount()
    const state = pose()
    stage.draw(state, DT)
    // why: jsdom reports a device-pixel ratio of 1, and a box this small never trips the buffer cap, so 1 is the fitted ratio.
    expect({ sizes: gl.sizes, ratios: gl.ratios, edge: [canvas.style.width, canvas.style.height] }).toEqual({
      sizes: [boxOf(state).size],
      ratios: [1],
      edge: [`${boxOf(state).size}px`, `${boxOf(state).size}px`],
    })
  })

  it('narrows the shared camera onto the frame box before rendering', () => {
    const { stage, gl } = mount()
    const state = pose()
    stage.draw(state, DT)
    const box = boxOf(state)
    expect(gl.draws[0]?.frame).toEqual({
      fullWidth: POND.view.width,
      fullHeight: POND.view.height,
      offsetX: box.x - POND.view.x,
      offsetY: box.y - POND.view.y,
      width: box.size,
      height: box.size,
    })
  })

  it('slides the canvas to the frame box relative to the window', () => {
    const { stage, canvas } = mount()
    const state = pose()
    stage.draw(state, DT)
    const box = boxOf(state)
    expect(canvas.style.transform).toBe(`translate3d(${(box.x - POND.view.x).toFixed(1)}px, ${(box.y - POND.view.y).toFixed(1)}px, 0)`)
  })

  it('anchors the koi on the swim plane at the numbers the golden poses pin', () => {
    const { stage } = mount()
    const script: KoiStagePose[] = [
      pose(),
      pose({ position: { x: 420, y: 220 }, heading: -2.9, length: 190 }),
      pose({ position: { x: 1500, y: 900 }, heading: 1.2, length: 130 }),
    ]
    const anchors = script.map((state) => {
      stage.draw(state, DT)
      const { x, y, z } = stage.koi.object.position
      return { x, y, z, yaw: stage.koi.object.rotation.y }
    })
    // why: The anchors are pinned as literals so a change anywhere along the nose-to-pivot-to-world chain shows up as moved numbers rather than as an oracle that drifted in agreement.
    expect(anchors).toEqual([
      {
        x: expect.closeTo(-0.3322930966211232, 10),
        y: expect.closeTo(0, 12),
        z: expect.closeTo(-0.1426585721479117, 10),
        yaw: expect.closeTo(-0.4, 12),
      },
      {
        x: expect.closeTo(-3.2579165761677897, 10),
        y: expect.closeTo(0, 12),
        z: expect.closeTo(-2.1210042936820157, 10),
        yaw: expect.closeTo(2.9, 12),
      },
      {
        x: expect.closeTo(3.37817301681063, 10),
        y: expect.closeTo(0, 12),
        z: expect.closeTo(2.0749324168212, 10),
        yaw: expect.closeTo(-1.2, 12),
      },
    ])
  })
})

describe('createKoiStage unit shim', () => {
  it('shims the wire units into the swimming model across a golden set of poses', () => {
    const { stage } = mount()
    const bodyPx = pxPerUnit(POND.fishLength) * PROFILE.build.lengthScale
    const script: KoiStagePose[] = [
      pose({ speed: 96 }),
      pose({ speed: 150, heading: 0.65, depth: 2, phase: 'turning' }),
      pose({ speed: 420, heading: 0.1, depth: 1, phase: 'escape' }),
    ]
    const told = script.map((state) => {
      stage.draw(state, DT)
      const { speed, turnRate, acceleration, escapeIntensity, depth, climbRate } = stage.koi.swim.motion
      return { speed, turnRate, acceleration, escapeIntensity, depth, climbRate }
    })
    // why: The depths are pinned as literals on the swimming model's own axis, 0 at the surface and 1 on the floor, so an inverted shim reads as wrong numbers rather than as an agreeing round-trip through the same function.
    expect(told).toEqual([
      {
        speed: expect.closeTo(96 / bodyPx, 10),
        turnRate: 0,
        acceleration: expect.closeTo(96 / bodyPx / DT, 10),
        escapeIntensity: 0,
        depth: 1,
        climbRate: 0,
      },
      {
        speed: expect.closeTo(150 / bodyPx, 10),
        turnRate: expect.closeTo(wrapAngle(0.65 - 0.4) / DT, 10),
        acceleration: expect.closeTo((150 - 96) / bodyPx / DT, 10),
        escapeIntensity: 0,
        depth: expect.closeTo(2 / 3, 12),
        climbRate: 0,
      },
      {
        speed: expect.closeTo(420 / bodyPx, 10),
        turnRate: expect.closeTo(wrapAngle(0.1 - 0.65) / DT, 10),
        acceleration: expect.closeTo((420 - 150) / bodyPx / DT, 10),
        escapeIntensity: 1,
        depth: expect.closeTo(5 / 6, 12),
        climbRate: 0,
      },
    ])
  })

  it('feeds a clockwise-growing heading in as a positive turn rate', () => {
    const { stage } = mount()
    stage.draw(pose({ heading: 0.2 }), DT)
    stage.draw(pose({ heading: 0.5 }), DT)
    expect(stage.koi.swim.motion.turnRate).toBeCloseTo(3, 10)
  })

  it('reads a heading that wraps across the seam as the short way round', () => {
    const { stage } = mount()
    stage.draw(pose({ heading: Math.PI - 0.05 }), DT)
    stage.draw(pose({ heading: -Math.PI + 0.05 }), DT)
    expect(stage.koi.swim.motion.turnRate).toBeCloseTo(1, 10)
  })

  it('guards a zero-length frame instead of dividing by it', () => {
    const { stage } = mount()
    stage.draw(pose(), DT)
    stage.draw(pose(), 0)
    expect(stage.koi.swim.motion).toEqual(expect.objectContaining({ turnRate: 0, acceleration: 0 }))
  })
})

describe('createKoiStage offscreen', () => {
  it('hides the canvas and draws nothing while the koi is outside the window', () => {
    const { stage, gl, canvas } = mount()
    stage.draw(pose({ position: OFFSCREEN }), DT)
    expect({ display: canvas.style.display, draws: gl.draws, sizes: gl.sizes }).toEqual({ display: 'none', draws: [], sizes: [] })
  })

  it('shows the canvas again the frame the koi re-enters the window', () => {
    const { stage, gl, canvas } = mount()
    stage.draw(pose({ position: OFFSCREEN }), DT)
    stage.draw(pose(), DT)
    expect({ display: canvas.style.display, draws: gl.draws.length }).toEqual({ display: '', draws: 1 })
  })

  it('keeps the speed memory current through skipped frames so re-entry lands no acceleration spike', () => {
    const { stage } = mount()
    stage.draw(pose({ speed: 90 }), DT)
    stage.draw(pose({ speed: 420, position: OFFSCREEN }), DT)
    stage.draw(pose({ speed: 420 }), DT)
    expect(stage.koi.swim.motion.acceleration).toBeCloseTo(0, 10)
  })

  it('keeps the heading memory current through skipped frames so re-entry lands no turn spike', () => {
    const { stage } = mount()
    stage.draw(pose({ heading: 0.2 }), DT)
    stage.draw(pose({ heading: 2.2, position: OFFSCREEN }), DT)
    stage.draw(pose({ heading: 2.2 }), DT)
    expect(stage.koi.swim.motion.turnRate).toBeCloseTo(0, 10)
  })
})

describe('createKoiStage refit', () => {
  it('re-fits the buffer only when the frame box drifts past ten percent', () => {
    const { stage, gl } = mount()
    stage.draw(pose({ length: 150 }), DT)
    // why: The lengths bracket the threshold tightly, 9.3 percent held and 11.3 percent re-fit, so the rule's constant is pinned and not just its direction.
    stage.draw(pose({ length: 164 }), DT)
    stage.draw(pose({ length: 167 }), DT)
    expect(gl.sizes).toEqual([boxOf(pose({ length: 150 })).size, boxOf(pose({ length: 167 })).size])
  })

  it('re-fits and re-anchors against the window a pond announcement moves', () => {
    const { stage, gl, canvas } = mount()
    const state = pose()
    stage.draw(state, DT)
    stage.setPond({ view: { x: 340, y: 160, width: 1280, height: 800 }, fishLength: 150 })
    stage.draw(state, DT)
    const box = boxOf(state)
    expect({ sizes: gl.sizes, transform: canvas.style.transform }).toEqual({
      sizes: [box.size, box.size],
      transform: `translate3d(${(box.x - 340).toFixed(1)}px, ${(box.y - 160).toFixed(1)}px, 0)`,
    })
  })

  it('re-derives the body-length shim from the announced fish length', () => {
    const { stage } = mount()
    stage.setPond({ view: { x: 320, y: 140, width: 1280, height: 800 }, fishLength: 300 })
    stage.draw(pose({ speed: 120 }), DT)
    expect(stage.koi.swim.motion.speed).toBeCloseTo(120 / (pxPerUnit(300) * PROFILE.build.lengthScale), 12)
  })
})

describe('createKoiStage setOutline', () => {
  it('traces and clears the silhouette on the underlying koi', () => {
    const { stage } = mount()
    const outlines = (): boolean[] =>
      stage.koi.object.children.filter((child) => child.name.startsWith('koi-outline')).map((child) => child.visible)
    stage.setOutline(1)
    const shown = outlines()
    stage.setOutline(0)
    expect({ shown, hidden: outlines() }).toEqual({ shown: [true, true], hidden: [false, false] })
  })
})

describe('createKoiStage dispose', () => {
  it('releases the koi and the renderer together', () => {
    const { stage, gl } = mount()
    let koiFreed = false
    stage.koi.surfaces.skin.geometry.addEventListener('dispose', () => {
      koiFreed = true
    })
    stage.dispose()
    expect({ koiFreed, renderers: gl.disposals }).toEqual({ koiFreed: true, renderers: 1 })
  })
})
