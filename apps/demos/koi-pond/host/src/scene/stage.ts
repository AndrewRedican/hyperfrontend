/**
 * The pond's DOM: the bed underneath, one host-owned layer per koi, the surface
 * water above them all, the diagnostics canvas the interaction overlay draws
 * on above the surface, and the curtain that hides the staggered reveal.
 *
 * The host builds the koi containers itself rather than letting the SDK place
 * frames, because owning the containers is what lets it own the z-order — and
 * the z-order *is* the depth model. Every layer is `pointer-events: none`, so
 * the eight stacked full-viewport frames never intercept a press; the host runs
 * one normalized pointer stream and tells the fish what it found.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import { KOI_FRAMEWORKS, depthZIndex } from '@hyperfrontend/demo-koi-lib'

/** The elements the pond scene is built from. */
export interface PondStage {
  /** The pond root; everything paints inside it. */
  root: HTMLElement
  /** The still bed, painted once per resize. */
  floor: HTMLCanvasElement
  /** The moving water, painted every frame above every koi. */
  surface: HTMLCanvasElement
  /** The diagnostics layer the interaction overlay draws on, above the water. */
  interactions: HTMLCanvasElement
  /** The cover held over the scene until every koi has connected. */
  curtain: HTMLElement
  /** One host-owned container per koi, keyed by framework slug. */
  layers: ReadonlyMap<KoiFramework, HTMLElement>
}

/**
 * Builds the pond's DOM inside a root element.
 *
 * @param root - The `#pond` element from the page.
 * @returns The stage.
 *
 * @example Raising the pond
 * ```typescript
 * const stage = createStage(document.querySelector('#pond'))
 * paintFloor(stage.floor, width, height, devicePixelRatio)
 * ```
 */
export function createStage(root: HTMLElement): PondStage {
  const floor = document.createElement('canvas')
  floor.id = 'floor'
  floor.setAttribute('aria-hidden', 'true')
  root.append(floor)

  const layers = new Map<KoiFramework, HTMLElement>()
  for (const framework of KOI_FRAMEWORKS) {
    const layer = document.createElement('div')
    layer.className = 'koi-layer'
    layer.dataset['fish'] = framework
    root.append(layer)
    layers.set(framework, layer)
  }

  const surface = document.createElement('canvas')
  surface.id = 'surface'
  surface.setAttribute('aria-hidden', 'true')
  root.append(surface)

  // why: The overlay annotates what is under the water, so it paints above the surface — a trace dimmed by caustics would defeat the point of asking for it.
  const interactions = document.createElement('canvas')
  interactions.id = 'interactions'
  interactions.setAttribute('aria-hidden', 'true')
  root.append(interactions)

  const curtain = document.createElement('div')
  curtain.id = 'curtain'
  curtain.dataset['open'] = 'false'
  curtain.innerHTML = '<p class="curtain-note">the pond is settling</p>'
  root.append(curtain)

  return { root, floor, surface, interactions, curtain, layers }
}

/**
 * Restacks a koi's layer for the depth level it now holds.
 *
 * @param stage - The pond stage.
 * @param framework - Which koi moved.
 * @param level - Its depth level; fractional levels round to a whole layer.
 */
export function setLayerDepth(stage: PondStage, framework: KoiFramework, level: number): void {
  const layer = stage.layers.get(framework)
  if (layer === undefined) {
    return
  }
  layer.style.zIndex = String(depthZIndex(level))
}

/**
 * Lifts the curtain once every koi has connected.
 *
 * @param stage - The pond stage.
 * @param open - `true` to reveal the pond, `false` to cover it again.
 */
export function setCurtain(stage: PondStage, open: boolean): void {
  stage.curtain.dataset['open'] = open ? 'true' : 'false'
}
