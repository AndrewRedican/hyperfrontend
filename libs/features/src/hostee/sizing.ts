import type { DismissPayload, PresentPayload, ResolvedPosition, ViewportPayload } from '../shared/presentation'
import type { DisplayMode } from '../shared/types'
import { addStylesheet } from '@hyperfrontend/ui-utils/style'
import { resolveBoxPosition, resolveDynamicSize } from '../shared/presentation'

// note: The color-scheme pin pairs with the same pin on the host's iframe element — a mismatch would force an opaque canvas and kill the transparency both iframe modes depend on.
const BODY_RESET_CSS = 'html,body{margin:0;padding:0;background:transparent;color-scheme:normal}'

// note: Flex-alignment values per resolved axis alignment.
const FLEX_ALIGNMENT: Readonly<Record<ResolvedPosition['vertical'], string>> = { start: 'flex-start', center: 'center', end: 'flex-end' }

/**
 * Builds the dialog layout stylesheet: the body becomes the aligning flex
 * container placing the inner box per the agreed position.
 *
 * Geometry only: the dialog box's paint (background, border, shadow) belongs
 * to the feature author.
 *
 * @param position - The resolved per-axis alignments.
 * @returns The stylesheet text the body-level flex layout applies.
 */
function buildDialogLayoutCss(position: ResolvedPosition): string {
  return `body{display:flex;align-items:${FLEX_ALIGNMENT[position.vertical]};justify-content:${FLEX_ALIGNMENT[position.horizontal]};overflow:hidden}`
}

/**
 * Neutralizes the feature page's body so the embedded UI is neither clipped nor
 * padded: zeroes `html`/`body` margin and padding, forces the background
 * transparent so the host shows through, and pins `color-scheme: normal`.
 *
 * The stylesheet is appended when the feature initializes, so it outranks the
 * page's own `body` rules at equal specificity; feature backgrounds belong on
 * the root layout element.
 *
 * @example Resetting the body when a feature initializes
 * ```typescript
 * applyBodyReset()
 * ```
 */
export function applyBodyReset(): void {
  addStylesheet(BODY_RESET_CSS)
}

/**
 * Applies host-announced presentation to the feature document and reports
 * dismiss interactions back.
 *
 * Owned by the feature handle: `applyPresent` reacts to the host's one-time
 * presentation announcement (dialog layout, dismiss detection), `applyViewport`
 * keeps the document's root sized to the exact pixels the host reported, and
 * `stop` releases every listener and managed style.
 */
export interface PresentationApplier {
  /** Applies the host's presentation announcement; in dialog mode this lays out the inner dialog box and arms dismiss detection. */
  applyPresent(payload: PresentPayload): void
  /** Sizes the document root to exactly the host-reported pixel dimensions. */
  applyViewport(payload: ViewportPayload): void
  /** The announced display mode, or `null` before the announcement arrives. */
  mode(): DisplayMode | null
  /** Removes managed styles and listeners. */
  stop(): void
}

/**
 * Resolves the feature's root layout element for dialog-box sizing.
 *
 * @param root - The authored `root` option: a CSS selector or an element.
 * @returns A CSS selector for stylesheet-based sizing, or the element itself.
 */
function resolveRoot(root: string | HTMLElement | undefined): string | HTMLElement {
  // why: A selector is preferred — a stylesheet rule applies whenever the app renders its root, so the layout is immune to the announcement racing the app's first render.
  return root ?? 'body>:first-child'
}

/**
 * Creates the hostee-side presentation applier.
 *
 * @param root - The feature's root layout element or a CSS selector for it; defaults to the body's first element child.
 * @param sendDismiss - The control-channel send for dismiss signals.
 * @returns The applier the feature handle drives from control messages.
 *
 * @example Wiring the applier into a feature channel
 * ```typescript
 * const applier = createPresentationApplier(undefined, (payload) => channel.send(ControlType.Dismiss, payload))
 * ```
 */
