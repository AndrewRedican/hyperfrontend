/**
 * The Lit view: `<koi-fish>`, one custom element whose template is the koi's
 * identity card, over a canvas the renderer mounts for the 3D fish.
 *
 * The element owns exactly what is declarative: the card and its text exist
 * because the template says so, and that template renders once. Everything
 * that changes sixty times a second lives behind the shared runtime a
 * reactive controller ties to this element's lifecycle: the runtime owns the
 * animation frame and the channel to the pond host, and drives the renderer
 * that writes the scene imperatively, so no frame ever passes through a
 * reactive update.
 *
 * Nothing is painted on `body`, on the host element, or on its shadow root:
 * the hostee SDK resets the page to transparent, and anything painted here
 * would blank the pond behind this frame for every koi below it. Only the
 * fish itself has colour.
 *
 * @module @hyperfrontend/demo-koi-fish-lit.element
 */
import type { KoiRuntime } from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer } from '@hyperfrontend/demo-koi-lib/three'
import type { PropertyDeclarations, TemplateResult } from 'lit'
import { FRAMEWORK_SITES, koiProfile, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'
import { LitElement, css, html } from 'lit'
import { styleMap } from 'lit/directives/style-map.js'
import { feature } from '../hyperfrontend.feature'
import { createKoiRenderer } from './koi-render'
import { KoiSwimController } from './koi-swim-controller'

/** The tag this koi registers itself under. */
const KOI_TAG = 'koi-fish'

/** Which framework this app renders. */
const FRAMEWORK = 'lit'

// why: Label and palette bind to the framework slug, never the seed, so the card text this template renders stays true even when the host deals the runtime a variant seed.
/** Everything about this koi that never changes; the runtime derives the same canonical profile for itself. */
const KOI_PROFILE = koiProfile(FRAMEWORK)

/**
 * One koi, drawn in 3D onto the canvas its renderer mounts behind this
 * element's template.
 *
 * The element owns nothing but its template: the swimming, the animation
 * frame, the scene behind the canvas, and the channel to the pond host all
 * live in the shared runtime its controller births once the template has
 * rendered, so the component's own lifecycle is what starts and stops the
 * fish.
 *
 * @example Putting a koi on a page
 * ```html
 * <koi-fish></koi-fish>
 * ```
 */
export class KoiFishElement extends LitElement {
  /**
   * The koi's own styles.
   *
   * The shadow root paints no background of its own: this frame stacks over
   * the pond, so the water has to show straight through everything but the
   * fish.
   */
  static override styles = css`
    :host {
      position: relative;
      display: block;
      height: 100%;
      overflow: hidden;
      font-family:
        ui-sans-serif,
        system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      color: #e8f3ef;
    }

    /* why: The canvas covers only the koi's own frame box — the renderer sizes it and slides it with a transform, so the compositor carries a fish-sized layer instead of a viewport-sized one. */
    .koi-canvas {
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      will-change: transform;
    }

    /* why: Hover identity is the fish's own chrome — the host hit-tests and notifies, but every koi draws its own card in its own framework. */
    /* why: The card's display: grid below outranks the UA stylesheet's hidden-attribute rule, so the attribute needs honouring explicitly or the card never hides. */
    .koi-card[hidden] {
      display: none;
    }

    .koi-card {
      position: absolute;
      top: 0;
      left: 0;
      display: grid;
      gap: 0.15rem;
      padding: 0.42rem 0.6rem;
      border: 1px solid rgba(232, 243, 239, 0.16);
      border-radius: 10px;
      background: rgba(9, 24, 22, 0.86);
      backdrop-filter: blur(6px);
      pointer-events: none;
      white-space: nowrap;
    }

    .koi-card-name {
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* why: The variety names the animal the way the label names the app - one quiet word tying the pattern on the body to the framework driving it. */
    .koi-card-variety {
      font-size: 0.62rem;
      font-weight: 400;
      font-style: italic;
      color: rgba(232, 243, 239, 0.5);
    }

    .koi-card-line {
      font-size: 0.64rem;
      color: rgba(232, 243, 239, 0.68);
      letter-spacing: 0.01em;
    }

    /* why: Styled as the links they are, but this frame never receives the pointer - the host floats real anchors over the rectangles the outline reports. */
    .koi-card-url,
    .koi-card-site,
    .koi-card-source {
      font-size: 0.68rem;
      color: rgba(124, 192, 255, 0.85);
      font-family: ui-monospace, 'SFMono-Regular', monospace;
      text-decoration: underline;
      text-decoration-color: rgba(124, 192, 255, 0.45);
      text-underline-offset: 2px;
    }

    .koi-card-site,
    .koi-card-source {
      font-size: 0.64rem;
      font-family: inherit;
    }
  `

  // why: Properties are declared in Lit's static form rather than with `@property`, because this app's bundler lowers only the legacy decorator dialect and emits a standard decorator as syntax no engine can parse.
  /** The reactive properties a page may set on this koi. */
  static override properties: PropertyDeclarations = {
    appUrl: { type: String, attribute: 'app-url' },
  }

  /** The URL of the app rendering this koi, shown on its identity card. */
  declare appUrl: string

  /** The GL factory behind the canvas, replaceable so specs can run headless; set it before the element first renders. */
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer

  // why: The runtime builds its renderer the moment it is born and the renderer needs the card this template declares, so the controller births the koi on the element's first update rather than at upgrade.
  /** The controller tying the shared runtime's lifetime to this element's. */
  readonly #swim = new KoiSwimController(this, () => ({
    framework: FRAMEWORK,
    root: this,
    link: feature,
    // why: The renderer works in the shadow root behind this element, with the element's own GL seam threaded through so specs can run headless.
    rendererFactory: (_root, profile, _url, pond) => createKoiRenderer(this.renderRoot, profile, pond, this.createGl),
    // why: Whether a host embeds this app comes from the SDK handle, never from the window above this frame.
    hosted: feature.hosted,
  }))

  /** Adopts the page the koi is being drawn on as the identity it reveals. */
  constructor() {
    super()
    // why: The koi may be framed from a sub-path of the pond or served at its own origin's root, so the identity a visitor reads is resolved from wherever this page actually is.
    this.appUrl = new URL('.', window.location.href).href
  }

  /**
   * The koi's brain, its animation frame, and its channel to the pond host.
   *
   * @returns The runtime, or `null` before the element's first update.
   */
  get swim(): KoiRuntime | null {
    return this.#swim.runtime
  }

  /**
   * Draws the identity card a visitor opens by holding the koi; the renderer mounts the canvas behind it.
   *
   * @returns The template; the fish itself is rendered onto the canvas, never through it.
   */
  override render(): TemplateResult {
    const { label, palette } = KOI_PROFILE
    return html`
      <div class="koi-card" hidden>
        <span class="koi-card-name">
          <!-- why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app. -->
          <span class="koi-card-title" style=${styleMap({ color: palette.accent })}>${label}</span>
          <span class="koi-card-variety">${palette.pattern}</span>
        </span>
        <span class="koi-card-line koi-card-state"></span>
        <!-- why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. -->
        <a class="koi-card-url" href=${this.appUrl} target="_blank" rel="noopener noreferrer">${this.appUrl}</a>
        <span class="koi-card-line koi-card-runtime"></span>
        <span class="koi-card-line koi-card-memory"></span>
        <span class="koi-card-line koi-card-event" hidden></span>
        <a class="koi-card-site" href=${FRAMEWORK_SITES[FRAMEWORK]} target="_blank" rel="noopener noreferrer">${label} website ↗</a>
        <!-- why: The demo's claim is checkable — the card links straight to this very app's implementation in the repository. -->
        <a class="koi-card-source" href=${koiSourceUrl(FRAMEWORK)} target="_blank" rel="noopener noreferrer">App source ↗</a>
      </div>
    `
  }
}

customElements.define(KOI_TAG, KoiFishElement)

declare global {
  /** Lets `document.querySelector('koi-fish')` come back typed. */
  interface HTMLElementTagNameMap {
    /** The koi this app renders. */
    'koi-fish': KoiFishElement
  }
}
