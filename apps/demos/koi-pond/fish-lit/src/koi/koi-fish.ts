/**
 * `<koi-fish>` — the element this app is.
 *
 * A frame and nothing in it. The project boots, the browser upgrades the tag
 * `index.html` already carries, and the koi is rendered here once the shared
 * model is wired in.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything else.
 *
 * @module @hyperfrontend/demo-koi-fish-lit.element
 */
import { LitElement, css, html } from 'lit'

/** The tag this element registers itself under. */
const KOI_TAG = 'koi-fish'

/** The frame one koi swims in. */
export class KoiFishElement extends LitElement {
  // why: The hostee SDK resets the page to transparent, so the element paints nothing of its own — anything opaque here would blank the pond behind this frame.
  /** The element's own box; the koi brings its own colour. */
  static override readonly styles = css`
    :host {
      display: block;
      position: relative;
      height: 100%;
      overflow: hidden;
    }

    .koi-frame {
      position: absolute;
      inset: 0;
    }
  `

  /**
   * Renders the frame.
   *
   * @returns The box the koi will swim in.
   */
  override render() {
    return html`<div class="koi-frame" part="frame"></div>`
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
