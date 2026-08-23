/**
 * The koi's swimming, packaged as a reactive controller.
 *
 * The controller composes the shared runtime rather than reimplementing any of
 * it: the element's own lifecycle is what births and retires the fish, spoken
 * through the controller callbacks Lit already gives every component. The
 * runtime keeps owning the animation frame, the renderer, and the channel to
 * the pond host; the controller only ties that lifetime to the host element's.
 */
import type { KoiRuntime, KoiRuntimeInit } from '@hyperfrontend/demo-koi-lib'
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { createKoiRuntime } from '@hyperfrontend/demo-koi-lib'

/**
 * Ties one shared koi runtime to a Lit component's lifecycle.
 *
 * @example Swimming a koi from an element
 * ```typescript
 * readonly swim = new KoiSwimController(this, () => ({ framework: 'lit', root: this, link: feature, rendererFactory }))
 * ```
 */
export class KoiSwimController implements ReactiveController {
  /** The runtime swimming the koi, or `null` before the host's first update and after it retires. */
  runtime: KoiRuntime | null = null

  /** Births the runtime's init the moment the host has rendered what the renderer builds on. */
  #born: () => KoiRuntimeInit

  /** Whether the koi has been taken down for good. */
  #retired = false

  /**
   * Registers the controller on its host.
   *
   * @param host - The component whose lifecycle swims the koi.
   * @param born - Builds the runtime's init once the host has rendered.
   */
  constructor(host: ReactiveControllerHost, born: () => KoiRuntimeInit) {
    this.#born = born
    host.addController(this)
  }

  /** Births the runtime after the host's first render, when the template the renderer builds on exists. */
  hostUpdated(): void {
    if (this.runtime === null && !this.#retired) {
      this.runtime = createKoiRuntime(this.#born())
    }
  }

  /** Takes the koi down for good when its host leaves the document. */
  hostDisconnected(): void {
    // why: Retirement is terminal on purpose: the contract stays wired to the feature handle for the page's life, so a re-added host could not be given a second runtime without double-driving the channel.
    this.#retired = true
    this.runtime?.dispose()
    this.runtime = null
  }
}
