<script module lang="ts">
  /**
   * The Svelte stage: one 3D koi on a transparent canvas, and its identity card.
   *
   * Nothing is painted on `body` or on the app root — the hostee SDK resets both
   * to transparent, and anything painted there would blank the pond behind this
   * frame for every koi below it. The canvas clears to transparent; only the
   * fish itself has colour.
   *
   * Svelte owns exactly what is declarative here: the canvas, the card and its
   * text exist because the template says so. Everything that changes sixty times
   * a second — the scene, the swim, the card's placement — is driven through the
   * exported functions below, so no frame ever passes through a rune.
   */
  import type { KoiProfile, KoiTune, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
  import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
  import type { KoiState } from './koi-motion'
  import type { GlRenderer } from './koi-render'
  import { POND_VIEW, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
  import { createKoi, createLighting, createPondView, sizePondRenderer } from '@hyperfrontend/demo-koi-lib/three'
  import { Scene } from 'three'

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
    /** The world as most recently announced, whose view maps pond space onto the frame. */
    pond: PondEnvironment
    /** This koi's body length in pond pixels, re-derived on every pond announcement. */
    bodyPx: number
    /** The heading of the previous frame, from which the turn rate is measured. */
    lastHeading: number | null
    /** The speed of the previous frame, in body lengths per second. */
    lastSpeed: number
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

    sizePondRenderer(gl, pond.view.width, pond.view.height)
    stage = { koi, view, scene, gl, pond, bodyPx: pxPerUnit(pond.fishLength) * build.lengthScale, lastHeading: null, lastSpeed: 0 }

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
    sizePondRenderer(stage.gl, next.view.width, next.view.height)
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
   * Positions the hover card beside the koi.
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
    card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }

  /**
   * Takes the visitor's playground settings onto the body and the swim.
   *
   * @param tune - The scales to apply over this koi's own build and trim.
   */
  export function applyTune(tune: KoiTune): void {
    if (stage === null) {
      return
    }
    // why: The scales ride on this koi's own derived numbers rather than replacing them, so the playground moves the whole shoal while each fish keeps its identity.
    stage.koi.setTrim({
      amplitude: trim.amplitude * (tune.amplitudeScale ?? 1),
      frequency: trim.frequency * (tune.frequencyScale ?? 1),
      waveReach: tune.waveReach ?? trim.waveReach,
    })
    stage.koi.setPhysical({
      width: (phenotype.width ?? 1) * (tune.widthScale ?? 1),
      height: (phenotype.height ?? 1) * (tune.heightScale ?? 1),
    })
  }
</script>

<canvas class="koi-canvas" aria-hidden="true" bind:this={canvas}></canvas>

<div class="koi-card" hidden bind:this={card}>
  <span class="koi-card-name" style:color={palette.accent}>{profile.label}</span>
  <span class="koi-card-url">{url}</span>
</div>
