/**
 * The pond's DOM: the bed underneath, one host-owned layer per koi, the surface
 * water above them all, the diagnostics canvas the interaction overlay draws
 * on above the surface, and the curtain that hides the staggered reveal.
 *
 * The host builds the koi containers itself rather than letting the SDK place
 * frames, because owning the containers is what lets it own the z-order — and
 * the z-order *is* the depth model. Every layer is `pointer-events: none`, so
 * the stacked full-viewport frames never intercept a press; the host runs
 * one normalized pointer stream and tells the fish what it found. Owning them
 * is also what lets the host stand one down: a frame whose session has died is
 * hidden rather than left to paint whatever the browser puts in its place.
 *
 * Layers come and go with the roster: one is raised for each instance the
 * scene opens and torn down when that instance leaves, so the DOM carries
 * exactly the koi that exist rather than a fixed rank of eight.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'
import type { KoiInstanceId } from './instance-id'
import { depthZIndex } from '@hyperfrontend/demo-koi-lib'

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
  /** One host-owned container per living koi instance. */
  layers: Map<KoiInstanceId, HTMLElement>
}

/**
 * Builds the pond's DOM inside a root element.
 *
 * @param root - The `#pond` element from the page.
 * @returns The stage, with no koi layers yet; {@link addLayer} raises them.
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

  return { root, floor, surface, interactions, curtain, layers: new Map() }
}

/**
 * Raises the host-owned layer for one koi instance.
 *
 * @param stage - The pond stage.
 * @param id - The instance the layer belongs to.
 * @param framework - The framework rendering it, published on the element for styling and diagnostics.
 * @returns The layer, already in the document.
 */
export function addLayer(stage: PondStage, id: KoiInstanceId, framework: KoiFramework): HTMLElement {
  const existing = stage.layers.get(id)
  if (existing !== undefined) {
    return existing
  }
  const layer = document.createElement('div')
  layer.className = 'koi-layer'
  layer.dataset['fish'] = framework
  layer.dataset['instance'] = id
  // why: Layers sit between the bed and the surface water in DOM order, so a koi can never paint over the water it swims under whatever z-index its depth grants.
  stage.surface.before(layer)
  stage.layers.set(id, layer)
  return layer
}

/**
 * Tears down one koi instance's layer.
 *
 * @param stage - The pond stage.
 * @param id - The instance that left the scene.
 */
export function removeLayer(stage: PondStage, id: KoiInstanceId): void {
  const layer = stage.layers.get(id)
  if (layer === undefined) {
    return
  }
  layer.remove()
  stage.layers.delete(id)
}

/**
 * Restacks a koi's layer for the depth level it now holds.
 *
 * @param stage - The pond stage.
 * @param id - Which koi moved.
 * @param level - Its depth level; fractional levels round to a whole layer.
 */
export function setLayerDepth(stage: PondStage, id: KoiInstanceId, level: number): void {
  const layer = stage.layers.get(id)
  if (layer === undefined) {
    return
  }
  layer.style.zIndex = String(depthZIndex(level))
}

/**
 * Shows or hides one koi's layer.
 *
 * A koi whose session has stopped answering is not in the scene any more, and
 * its frame is no longer the host's to trust: a document the browser has given
 * up on is painted with the browser's own placeholder, which is opaque and
 * knows nothing about water. Standing the layer down is what keeps a lost koi
 * from leaving a hole in the pond; its own reveal on the next handshake brings
 * it back.
 *
 * @param stage - The pond stage.
 * @param id - Which koi.
 * @param present - `true` while its session is answering.
 */
export function setLayerPresent(stage: PondStage, id: KoiInstanceId, present: boolean): void {
  const layer = stage.layers.get(id)
  if (layer === undefined) {
    return
  }
  layer.style.opacity = present ? '' : '0'
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
