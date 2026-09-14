'use client'

import type { DiagramSize, ViewportPoint, ViewportTransform } from '@/lib/diagram-viewport'
import type { ReactNode } from 'react'
import {
  FIT_PADDING,
  ZOOM_STEP,
  centerTransform,
  clampPan,
  clampScale,
  extractNaturalSize,
  fitScale,
  prepareNaturalSvg,
  wheelZoomFactor,
  zoomAtPoint,
} from '@/lib/diagram-viewport'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { hypot, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** A serialized SVG, sized from its own root tag. */
export interface SvgMedia {
  /** Discriminator */
  kind: 'svg'
  /** The markup */
  svg: string
}

/** A raster image, shown at its native resolution. */
export interface ImageMedia {
  /** Discriminator */
  kind: 'image'
  /** The image URL */
  src: string
  /** The image's alternative text, read as the dialog's name */
  alt: string
  /** Native width in CSS pixels */
  width: number
  /** Native height in CSS pixels */
  height: number
}

/** Anything React can draw, laid out in a box of a stated size. */
export interface NodeMedia {
  /** Discriminator */
  kind: 'node'
  /** The content */
  node: ReactNode
  /** The box's width in CSS pixels */
  width: number
  /** The box's height in CSS pixels */
  height: number
}

/** What the lightbox can show. */
export type LightboxMedia = SvgMedia | ImageMedia | NodeMedia

/** A medium laid out for the canvas: its natural size, and what to draw at that size. */
interface LaidOutMedia {
  /** The box the medium occupies before any zoom */
  naturalSize: DiagramSize
  /** The drawing */
  content: ReactNode
}

/** Props for {@link MediaLightbox}. */
export interface MediaLightboxProps {
  /** What to show */
  media: LightboxMedia
  /** What a screen reader calls the dialog */
  label: string
  /** Called when the lightbox should close */
  onClose: () => void
  /** Whether the lightbox is open */
  isOpen: boolean
}

/** Pixels the view pans per arrow-key press. */
const KEY_PAN_STEP = 48

/** Maximum milliseconds between taps for a double-tap. */
const DOUBLE_TAP_MS = 400

/** Maximum pixels between taps for a double-tap. */
const DOUBLE_TAP_RADIUS = 30

/** Pixels of travel beyond which a press counts as a drag instead of a tap. */
const TAP_SLOP = 8

/**
 * Measures a container's inner size in CSS pixels.
 * @param element - The container element
 * @returns The client width and height
 */
function containerSizeOf(element: HTMLElement): DiagramSize {
  return { width: element.clientWidth, height: element.clientHeight }
}

/** A completed tap: when and where the pointer went up, in client coordinates. */
interface TapSample {
  /** Timestamp of the tap in performance.now() milliseconds. */
  time: number
  /** Tap x in client coordinates. */
  x: number
  /** Tap y in client coordinates. */
  y: number
}

/** A two-pointer pinch sample: finger distance plus midpoint in client coordinates. */
interface PinchSample {
  /** Distance between the two pointers in pixels. */
  distance: number
  /** Midpoint x in client coordinates. */
  x: number
  /** Midpoint y in client coordinates. */
  y: number
}

/**
 * Reads the current pinch geometry from the active pointer positions.
 * @param pointers - Active pointers keyed by pointer id, in client coordinates
 * @returns The pinch sample, or null unless exactly two pointers are down
 */
function readPinch(pointers: Map<number, ViewportPoint>): PinchSample | null {
  const points: ViewportPoint[] = []
  pointers.forEach((point) => points.push(point))
  if (points.length !== 2) return null
  const [a, b] = points
  return { distance: hypot(b.x - a.x, b.y - a.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Cycles Tab focus within the dialog so keyboard focus cannot escape while it is open.
 * @param event - The Tab keydown event
 * @param dialog - The dialog root element
 */
function trapFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (!dialog) return
  const focusables = dialog.querySelectorAll<HTMLElement>('button:not([disabled])')
  if (focusables.length === 0) return
  const first = focusables.item(0)
  const last = focusables.item(focusables.length - 1)
  const active = document.activeElement
  const inside = active instanceof HTMLElement && dialog.contains(active)
  if (event.shiftKey && (!inside || active === first)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (!inside || active === last)) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * The one full-screen viewer every piece of media on the site expands into:
 * a diagram, a still that is larger than the column it sits in, a chart
 * drawn small in a grid. Uses a portal to escape parent stacking contexts.
 *
 * Whatever the media is, it is laid out at its natural size inside a canvas
 * that can be zoomed and panned: toolbar buttons (zoom in/out, fit, 100%),
 * click-drag panning, wheel panning, ctrl/meta+wheel and two-finger pinch
 * zooming anchored on the cursor, double-click stepwise zoom (shift inverts),
 * and keyboard shortcuts (+/- zoom, 0 resets, f fits, arrows pan, Escape
 * closes). Focus moves into the dialog on open, is trapped while open, and
 * returns to the trigger on close. One viewer rather than one per kind of
 * media, so a reader who has learned to inspect a diagram has learned to
 * inspect everything.
 * @param props - See {@link MediaLightboxProps}.
 * @param props.media - What to show
 * @param props.label - What a screen reader calls the dialog
 * @param props.onClose - Called when the lightbox should close
 * @param props.isOpen - Whether the lightbox is open
 * @returns The lightbox, or null when closed or not yet mounted
 * @example Expanding a diagram
 * ```tsx
 * <MediaLightbox media={{ kind: 'svg', svg }} label="Expanded diagram" isOpen={open} onClose={() => setOpen(false)} />
 * ```
 */
export function MediaLightbox({ media, label, onClose, isOpen }: MediaLightboxProps) {
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<ViewportTransform>({ scale: 1, tx: 0, ty: 0 })
  const [dragging, setDragging] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const viewRef = useRef(view)
  const fittedRef = useRef(true)
  const pointersRef = useRef(createMap<number, ViewportPoint>())
  const pinchRef = useRef<PinchSample | null>(null)
  const tapRef = useRef<TapSample | null>(null)
  const gestureRef = useRef({ x: 0, y: 0, moved: false, multi: false })

  // why: The wrapper is transform-positioned at natural pixel size, so every kind of media needs explicit dimensions rather than a max-width cap
  const { naturalSize, content } = useMemo((): LaidOutMedia => {
    if (media.kind === 'svg') {
      // note: Mermaid always emits a viewBox; the fallback size only guards malformed input
      const size = extractNaturalSize(media.svg) ?? { width: 600, height: 400 }
      return {
        naturalSize: size,
        content: <div className="[&>svg]:block" dangerouslySetInnerHTML={{ __html: prepareNaturalSvg(media.svg, size) }} />,
      }
    }
    if (media.kind === 'image') {
      return {
        naturalSize: { width: media.width, height: media.height },
        content: (
          <img src={media.src} alt={media.alt} width={media.width} height={media.height} className="block max-w-none" draggable={false} />
        ),
      }
    }
    return { naturalSize: { width: media.width, height: media.height }, content: media.node }
  }, [media])

  // how: viewRef mirrors the committed state synchronously so gesture handlers can compose several transform updates per event without stale reads
  const applyView = useCallback(
    (next: ViewportTransform, fitted: boolean) => {
      const canvas = canvasRef.current
      const clamped = canvas ? clampPan(next, naturalSize, containerSizeOf(canvas)) : next
      viewRef.current = clamped
      fittedRef.current = fitted
      setView(clamped)
    },
    [naturalSize]
  )

  const applyFit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const container = containerSizeOf(canvas)
    applyView(centerTransform(naturalSize, container, fitScale(naturalSize, container, FIT_PADDING)), true)
  }, [naturalSize, applyView])

  const applyActualSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    applyView(centerTransform(naturalSize, containerSizeOf(canvas), 1), false)
  }, [naturalSize, applyView])

  const zoomAt = useCallback(
    (point: ViewportPoint, nextScale: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const fit = fitScale(naturalSize, containerSizeOf(canvas), FIT_PADDING)
      applyView(zoomAtPoint(viewRef.current, point, clampScale(nextScale, fit)), false)
    },
    [naturalSize, applyView]
  )

  const zoomStep = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      zoomAt({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, viewRef.current.scale * factor)
    },
    [zoomAt]
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const current = viewRef.current
      applyView({ scale: current.scale, tx: current.tx + dx, ty: current.ty + dy }, false)
    },
    [applyView]
  )

  // why: A callback ref fits during commit (before paint) without useLayoutEffect's server-render warning, and refits when the SVG changes
  const attachCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      canvasRef.current = node
      if (node) applyFit()
    },
    [applyFit]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // why: Lock body scroll when open to prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  // why: Move focus into the dialog on open and hand it back to the trigger on close
  useEffect(() => {
    if (!isOpen || !mounted) return
    const previous = document.activeElement
    closeButtonRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [isOpen, mounted])

  // why: Keyboard shortcuts live on the document so they work regardless of focus position
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'Tab') {
        trapFocus(event, backdropRef.current)
        return
      }
      // why: Leave modified keys (browser zoom, tab switching) to the browser
      if (event.ctrlKey || event.metaKey || event.altKey) return
      switch (event.key) {
        case '+':
        case '=':
          zoomStep(ZOOM_STEP)
          break
        case '-':
        case '_':
          zoomStep(1 / ZOOM_STEP)
          break
        case '0':
          applyActualSize()
          break
        case 'f':
        case 'F':
          applyFit()
          break
        case 'ArrowLeft':
          panBy(KEY_PAN_STEP, 0)
          break
        case 'ArrowRight':
          panBy(-KEY_PAN_STEP, 0)
          break
        case 'ArrowUp':
          panBy(0, KEY_PAN_STEP)
          break
        case 'ArrowDown':
          panBy(0, -KEY_PAN_STEP)
          break
        default:
          return
      }
      event.preventDefault()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, zoomStep, applyActualSize, applyFit, panBy])

  // why: React's onWheel can bind passively, so preventDefault needs a manual non-passive listener
  useEffect(() => {
    if (!isOpen || !mounted) return
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      // note: Trackpad pinches arrive as ctrl+wheel, so this branch covers both gestures
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect()
        zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewRef.current.scale * wheelZoomFactor(event.deltaY))
        return
      }
      panBy(-event.deltaX, -event.deltaY)
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [isOpen, mounted, zoomAt, panBy])

  // why: Refit on resize only while still fitted; otherwise just re-clamp the user's transform
  useEffect(() => {
    if (!isOpen || !mounted) return
    const handleResize = () => {
      if (fittedRef.current) applyFit()
      else applyView(viewRef.current, false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, mounted, applyFit, applyView])

  // why: Handle click outside content for intuitive dismissal
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    pinchRef.current = readPinch(pointersRef.current)
    if (pointersRef.current.size === 1) {
      gestureRef.current = { x: event.clientX, y: event.clientY, moved: false, multi: false }
    } else {
      gestureRef.current.multi = true
    }
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 1) {
      if (hypot(event.clientX - gestureRef.current.x, event.clientY - gestureRef.current.y) > TAP_SLOP) {
        gestureRef.current.moved = true
      }
      panBy(event.clientX - previous.x, event.clientY - previous.y)
      return
    }
    const pinch = readPinch(pointers)
    const lastPinch = pinchRef.current
    pinchRef.current = pinch
    if (!pinch || !lastPinch || lastPinch.distance === 0) return
    // how: Rescale around the live midpoint, then follow its travel so a moving pinch pans and zooms in one gesture
    const rect = event.currentTarget.getBoundingClientRect()
    zoomAt({ x: pinch.x - rect.left, y: pinch.y - rect.top }, viewRef.current.scale * (pinch.distance / lastPinch.distance))
    panBy(pinch.x - lastPinch.x, pinch.y - lastPinch.y)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId)
    pinchRef.current = readPinch(pointersRef.current)
    if (pointersRef.current.size > 0) return
    setDragging(false)
    // why: Pointer capture suppresses native click/dblclick synthesis in Chromium, so double-click zoom is detected manually
    // note: Manual detection also gives touch a double-tap zoom
    const gesture = gestureRef.current
    if (gesture.moved || gesture.multi || event.type === 'pointercancel') {
      tapRef.current = null
      return
    }
    const now = performance.now()
    const lastTap = tapRef.current
    const isDoubleTap =
      lastTap !== null &&
      now - lastTap.time < DOUBLE_TAP_MS &&
      hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_RADIUS
    if (!isDoubleTap) {
      tapRef.current = { time: now, x: event.clientX, y: event.clientY }
      return
    }
    tapRef.current = null
    const rect = event.currentTarget.getBoundingClientRect()
    const factor = event.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP
    zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewRef.current.scale * factor)
  }

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-describedby="media-lightbox-hint"
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition-colors hover:bg-white hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Close expanded view"
      >
        <CloseIcon className="h-6 w-6" />
      </button>

      {/* Zoom toolbar */}
      <div
        role="group"
        aria-label="Zoom controls"
        className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/90 px-2 py-1 shadow-lg dark:bg-slate-800/90"
      >
        <ToolbarButton label="Zoom out" onClick={() => zoomStep(1 / ZOOM_STEP)}>
          <MinusIcon className="h-4 w-4" />
        </ToolbarButton>
        <span aria-live="polite" className="w-12 select-none text-center font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
          {round(view.scale * 100)}%
        </span>
        <ToolbarButton label="Zoom in" onClick={() => zoomStep(ZOOM_STEP)}>
          <PlusIcon className="h-4 w-4" />
        </ToolbarButton>
        <span aria-hidden className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <ToolbarButton label="Fit to viewport" onClick={applyFit}>
          <span className="px-1 font-mono text-xs">Fit</span>
        </ToolbarButton>
        <ToolbarButton label="Reset zoom to 100%" onClick={applyActualSize}>
          <span className="px-1 font-mono text-xs">100%</span>
        </ToolbarButton>
      </div>

      {/* Hint text */}
      <div
        id="media-lightbox-hint"
        className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-4 py-2 text-sm text-white/80"
      >
        Drag to pan · <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd>+scroll to zoom ·{' '}
        <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">Esc</kbd> to close
      </div>

      {/* The canvas the media is zoomed and panned inside */}
      <div
        ref={attachCanvas}
        className={`relative h-[80vh] w-[85vw] touch-none select-none overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: naturalSize.width,
            height: naturalSize.height,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

type ToolbarButtonProps = {
  /** Accessible name announced for the control */
  label: string
  /** Invoked when the button is activated */
  onClick: () => void
  /** Visible button content */
  children: React.ReactNode
}

function ToolbarButton({ label, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 min-w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {children}
    </button>
  )
}

type CloseIconProps = { className?: string }

function CloseIcon({ className }: CloseIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PlusIcon({ className }: CloseIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function MinusIcon({ className }: CloseIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  )
}
