'use client'

import type { AccentRGB } from '@/components/tesseract-background'
import { useTheme } from '@/components/theme-provider'
import { createKoiSketch } from '@/lib/koi-sketch'
import { createKoiWander } from '@/lib/koi-wander'
import { useEffect, useRef } from 'react'
import { cos, exp, floor, max, min, round, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import {
  cancelAnimationFrame,
  clearInterval,
  requestAnimationFrame,
  setInterval,
} from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** A surface the koi can light, with where it sits in the band. */
interface LitSurface {
  /** The element that takes the lit class */
  element: HTMLElement
  /** Left edge, in band coordinates */
  left: number
  /** Top edge, in band coordinates */
  top: number
  /** Right edge, in band coordinates */
  right: number
  /** Bottom edge, in band coordinates */
  bottom: number
}

/** Props for {@link AmbientKoi}. */
interface AmbientKoiProps {
  /** The staged demo's accent, which every line of the koi is drawn in */
  accent: AccentRGB
}

/** The one koi's seed: the same fish on every visit. */
const KOI_SEED = 7

/** How long the koi takes to surface once the reader has scrolled to it, in seconds. */
const SURFACE_S = 2.5

/** How often the surfaces the koi can light are re-measured, in milliseconds. */
const SURVEY_MS = 1500

/** Seconds the drawing's colour takes to close most of the gap to a new stage hue: the same unhurried pace as the chrome's transition. */
const HUE_RESPONSE = 0.55

/** The longest the koi is drawn, in CSS pixels. */
const LENGTH = { max: 200, min: 150, coarse: 132 } as const

/**
 * One koi, sketched in a few lines, swimming behind everything below the hero.
 *
 * The drawing is the pond's own koi: its lofted body and its fins, bent along
 * the same posed spine, reduced to the rings and rays a pencil would keep. It
 * lives on a canvas that rides with the viewport inside the water, so a band
 * three screens tall costs one screen of pixels, and the loop runs only while
 * that band is on screen, the tab is visible, and the reader has scrolled
 * meaningfully past the hero. The koi lives in the band's coordinates and the
 * canvas works out where it is each frame, so it swims under cards that stay
 * exactly where they were. Every line is drawn in the staged demo's accent,
 * eased toward each new hue as the stage turns. Passing under a surface that
 * lights for the pointer lights it the same way, by the one class the
 * stylesheet treats as hover; nothing is focused, nothing is clicked, and the
 * pointer is never involved.
 *
 * Under reduced motion there is no koi. On a coarse pointer it is drawn a
 * little smaller and every other frame.
 * @param props - See {@link AmbientKoiProps}.
 * @param props.accent - The staged demo's accent, which every line of the koi is drawn in
 * @returns The canvas layer.
 */
export function AmbientKoi({ accent }: AmbientKoiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const paletteRef = useRef({ accent, dark: resolvedTheme === 'dark' })

  useEffect(() => {
    paletteRef.current = { accent, dark: resolvedTheme === 'dark' }
  }, [accent, resolvedTheme])

  useEffect(() => {
    const canvas = canvasRef.current
    const band = canvas?.closest<HTMLElement>('.light-well')
    if (!canvas || !band) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const coarse = window.matchMedia('(pointer: coarse)').matches
    const sketch = createKoiSketch()
    const wander = createKoiWander(KOI_SEED)

    let frame = 0
    let last = 0
    let tick = 0
    let presence = 0
    let armed = false
    let visible = false
    let awake = !document.hidden
    let width = 0
    let height = 0
    let fishLength: number = LENGTH.max
    let lit: HTMLElement | null = null
    let surfaces: LitSurface[] = []
    const hue: [number, number, number] = stageHue()

    /**
     * The staged accent for the current theme, as channels.
     * @returns Red, green and blue
     */
    function stageHue(): [number, number, number] {
      const palette = paletteRef.current
      const parts = (palette.dark ? palette.accent.dark : palette.accent.light).split(',').map((channel) => Number(channel.trim()))
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
    }

    const measure = () => {
      const dpr = min(window.devicePixelRatio || 1, coarse ? 1.5 : 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = floor(width * dpr)
      canvas.height = floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      fishLength = coarse ? LENGTH.coarse : min(LENGTH.max, max(LENGTH.min, band.clientWidth * 0.15))
    }

    const survey = () => {
      const bandRect = band.getBoundingClientRect()
      surfaces = [...band.querySelectorAll<HTMLElement>('[data-koi-lit]')].map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          element,
          left: rect.left - bandRect.left,
          top: rect.top - bandRect.top,
          right: rect.right - bandRect.left,
          bottom: rect.bottom - bandRect.top,
        }
      })
    }

    const light = (x: number, y: number) => {
      const under = surfaces.find((surface) => x >= surface.left && x <= surface.right && y >= surface.top && y <= surface.bottom)
      const next = under?.element ?? null
      if (next === lit) return
      lit?.classList.remove('is-lit')
      next?.classList.add('is-lit')
      lit = next
    }

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      tick += 1
      // why: on a touch screen half the frames are enough for an animal this slow, and the battery is the reader's
      if (coarse && tick % 2 === 1) return
      const dt = last ? min((now - last) / 1000, 0.05) : 0
      last = now
      const bandRect = band.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      const view = {
        x: canvasRect.left - bandRect.left,
        y: canvasRect.top - bandRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      }
      const state = wander.step(dt, { width: bandRect.width, height: bandRect.height, view, fishLength })
      sketch.advance(dt, state.speed, state.turnRate)
      presence = min(1, presence + dt / SURFACE_S)
      // why: the hue chases the staged demo's accent frame by frame rather than snapping, so a rotation recolours the fish at the pace the lattice and the water take
      const target = stageHue()
      const ease = 1 - exp(-dt / HUE_RESPONSE)
      for (let channel = 0; channel < 3; channel += 1)
        hue[channel] = (hue[channel] ?? 0) + ((target[channel] ?? 0) - (hue[channel] ?? 0)) * ease
      ctx.clearRect(0, 0, width, height)
      sketch.draw(ctx, state.x - view.x, state.y - view.y, state.heading, fishLength, {
        color: `${round(hue[0])} ${round(hue[1])} ${round(hue[2])}`,
        alpha: presence,
      })
      if (tick % 4 === 0) {
        // how: the lit point sits a third of a body behind the nose, roughly under the animal's shoulders, so a surface lights when the fish is under it rather than when its nose touches the edge
        light(state.x - cos(state.heading) * fishLength * 0.3, state.y - sin(state.heading) * fishLength * 0.3)
      }
    }

    const start = () => {
      if (frame || !armed || !visible || !awake) return
      last = 0
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      if (!frame) return
      cancelAnimationFrame(frame)
      frame = 0
    }

    const arm = () => {
      // why: the koi surfaces once the band's top has risen past the middle of the viewport, which is about half a hero of scrolling: present when the reader arrives, never in the way of the hero
      if (band.getBoundingClientRect().top >= window.innerHeight * 0.5) return
      armed = true
      window.removeEventListener('scroll', arm)
      start()
    }

    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false
        if (visible) start()
        else stop()
      },
      { threshold: 0 }
    )
    intersection.observe(band)
    const onVisibility = () => {
      awake = !document.hidden
      if (awake) start()
      else stop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const resize = new ResizeObserver(() => {
      measure()
      survey()
    })
    resize.observe(band)
    resize.observe(canvas)
    window.addEventListener('scroll', arm, { passive: true })
    const surveyTimer = setInterval(survey, SURVEY_MS)
    measure()
    survey()
    arm()

    return () => {
      stop()
      intersection.disconnect()
      resize.disconnect()
      clearInterval(surveyTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', arm)
      lit?.classList.remove('is-lit')
    }
  }, [])

  return (
    <div aria-hidden="true" className="koi-layer">
      <canvas ref={canvasRef} className="koi-layer__canvas" />
    </div>
  )
}