export function createPresentationApplier(
  root: string | HTMLElement | undefined,
  sendDismiss: (payload: DismissPayload) => void
): PresentationApplier {
  let announced: DisplayMode | null = null
  let viewportStyle: [HTMLStyleElement, () => void] | null = null
  let dialogStyles: Array<() => void> = []
  let removeListeners: (() => void) | null = null

  const applyDialogBox = (payload: PresentPayload) => {
    const fallback = resolveDynamicSize(window.innerWidth, window.innerHeight)
    const width = payload.dialog?.width ?? fallback.width
    const height = payload.dialog?.height ?? fallback.height
    const target = resolveRoot(root)
    if (typeof target === 'string') {
      const [, remove] = addStylesheet(
        `${target}{width:${width}px;height:${height}px;max-width:100%;max-height:100%;box-sizing:border-box}`
      )
      dialogStyles.push(remove)
    } else {
      target.style.width = `${width}px`
      target.style.height = `${height}px`
      target.style.maxWidth = '100%'
      target.style.maxHeight = '100%'
      target.style.boxSizing = 'border-box'
      dialogStyles.push(() => {
        target.style.width = ''
        target.style.height = ''
        target.style.maxWidth = ''
        target.style.maxHeight = ''
        target.style.boxSizing = ''
      })
    }
    const [, removeLayout] = addStylesheet(buildDialogLayoutCss(resolveBoxPosition(payload.dialog?.position)))
    dialogStyles.push(removeLayout)
  }

  const armDismissDetection = () => {
    // why: With the box centered by the body, a pointer landing on the bare body or html element can only be the transparent backdrop; content inside the box (including portals and toasts, which are element children) never matches.
    const onPointerDown = (event: Event) => {
      if (event.target === document.body || event.target === document.documentElement) {
        sendDismiss({ source: 'backdrop' })
      }
    }
    // why: Focus lives inside the frame while the user interacts with the dialog, so the host's own Escape listener never hears it — the feature reports it across the boundary instead.
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        sendDismiss({ source: 'escape' })
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
    removeListeners = () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeydown)
    }
  }

  const applyViewport = (payload: ViewportPayload) => {
    const css = `html,body{width:${payload.width}px;height:${payload.height}px}`
    if (viewportStyle) {
      viewportStyle[0].textContent = css
    } else {
      viewportStyle = addStylesheet(css)
    }
  }

  return {
    applyPresent(payload) {
      announced = payload.mode
      // why: The announcement carries the frame's initial dimensions, so the canvas is sized before any separate viewport report could arrive.
      if (payload.viewport) {
        applyViewport(payload.viewport)
      }
      if (payload.mode === 'dialog' && removeListeners === null) {
        applyDialogBox(payload)
        armDismissDetection()
      }
    },
    applyViewport,
    mode() {
      return announced
    },
    stop() {
      announced = null
      if (viewportStyle) {
        viewportStyle[1]()
        viewportStyle = null
      }
      for (const remove of dialogStyles) {
        remove()
      }
      dialogStyles = []
      if (removeListeners) {
        removeListeners()
        removeListeners = null
      }
    },
  }
}

/**
 * Watches the feature's own window size, for the windowed display modes where
 * the browser window is the viewport and no host reports cross the boundary.
 *
 * @param onResize - Receives the window's inner size in pixels on every resize.
 * @returns A function that stops watching.
 *
 * @example Surfacing popup resizes to the feature author
 * ```typescript
 * const stop = watchWindowSize(({ width, height }) => emitter.emit('resize', { width, height }))
 * ```
 */
export function watchWindowSize(onResize: (size: ViewportPayload) => void): () => void {
  const onWindowResize = () => onResize({ width: window.innerWidth, height: window.innerHeight })
  window.addEventListener('resize', onWindowResize)
  return () => window.removeEventListener('resize', onWindowResize)
}
