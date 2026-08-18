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
  import type { KoiCardDetails, KoiCardLink, KoiCardPanel, KoiCardText, KoiFrameBox, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
  import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
  import type { KoiState } from './koi-motion'
  import type { GlRenderer } from './koi-render'
  import { FRAMEWORK_SITES, POND_VIEW, describeKoiCard, koiFrameBox, koiSeed, koiSourceUrl, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
  import { createKoi, createLighting, createPondView, fitPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
  import { Scene } from 'three'

  /** How far the frame box's edge may drift from the fitted buffer before a re-fit, as a fraction. */
  const REFIT_DRIFT = 0.1

  /** How firmly the silhouette reads when the pointer is merely over the koi. */
  const HOVER_OUTLINE = 0.35

  /** How firmly the silhouette reads while a visitor holds the koi. */
  const HELD_OUTLINE = 1

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

  /**
   * A card element's rectangle lifted into pond space.
   *
   * @param element - The element to measure.
   * @param view - The visible window whose origin lifts client space into pond space.
   * @returns The pond-space rectangle.
   */
  function rectOf(element: HTMLElement, view: PondEnvironment['view']): KoiCardLink {
    // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
    const rect = element.getBoundingClientRect()
    return { x: rect.left + view.x, y: rect.top + view.y, width: rect.width, height: rect.height }
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
  let cardUrl = $state<HTMLAnchorElement>()
  let cardSite = $state<HTMLAnchorElement>()
  let cardSource = $state<HTMLAnchorElement>()

  /** Whether a visitor is holding this koi, which is what shows its identity card. */
  let selected = $state(false)

  /** The card's inspector rows, rewritten from the live facts while the koi is held. */
  let rows = $state<KoiCardText | null>(null)

  /** The official website of the framework driving this app, linked from the card. */
  const siteUrl = $derived(FRAMEWORK_SITES[profile.framework])

  /** Where this very app's implementation lives in the repository, linked from the card. */
  const sourceUrl = $derived(koiSourceUrl(profile.framework))

  /** Whether the host's pointer is over this koi; it only shades the silhouette, so it never touches the template. */
  let hovered = false

  // note: The stage is deliberately not a rune — every field mutates once per frame, and nothing declarative reads it.
  let stage: Stage | null = null

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  function applyOutline(): void {
    stage?.koi.setOutline(selected ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
  }

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
      // why: The phenotype is the profile's own many-levered build — width, belly, head, fins — so the shoal reads as related but individually recognisable animals rather than one mesh at eight scales.
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
      // why: The speed memory must track through skipped frames too, or re-entering the view lands the whole offscreen speed change as a single-frame acceleration spike that convulses the body.
      stage.lastSpeed = state.speed / stage.bodyPx
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
    stage.view.placeKoi(stage.koi.object, state.position, state.heading, state.length)
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
   * Marks whether the host's pointer is over this koi.
   *
   * Hover only says "this is selectable": the silhouette reads softly and
   * nothing else changes — the identity card belongs to selection.
   *
   * @param next - Whether the pointer is over this koi.
   */
  export function setHovered(next: boolean): void {
    hovered = next
    applyOutline()
  }

  /**
   * Marks whether a visitor is holding this koi.
   *
   * Holding traces the full silhouette and keeps the identity card open until
   * release, whatever the pointer does meanwhile.
   *
   * @param next - Whether the koi is held.
   */
  export function setSelected(next: boolean): void {
    // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
    selected = next
    applyOutline()
  }

  /**
   * Rewrites the card's live inspector rows.
   *
   * @param details - The koi's live facts.
   */
  export function updateCard(details: KoiCardDetails): void {
    rows = describeKoiCard(details)
  }

  /**
   * Positions the identity card beside the koi, clamped into the visible window.
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

  /**
   * Where the card and its two links currently sit, in pond space.
   *
   * This frame is pointer-transparent, so nothing drawn here can be clicked
   * directly; the host floats real anchors over the reported rectangles and an
   * inert shield over the frame.
   *
   * @returns The card's geometry, or `null` while the card is hidden.
   */
  export function cardRects(): KoiCardPanel | null {
    if (stage === null || !selected || card === undefined || cardUrl === undefined || cardSite === undefined || cardSource === undefined) {
      return null
    }
    const view = stage.pond.view
    return { frame: rectOf(card, view), app: rectOf(cardUrl, view), site: rectOf(cardSite, view), source: rectOf(cardSource, view) }
  }
</script>

<canvas class="koi-canvas" aria-hidden="true" bind:this={canvas}></canvas>

<div class="koi-card" hidden={!selected} bind:this={card}>
  <span class="koi-card-name">
    <!-- why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app. -->
    <span class="koi-card-title" style:color={palette.accent}>{profile.label}</span>
    <span class="koi-card-variety">{palette.pattern}</span>
  </span>
  <span class="koi-card-line koi-card-state">{rows?.state}</span>
  <!-- why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. -->
  <a class="koi-card-url" href={url} target="_blank" rel="noopener noreferrer" bind:this={cardUrl}>{url}</a>
  <span class="koi-card-line koi-card-runtime">{rows?.runtime}</span>
  <span class="koi-card-line koi-card-memory">{rows?.memory}</span>
  <span class="koi-card-line koi-card-event" hidden={rows === null || rows.event === null}>{rows?.event}</span>
  <a class="koi-card-site" href={siteUrl} target="_blank" rel="noopener noreferrer" bind:this={cardSite}>{profile.label} website ↗</a>
  <!-- why: The demo's claim is checkable — the card links straight to this very app's implementation in the repository. -->
  <a class="koi-card-source" href={sourceUrl} target="_blank" rel="noopener noreferrer" bind:this={cardSource}>App source ↗</a>
</div>
