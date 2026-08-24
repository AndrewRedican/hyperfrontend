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
   * the shared stage narrows its camera onto that box each frame, so the small
   * canvas paints pixel-identically what a full-viewport render would have put
   * there, at a fraction of the fill and memory. A koi outside the visible
   * window draws nothing at all.
   *
   * Svelte owns exactly what is declarative here: the canvas, the card and its
   * text exist because the template says so. Everything that changes sixty times
   * a second (the scene, the swim, the canvas placement) lives behind the
   * shared stage and is driven through the exported functions below, so no
   * frame ever passes through a rune.
   */
  import type { KoiCardDetails, KoiCardLink, KoiCardPanel, KoiCardText, KoiProfile, KoiState, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
  import type { GlRenderer, KoiStage as LibKoiStage } from '@hyperfrontend/demo-koi-lib/three'
  import { FRAMEWORK_SITES, cardAnchor, cardTransform, describeKoiCard, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'
  import { createKoiStage } from '@hyperfrontend/demo-koi-lib/three'

  /** How firmly the silhouette reads when the pointer is merely over the koi. */
  const HOVER_OUTLINE = 0.35

  /** How firmly the silhouette reads while a visitor holds the koi. */
  const HELD_OUTLINE = 1

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

  const { palette } = $derived(profile)

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

  // note: The stage handle is deliberately not a rune; the frame loop drives it sixty times a second, and nothing declarative reads it.
  let stage: LibKoiStage | null = null

  // note: The announced world is a plain variable for the same reason; only the imperative card math reads it.
  let current: PondEnvironment | undefined

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  function applyOutline(): void {
    stage?.setOutline(selected ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
  }

  $effect(() => {
    if (canvas === undefined) {
      return
    }
    // why: The shared stage owns the scene, camera, and animal behind the canvas; this component only decides the card.
    const built = createKoiStage(canvas, profile, pond, createGl)
    stage = built
    current = pond
    return () => {
      built.dispose()
      stage = null
    }
  })

  /**
   * Advances and redraws the koi from its current state.
   *
   * @param state - What the koi is doing right now.
   * @param dt - Seconds since the previous frame.
   */
  export function draw(state: KoiState, dt: number): void {
    stage?.draw(state, dt)
  }

  /**
   * Re-derives the camera and canvas from a new pond announcement.
   *
   * @param next - The world as the host most recently announced it.
   */
  export function setPond(next: PondEnvironment): void {
    current = next
    stage?.setPond(next)
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
    if (card === undefined || current === undefined) {
      return
    }
    // why: A hidden card measures nothing, so a nominal footprint keeps the window clamp honest on the very first placement.
    const at = cardAnchor(state, current, { width: card.offsetWidth || 200, height: card.offsetHeight || 64 })
    card.style.transform = cardTransform(at)
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
    if (!selected || current === undefined || card === undefined || cardUrl === undefined || cardSite === undefined || cardSource === undefined) {
      return null
    }
    const view = current.view
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
