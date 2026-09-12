import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Class the stylesheet draws the zoom affordance for. */
export const EXPANDABLE_CLASS = 'expandable-image'

/**
 * How much larger than its drawn width an image has to be before expanding
 * it shows the reader anything. A quarter again is where a screenshot's
 * text starts to be legible at native size and not at the column's.
 */
export const EXPANDABLE_RATIO = 1.25

/** Narrower than this at native size, an image is an icon or a badge, not a picture to inspect. */
export const EXPANDABLE_MIN_WIDTH = 400

/** What the lightbox needs to show an image at native size. */
export interface ExpandableImage {
  /** The URL the browser actually loaded */
  src: string
  /** The alternative text, which names the dialog */
  alt: string
  /** Native width in CSS pixels */
  width: number
  /** Native height in CSS pixels */
  height: number
}

/**
 * Whether an image carries detail its drawn size is hiding.
 *
 * @param naturalWidth - The image's native width
 * @param drawnWidth - The width it is drawn at
 * @returns True when expanding would show more than the page does
 *
 * @example A 1600px screenshot drawn in a 700px column
 * ```typescript
 * hasHiddenDetail(1600, 700) // true
 * hasHiddenDetail(720, 700) // false
 * hasHiddenDetail(320, 100) // false, it is an icon
 * ```
 */
export function hasHiddenDetail(naturalWidth: number, drawnWidth: number): boolean {
  return naturalWidth >= EXPANDABLE_MIN_WIDTH && drawnWidth > 0 && naturalWidth >= drawnWidth * EXPANDABLE_RATIO
}

/**
 * Whether an image is one the site should offer to expand.
 *
 * Only pictures inside rendered prose qualify, so a logo in the header or a
 * still on a demo card is left alone; an image that is already a link goes
 * where the link goes rather than opening here; and an image that has not
 * loaded yet, or has no more detail than the page shows, is not offered.
 *
 * @param image - The image being judged
 * @returns True when a click should open it in the lightbox
 */
export function isExpandable(image: HTMLImageElement): boolean {
  if (!image.complete || image.naturalWidth === 0) return false
  if (image.closest('a') !== null) return false
  if (image.closest('.prose') === null) return false
  return hasHiddenDetail(image.naturalWidth, image.clientWidth)
}

/**
 * What the lightbox needs, read off an image.
 *
 * @param image - The image being opened
 * @returns Its URL, name and native size
 */
export function describeImage(image: HTMLImageElement): ExpandableImage {
  return { src: image.currentSrc || image.src, alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }
}

/**
 * Mark every qualifying image in the document, and keep marking as images
 * load and as pages render new ones.
 *
 * One observer for the whole document rather than one per prose container,
 * because prose is rendered three different ways on this site and none of
 * them should have to remember to opt in. An image is judged when it has
 * loaded, so a marked image is one whose native size is known; the mark is
 * the class the stylesheet draws the affordance for, plus a tab stop so the
 * keyboard reaches it.
 *
 * @param onOpen - Called with the image to open when a marked image is activated
 * @returns A function that stops observing and removes every mark
 *
 * @example
 * ```typescript
 * useEffect(() => attachExpandableImages(setOpen), [])
 * ```
 */
export function attachExpandableImages(onOpen: (image: ExpandableImage) => void): () => void {
  const marked = createSet<HTMLImageElement>()

  const mark = (image: HTMLImageElement): void => {
    const expandable = isExpandable(image)
    if (expandable && !marked.has(image)) {
      marked.add(image)
      image.classList.add(EXPANDABLE_CLASS)
      image.tabIndex = 0
      image.setAttribute('aria-haspopup', 'dialog')
    } else if (!expandable && marked.has(image)) {
      unmark(image)
    }
  }

  const unmark = (image: HTMLImageElement): void => {
    marked.delete(image)
    image.classList.remove(EXPANDABLE_CLASS)
    image.removeAttribute('tabindex')
    image.removeAttribute('aria-haspopup')
  }

  const scan = (root: ParentNode): void => {
    for (const image of root.querySelectorAll('img')) mark(image)
  }

  const onLoad = (event: Event): void => {
    if (event.target instanceof HTMLImageElement) mark(event.target)
  }

  const onClick = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLImageElement) || !marked.has(target)) return
    event.preventDefault()
    onOpen(describeImage(target))
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLImageElement) || !marked.has(target)) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen(describeImage(target))
  }

  // why: a resize can put an image at native size, where there is nothing to expand, or shrink it back below it
  const onResize = (): void => {
    for (const image of [...marked]) mark(image)
    scan(document)
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLImageElement) mark(node)
        else if (node instanceof Element) scan(node)
      }
    }
  })

  scan(document)
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('load', onLoad, true)
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize, { passive: true })

  return () => {
    observer.disconnect()
    document.removeEventListener('load', onLoad, true)
    document.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('resize', onResize)
    for (const image of [...marked]) unmark(image)
  }
}
