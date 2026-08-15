<script module lang="ts">
  /**
   * The Svelte stage: one 3D koi on a transparent canvas, and its identity card.
   *
   * Nothing is painted on `body` or on the app root — the hostee SDK resets both
   * to transparent, and anything painted there would blank the pond behind this
   * frame for every koi below it. The canvas clears to transparent; only the
   * fish itself has colour.
   *
   * The canvas covers only the koi's own frame box, never the whole viewport:
   * the shared camera is narrowed onto that box each frame, so the small canvas
   * paints pixel-identically what a full-viewport render would have put there,
   * at a fraction of the fill and memory. A koi outside the visible window draws
   * nothing at all.
   *
   * Svelte owns exactly what is declarative here: the canvas, the card and its
   * text exist because the template says so. Everything that changes sixty times
   * a second — the scene, the swim, the canvas placement — is driven through the
   * exported functions below, so no frame ever passes through a rune.
   */
  import type { KoiFrameBox, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
  import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
  import type { KoiState } from './koi-motion'
  import type { GlRenderer } from './koi-render'
  import { POND_VIEW, koiFrameBox, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
  import { createKoi, createLighting, createPondView, fitPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
  import { Scene } from 'three'

  /** How far the frame box's edge may drift from the fitted buffer before a re-fit, as a fraction. */
  const REFIT_DRIFT = 0.1

  /** Everything the stage builds once its canvas exists, torn down as one. */
  interface Stage {
    /** The koi in the scene. */
    koi: Koi
    /** The shared pond camera. */
    view: PondView
    /** The scene the koi and its lighting live in. */
    scene: Scene
    /** The GL renderer drawing the scene. */
    gl: GlRenderer
    /** The canvas the koi draws on, sized and slid to its frame box. */
    canvas: HTMLCanvasElement
    /** The world as most recently announced, whose view maps pond space onto the frame. */
    pond: PondEnvironment
    /** This koi's body length in pond pixels, re-derived on every pond announcement. */
    bodyPx: number
    /** The heading of the previous frame, from which the turn rate is measured. */
    lastHeading: number | null
    /** The speed of the previous frame, in body lengths per second. */
    lastSpeed: number
    /** The frame-box edge the drawing buffer was last fitted to, in CSS pixels. */
    fittedSize: number
    /** Whether the canvas is currently displayed at all. */
    shown: boolean
    /** The scratch frame box `koiFrameBox` writes into each frame. */
    box: KoiFrameBox
  }
</script>

<script lang="ts">
  /** What the renderer factory mounts the stage with. */
  interface Props {
    /** Everything about this koi that never changes. */
    profile: KoiProfile
    /** The URL of the app rendering it, revealed on hover. */
    url: string
    /** The world at mount time; later announcements arrive via `setPond`. */
    pond: PondEnvironment
    /** The GL factory, replaceable so specs can run headless. */
    createGl: (canvas: HTMLCanvasElement) => GlRenderer
  }

  const { profile, url, pond, createGl }: Props = $props()

  const { palette, build, phenotype, trim } = $derived(profile)

  let canvas = $state<HTMLCanvasElement>()
  let card = $state<HTMLElement>()

  // note: The stage is deliberately not a rune — every field mutates once per frame, and nothing declarative reads it.
  let stage: Stage | null = null

  $effect(() => {
    if (canvas === undefined) {
      return
    }
    const gl = createGl(canvas)
    const view = createPondView(pond)
    const scene = new Scene()
    scene.add(createLighting(POND_VIEW.lighting))

    const koi = createKoi({
      seed: koiSeed(profile.framework),
      // why: The phenotype is the profile's own many-levered build — width, belly, head, fins — so the seven read as related but individually recognisable animals rather than one mesh at seven scales.
      physical: phenotype,
      appearance: {
        pattern: palette.pattern,
        base: palette.body,
        primary: palette.marking,
        secondary: palette.shade,
        accent: palette.accent,
      },
      trim,
    })
    koi.mount(scene)

    stage = {
      koi,
      view,
      scene,
      gl,
      canvas,
      pond,
      bodyPx: pxPerUnit(pond.fishLength) * build.lengthScale,
      lastHeading: null,
      lastSpeed: 0,
      fittedSize: 0,
      shown: true,
      box: { x: 0, y: 0, size: 0, visible: false },
    }

    return () => {
      koi.dispose()
      gl.dispose()
      stage = null
    }
  })

  /**
   * The koi this stage drives, exposed for debug overlays and specs.
   *
   * @returns The koi.
   */
  export function koiHandle(): Koi {
    if (stage === null) {
      throw new Error('the koi stage has no scene yet')
    }
    return stage.koi
  }

  /**
   * Advances and redraws the koi from its current state.
   *
   * @param state - What the koi is doing right now.
   * @param dt - Seconds since the previous frame.
   */
  export function draw(state: KoiState, dt: number): void {
    if (stage === null) {
      return
    }
    koiFrameBox(state.position, state.heading, state.length, stage.pond.view, stage.box)
    // why: A koi outside the window pays nothing — no pose, no uniforms, no clear, no composite. The brain keeps swimming; only the pixels stop.
    if (!stage.box.visible) {
      if (stage.shown) {
        stage.shown = false
        stage.canvas.style.display = 'none'
      }
      stage.lastHeading = state.heading
      return
    }
    if (!stage.shown) {
      stage.shown = true
      stage.canvas.style.display = ''
    }
    if (Math.abs(stage.box.size - stage.fittedSize) > stage.fittedSize * REFIT_DRIFT) {
      // why: The buffer re-fits only when the body's size genuinely changed — reallocating a drawing buffer every frame would cost more than the render itself.
      stage.fittedSize = stage.box.size
      fitPondRenderer(stage.gl, stage.box.size)
      stage.canvas.style.width = `${stage.box.size}px`
      stage.canvas.style.height = `${stage.box.size}px`
    }
    stage.canvas.style.transform = `translate3d(${(stage.box.x - stage.pond.view.x).toFixed(1)}px, ${(stage.box.y - stage.pond.view.y).toFixed(1)}px, 0)`

    const seconds = dt > 0 ? dt : 1e-6
    // why: The swimming model thinks in this koi's own body lengths, while the brain and the wire think in pond pixels.
    const speed = state.speed / stage.bodyPx
    // why: Both grow clockwise on screen — the model's positive turn bends toward the right flank exactly as a growing pond heading turns — so the heading's own rate feeds straight in and the head leads into the turn.
    const turnRate = stage.lastHeading === null ? 0 : wrapAngle(state.heading - stage.lastHeading) / seconds
    stage.koi.setMotion({
      speed,
      turnRate,
      acceleration: (speed - stage.lastSpeed) / seconds,
      escapeIntensity: state.phase === 'escape' ? 1 : 0,
      depth: swimDepth(state.depth),
    })
    stage.lastHeading = state.heading
    stage.lastSpeed = speed
    stage.koi.update(dt)
    stage.view.frame(stage.box)
    stage.view.place(stage.koi.object, state.position, state.heading)
    stage.gl.render(stage.scene, stage.view.camera)
  }

  /**
   * Re-derives the camera and canvas from a new pond announcement.
   *
   * @param next - The world as the host most recently announced it.
   */
  export function setPond(next: PondEnvironment): void {
    if (stage === null) {
      return
    }
    stage.pond = next
    stage.bodyPx = pxPerUnit(next.fishLength) * build.lengthScale
    stage.view.setPond(next)
    // why: A pond announcement moves the window, so the next draw must re-fit rather than trust a buffer sized against the old world.
    stage.fittedSize = 0
  }

  /**
   * Shows or hides the hover identity card.
   *
   * @param hovered - Whether the host's pointer is over this koi.
   */
  export function setHovered(hovered: boolean): void {
    if (card !== undefined) {
      card.hidden = !hovered
    }
  }

  /**
   * Positions the hover card beside the koi, clamped into the visible window.
   *
   * @param state - What the koi is doing right now.
   */
  export function placeCard(state: KoiState): void {
    const head = state.spine.joints[0]
    if (stage === null || card === undefined || head === undefined) {
      return
    }
    // why: The card rides off the koi's shoulder rather than its nose, so it never covers the fish a visitor is pointing at.
    // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
    const x = head.x - stage.pond.view.x + state.length * 0.12
    const y = head.y - stage.pond.view.y - state.length * 0.38
    // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
    const width = card.offsetWidth || 200
    const height = card.offsetHeight || 64
    const clampedX = Math.min(Math.max(x, 8), Math.max(8, stage.pond.view.width - width - 8))
    const clampedY = Math.min(Math.max(y, 8), Math.max(8, stage.pond.view.height - height - 8))
    card.style.transform = `translate(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px)`
  }
</script>

<canvas class="koi-canvas" aria-hidden="true" bind:this={canvas}></canvas>

<div class="koi-card" hidden bind:this={card}>
  <span class="koi-card-name" style:color={palette.accent}>{profile.label}</span>
  <span class="koi-card-url">{url}</span>
</div>
