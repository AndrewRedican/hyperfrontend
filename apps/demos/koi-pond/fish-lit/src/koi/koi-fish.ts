/**
 * The Lit view: `<koi-fish>`, one custom element whose template is the koi's
 * stage — a transparent canvas the 3D fish renders onto, and its identity card.
 *
 * The element owns exactly what is declarative: the canvas, the card and its
 * text exist because the template says so, and that template renders once.
 * Everything that changes sixty times a second — the scene, the swim, the
 * card's placement — is written imperatively by the renderer the swim
 * controller drives, so no frame ever passes through a reactive update.
 *
 * Nothing is painted on `body`, on the host element, or on its shadow root —
 * the hostee SDK resets the page to transparent, and anything painted here
 * would blank the pond behind this frame for every koi below it. Only the fish
 * itself has colour.
 *
 * @module @hyperfrontend/demo-koi-fish-lit.element
 */
import type { PropertyDeclarations, TemplateResult } from 'lit'
import type { GlRenderer } from './koi-render'
import { FRAMEWORK_SITES } from '@hyperfrontend/demo-koi-lib'
import { LitElement, css, html } from 'lit'
import { styleMap } from 'lit/directives/style-map.js'
import { KoiSwimController } from '../runtime/koi-runtime'

/** The tag this koi registers itself under. */
const KOI_TAG = 'koi-fish'

/**
 * One koi, drawn in 3D onto the canvas this element's template declares.
 *
 * The element owns nothing but its template: the swimming, the animation
 * frame, the scene behind the canvas, and the channel to the pond host all
 * live in the reactive controller it attaches, so the component's own
 * lifecycle is what starts and stops the fish.
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
    .koi-card-site {
      font-size: 0.68rem;
      color: rgba(124, 192, 255, 0.85);
      font-family: ui-monospace, 'SFMono-Regular', monospace;
      text-decoration: underline;
      text-decoration-color: rgba(124, 192, 255, 0.45);
      text-underline-offset: 2px;
    }

    .koi-card-site {
      font-size: 0.64rem;
      font-family: inherit;
    }
  `

  // why: Properties are declared in Lit's static form rather than with `@property`, because this app's bundler lowers only the legacy decorator dialect and emits a standard decorator as syntax no engine can parse.
  /** The reactive properties a page may set on this koi. */
  static override properties: PropertyDeclarations = {
    appUrl: { type: String, attribute: 'app-url' },
  }

  /** The koi's brain, its animation frame, and its channel to the pond host. */
  readonly swim = new KoiSwimController(this)

  /** The URL of the app rendering this koi, shown on its identity card. */
  declare appUrl: string

  /** The GL factory behind the canvas, replaceable so specs can run headless. */
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer

  /** Adopts the page the koi is being drawn on as the identity it reveals. */
  constructor() {
    super()
    // why: The koi may be framed from a sub-path of the pond or served at its own origin's root, so the identity a visitor reads is resolved from wherever this page actually is.
    this.appUrl = new URL('.', window.location.href).href
  }

  /**
   * Draws the koi's stage: its canvas, and the identity card a visitor opens by holding the koi.
   *
   * @returns The template; the fish itself is rendered onto the canvas, never through it.
   */
  override render(): TemplateResult {
    const { framework, label, palette } = this.swim.profile
    return html`
      <canvas class="koi-canvas" aria-hidden="true"></canvas>
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
        <a class="koi-card-site" href=${FRAMEWORK_SITES[framework]} target="_blank" rel="noopener noreferrer">${label} website ↗</a>
      </div>
    `
  }

  /** Hands the rendered canvas and card to the controller, which builds the scene behind them. */
  protected override firstUpdated(): void {
    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>('canvas.koi-canvas')
    const card = this.renderRoot.querySelector<HTMLElement>('.koi-card')
    if (canvas === null || card === null) {
      throw new Error('missing stage: the koi template rendered without its canvas or card')
    }
    this.swim.attach(canvas, card, this.createGl)
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
