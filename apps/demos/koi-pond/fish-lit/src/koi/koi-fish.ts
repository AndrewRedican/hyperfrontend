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

    .koi-canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
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
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .koi-card-url {
      font-size: 0.68rem;
      color: rgba(232, 243, 239, 0.62);
      font-family: ui-monospace, 'SFMono-Regular', monospace;
    }
  `

  // why: Properties are declared in Lit's static form rather than with `@property`, because this app's bundler lowers only the legacy decorator dialect and emits a standard decorator as syntax no engine can parse.
  /** The reactive properties a page may set on this koi. */
  static override properties: PropertyDeclarations = {
    appUrl: { type: String, attribute: 'app-url' },
  }

  /** The koi's brain, its animation frame, and its channel to the pond host. */
  readonly swim = new KoiSwimController(this)

  /** The URL of the app rendering this koi, revealed on hover. */
  declare appUrl: string

  /** The GL factory behind the canvas, replaceable so specs can run headless. */
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer

  /** Adopts the page the koi is being drawn on as the identity it reveals. */
  constructor() {
    super()
    // why: The frame mounts from an explicit index.html URL, but the identity a visitor reads should be the app's clean home.
    this.appUrl = new URL('.', window.location.href).href
  }

  /**
   * Draws the koi's stage: its canvas, and the card the host reveals on hover.
   *
   * @returns The template; the fish itself is rendered onto the canvas, never through it.
   */
  override render(): TemplateResult {
    const { label, palette } = this.swim.profile
    return html`
      <canvas class="koi-canvas" aria-hidden="true"></canvas>
      <div class="koi-card" hidden>
        <span class="koi-card-name" style=${styleMap({ color: palette.accent })}>${label}</span>
        <span class="koi-card-url">${this.appUrl}</span>
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
