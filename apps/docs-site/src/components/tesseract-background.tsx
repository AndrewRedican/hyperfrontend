'use client'

import type { Point2D, Point3D, ProjectedVertex, RainDrop, Splash, TopFace, Vertex4D } from './tesseract-geometry'
import { useTheme } from '@/components/theme-provider'
import { useEffect, useRef } from 'react'
import {
  abs,
  atan2,
  ceil,
  cos,
  floor,
  log,
  max,
  min,
  PI,
  pow,
  random,
  sin,
  sqrt,
} from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import {
  CAMERA_3D,
  CAMERA_4D,
  cubeEdges,
  cubeFaces,
  cubeVertices3D,
  darkPalette,
  DIVE_RATIO,
  edges,
  faces,
  lightPalette,
  MAX_SPLASHES,
  NOMINAL_RAIN_SPEED,
  SPLASH_CHANCE,
  TUNNEL_F_MAX,
  TUNNEL_F_MIN,
  TUNNEL_FADE_SPAN,
  TUNNEL_RATIO,
  TUNNEL_TWIST,
  vertices4D,
} from './tesseract-geometry'

/** Visual intensity of the backdrop — how much it competes for attention. */
type Intensity = 'subtle' | 'normal'

/**
 * Which dive renderer is on screen. `dive` is the nested self-similar tesseract
 * zoom (copies fall inward, turning inside-out); `tunnel` is the exact
 * shared-boundary cube chain. A background click swaps between them.
 */
type Flavour = 'dive' | 'tunnel'

/** Props for {@link TesseractBackground} */
type TesseractBackgroundProps = {
  /** Extra classes for the positioning wrapper. Defaults to filling the parent. */
  className?: string
  /** Overall opacity weighting; `subtle` recedes further into the page. */
  intensity?: Intensity
  /**
   * When true the structure zooms endlessly *into* the hypercube. Two flavours
   * exist: a nested self-similar tesseract zoom (copies falling inward, turning
   * inside-out) and an exact shared-boundary cube tunnel. Clicking inert
   * background reconfigures between them — the current flavour collapses to a
   * point as the other blooms back out (the rain and ambiance keep running).
   * Evokes the Russian-doll lazy-loading metaphor. When false a single tesseract
   * holds a static depth while still rotating gently.
   */
  dive?: boolean
  /** When true the cursor steers the viewing angle and hover-highlights nearby surfaces. */
  interactive?: boolean
  /** When true a subtle angled purple-rain layer falls in front of and behind the lattice. */
  rain?: boolean
}

/**
 * Ambient four-dimensional structure rendered to a canvas behind page content.
 *
 * Visualises micro-frontend composition: translucent facets are isolated
 * sandboxes, the lattice of edges and nodes is the shell that locks them
 * together, and the optional infinite dive mirrors nested lazy-loaded modules.
 * The canvas is non-interactive (`pointer-events: none`) so clicks reach the UI
 * beneath it, and it honours `prefers-reduced-motion` by holding a single frame.
 * @param props Appearance and behaviour overrides.
 * @param props.className
 * @param props.intensity
 * @param props.dive
 * @param props.interactive
 * @param props.rain
 * @returns A positioned canvas element.
 */
export function TesseractBackground({
  className,
  intensity = 'normal',
  dive = false,
  interactive = true,
  rain = true,
}: TesseractBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // why: the active flavour lives in a ref so a theme/prop change that restarts the effect doesn't snap the backdrop back to the default renderer mid-view.
  const flavourRef = useRef<Flavour>('dive')
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const isDark = resolvedTheme === 'dark'
    const palette = isDark ? darkPalette : lightPalette
    // why: 0.85 factor lifts overall transparency ~15% so the immersive lattice stays a backdrop.
    const intensityScale = (intensity === 'subtle' ? 0.55 : 1) * 0.85
    // why: the cursor steers the viewing angle instead of dragging the structure — the lattice stays centred while up/down/left/right tilt our perspective around it, on top of the tesseract's own independent fold. ±0.42rad (~24°) at the canvas edges.
    const LOOK_RANGE = 0.42
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let rectLeft = 0
    let rectTop = 0

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      rectLeft = rect.left
      rectTop = rect.top
      width = rect.width
      height = rect.height
      const dpr = window.devicePixelRatio || 1
      canvas.width = floor(width * dpr)
      canvas.height = floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    measure()

    // how: smoothed view angles that ease toward the cursor-set target, plus the raw cursor position for hover focus.
    let lookYaw = 0
    let lookPitch = 0
    let targetLookYaw = 0
    let targetLookPitch = 0
    let localMouseX = -9999
    let localMouseY = -9999

    let angleX = 0
    let angleY = 0
    let angleW = 0
    let diveProgress = 1

    // how: flavour-swap state — while `swapping`, `swapProgress` eases 0→1 as the outgoing flavour collapses to a point and the incoming one blooms back out; only the hypercube lattice is scaled, so rain and ambiance keep running untouched.
    let flavour: Flavour = flavourRef.current
    let swapping = false
    let swapProgress = 0
    let swapFrom: Flavour = flavour
    let swapTo: Flavour = flavour
    // why: per-frame step sets the swap duration (~1.3s at 60fps); cubic smoothstep gives the ease-in/ease-out.
    const SWAP_STEP = 1 / 80
    const smoothstep = (t: number) => t * t * (3 - 2 * t)

    const onMouseMove = (event: MouseEvent) => {
      localMouseX = event.clientX - rectLeft
      localMouseY = event.clientY - rectTop
      // how: normalised cursor offset from centre maps left/right to yaw and up/down to pitch, tilting the side under the cursor toward the viewer.
      const nx = max(-0.5, min(0.5, localMouseX / width - 0.5))
      const ny = max(-0.5, min(0.5, localMouseY / height - 0.5))
      targetLookYaw = nx * 2 * LOOK_RANGE
      targetLookPitch = ny * 2 * LOOK_RANGE
    }

    const edgeFade = (x: number, y: number) => {
      const dx = abs(x - width / 2) / (width / 2)
      const dy = abs(y - height / 2) / (height / 2)
      const distanceToEdge = max(dx, dy)
      // why: fade boundary sits well outside the viewport (1.4→3.0) so the lattice surrounds the viewer (inside the tesseract) rather than reading as a small centred object.
      if (distanceToEdge < 1.4) return 1
      return max(0, 1 - (distanceToEdge - 1.4) / 1.6)
    }

    const rotate = (p: Vertex4D): Vertex4D => {
      let { x, y, z, w } = p
      // how: one rotation in the x-w plane and a slower one in y-w fold 4D into view.
      let c = cos(angleW)
      let s = sin(angleW)
      ;[x, w] = [x * c - w * s, x * s + w * c]
      c = cos(angleW * 0.4)
      s = sin(angleW * 0.4)
      ;[y, w] = [y * c - w * s, y * s + w * c]
      c = cos(angleX)
      s = sin(angleX)
      ;[x, y] = [x * c - y * s, x * s + y * c]
      c = cos(angleY)
      s = sin(angleY)
      ;[x, z] = [x * c - z * s, x * s + z * c]
      // how: the cursor-driven view tilt turns the already-folded structure about its own centre — yaw about the vertical axis, then pitch about the horizontal — so perspective moves while the lattice stays put.
      c = cos(lookYaw)
      s = sin(lookYaw)
      ;[x, z] = [x * c - z * s, x * s + z * c]
      c = cos(lookPitch)
      s = sin(lookPitch)
      ;[y, z] = [y * c - z * s, y * s + z * c]
      return { x, y, z, w }
    }

    const rainEnabled = rain && !prefersReducedMotion
    // how: violet streak colour plus a brighter splash tint, tuned per theme for contrast.
    const rainRGB = isDark ? '167, 139, 250' : '124, 58, 237'
    const splashRGB = isDark ? '196, 181, 253' : '139, 92, 246'

    // why: safe random + Box–Muller normal draw (the same approach random-generator-utils' randomGaussian uses) gives a natural common distribution without pulling in an extra dependency.
    const rand = (lo: number, hi: number) => random() * (hi - lo) + lo
    const gauss = (mean: number, std: number) => mean + sqrt(-2 * log(random() || 1e-9)) * cos(2 * PI * random()) * std
    const clamp = (v: number, lo: number, hi: number) => max(lo, min(hi, v))

    const resetDrop = (drop: RainDrop, fromTop: boolean) => {
      drop.x = rand(-0.1 * width, 1.1 * width)
      drop.y = fromTop ? rand(-0.25 * height, 0) : rand(0, height)
      // why: per-drop angle and speed jitter make streaks arrive offset rather than as parallel straight lines; slightly wider speed spread (std 1.4) gives a touch more variety between drips and downpours.
      const speed = clamp(gauss(3.2, 1.4), 1.1, 8)
      drop.vy = speed
      drop.vx = speed * (0.28 + gauss(0, 0.13))
      drop.tail = clamp(gauss(7, 4), 1.5, 14)
      // why: baseline skews high-transparency; gaussian gives a few brighter drops without a hard origin.
      drop.alpha = clamp(gauss(0.18, 0.12), 0.03, 0.5)
      // why: a freshly spawned drop is clear of every facet; its per-traversal splash chance is computed on the next entry.
      drop.onSurface = false
    }

    const dropCount = rainEnabled ? floor(clamp((width * height) / 14000, 18, intensity === 'subtle' ? 55 : 110)) : 0
    const drops: Array<RainDrop> = []
    for (let i = 0; i < dropCount; i++) {
      const drop = { x: 0, y: 0, vx: 0, vy: 0, tail: 0, alpha: 0, onSurface: false, splashP: 0, front: random() < 0.55 }
      resetDrop(drop, false)
      drops.push(drop)
    }

    const topFaces: Array<TopFace> = []
    let splashes: Array<Splash> = []

    const updateRain = () => {
      for (const drop of drops) {
        drop.x += drop.vx
        drop.y += drop.vy
        if (drop.y - drop.vy * drop.tail > height + 12 || drop.x > width * 1.15) resetDrop(drop, true)
      }
    }

    const drawRain = (front: boolean) => {
      for (const drop of drops) {
        if (drop.front !== front) continue
        const tailX = drop.x - drop.vx * drop.tail
        const tailY = drop.y - drop.vy * drop.tail
        // why: back drops dimmed so the lattice still reads in front of them.
        const a = (front ? drop.alpha : drop.alpha * 0.6) * intensityScale
        const gradient = ctx.createLinearGradient(drop.x, drop.y, tailX, tailY)
        gradient.addColorStop(0, `rgba(${rainRGB}, ${a})`)
        gradient.addColorStop(1, `rgba(${rainRGB}, 0)`)
        ctx.strokeStyle = gradient
        // how: brighter (closer) drops carry a slightly heavier line trace and a larger head point.
        ctx.lineWidth = (front ? 0.7 : 0.5) + drop.alpha * 1.1
        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(tailX, tailY)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(drop.x, drop.y, (front ? 0.7 : 0.5) + drop.alpha * (front ? 2.6 : 1.4), 0, PI * 2)
        ctx.fillStyle = `rgba(${rainRGB}, ${min(0.85, a * 1.6)})`
        ctx.fill()
      }
    }

    const pointInQuad = (px: number, py: number, poly: Array<Point2D>) => {
      let inside = false
      for (let i = 0, j = 3; i < 4; j = i++) {
        const xi = poly[i].x
        const yi = poly[i].y
        const xj = poly[j].x
        const yj = poly[j].y
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }

    const spawnSplash = (drop: RainDrop, face: TopFace) => {
      // how: orient the bloom along the facet's longer edge so it traces the notional surface.
      const e1x = face.poly[1].x - face.poly[0].x
      const e1y = face.poly[1].y - face.poly[0].y
      const e2x = face.poly[3].x - face.poly[0].x
      const e2y = face.poly[3].y - face.poly[0].y
      const len1 = sqrt(e1x * e1x + e1y * e1y)
      const len2 = sqrt(e2x * e2x + e2y * e2y)
      const useFirst = len1 >= len2
      const speed = sqrt(drop.vx * drop.vx + drop.vy * drop.vy) || 1
      // how: faster drops strike harder, so the bloom's magnitude grows with speed (slower drips stay small) relative to the nominal fall speed.
      const speedFactor = clamp(speed / NOMINAL_RAIN_SPEED, 0.7, 1.8)
      const baseRx = (useFirst ? len1 : len2) * 0.3
      const baseRy = (useFirst ? len2 : len1) * 0.16
      splashes.push({
        x: drop.x,
        y: drop.y,
        life: 1,
        rx: clamp(baseRx * speedFactor, 8, 70),
        ry: clamp(baseRy * speedFactor, 3, 30),
        angle: useFirst ? atan2(e1y, e1x) : atan2(e2y, e2x),
        // how: unit impact direction lets the bloom lean toward where the drop was heading.
        ix: drop.vx / speed,
        iy: drop.vy / speed,
        strength: clamp(drop.alpha * face.upness * 2, 0.05, 0.32),
        // why: snapshot the facet corners at contact so the splash stays clipped to that surface as it plays out.
        poly: [
          { x: face.poly[0].x, y: face.poly[0].y },
          { x: face.poly[1].x, y: face.poly[1].y },
          { x: face.poly[2].x, y: face.poly[2].y },
          { x: face.poly[3].x, y: face.poly[3].y },
        ],
      })
    }

    const processHits = () => {
      if (topFaces.length === 0) return
      for (const drop of drops) {
        if (!drop.front) continue
        let hitFace: TopFace | null = null
        for (const face of topFaces) {
          if (pointInQuad(drop.x, drop.y, face.poly)) {
            hitFace = face
            break
          }
        }
        // why: clear of every facet — the next entry begins a fresh traversal with its own splash budget.
        if (!hitFace) {
          drop.onSurface = false
          continue
        }
        // why: on first contact, divide the ~30% per-traversal chance across the frames the drop is expected to spend crossing this facet, so the splash can land anywhere along the surface rather than only at the entry edge. p_frame = 1 - (1 - P)^(1/frames).
        if (!drop.onSurface) {
          drop.onSurface = true
          const ys = [hitFace.poly[0].y, hitFace.poly[1].y, hitFace.poly[2].y, hitFace.poly[3].y]
          const faceH = max(...ys) - min(...ys)
          const frames = max(1, faceH / max(drop.vy, 0.001))
          drop.splashP = 1 - pow(1 - SPLASH_CHANCE, 1 / frames)
        }
        // why: roll each frame the drop is over the surface; a splashing drop blooms and recycles from the top.
        if (random() < drop.splashP && splashes.length < MAX_SPLASHES) {
          spawnSplash(drop, hitFace)
          resetDrop(drop, true)
        }
      }
    }

    const drawSplashes = () => {
      splashes = splashes.filter((s) => s.life > 0)
      for (const s of splashes) {
        const a = s.strength * s.life * intensityScale
        // how: the bloom expands slightly as it fades, like a ripple settling on the surface.
        const grow = 1 + (1 - s.life) * 0.6
        const ca = cos(s.angle)
        const sa = sin(s.angle)
        // how: rotate the impact vector into the ellipse's local frame to offset the bright focus toward the strike.
        const focusX = (s.ix * ca + s.iy * sa) * 0.4
        const focusY = (-s.ix * sa + s.iy * ca) * 0.4

        ctx.save()
        // why: clip every part of the splash to the contacted facet so nothing spills past its edges — the full ellipse only shows when it fits inside.
        ctx.beginPath()
        ctx.moveTo(s.poly[0].x, s.poly[0].y)
        ctx.lineTo(s.poly[1].x, s.poly[1].y)
        ctx.lineTo(s.poly[2].x, s.poly[2].y)
        ctx.lineTo(s.poly[3].x, s.poly[3].y)
        ctx.closePath()
        ctx.clip()

        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.angle)
        ctx.scale(s.rx * grow, s.ry * grow)
        const gradient = ctx.createRadialGradient(focusX, focusY, 0, 0, 0, 1)
        gradient.addColorStop(0, `rgba(${splashRGB}, ${a})`)
        gradient.addColorStop(1, `rgba(${splashRGB}, 0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(0, 0, 1, 0, PI * 2)
        ctx.fill()
        ctx.restore()

        // how: two concentric elliptical rings radiate from the contact as minute expansion waves, the second lagging the first.
        const progress = 1 - s.life
        for (let ring = 0; ring < 2; ring++) {
          const phase = clamp(progress - ring * 0.2, 0, 1)
          if (phase <= 0) continue
          const ringScale = 0.25 + phase * 1.15
          ctx.beginPath()
          ctx.ellipse(s.x, s.y, s.rx * ringScale, s.ry * ringScale, s.angle, 0, PI * 2)
          ctx.strokeStyle = `rgba(${splashRGB}, ${s.strength * (1 - phase) * intensityScale * 0.9})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        ctx.restore()
        s.life -= 0.045
      }
    }

    // how: top-centre directional light gives the abstract lattice tangible weight; shared by the static tesseract and every cube of the dive tunnel.
    const lightX = 0
    const lightY = -1
    const lightZ = 0.5

    const drawFaceQuad = (
      p0: ProjectedVertex,
      p1: ProjectedVertex,
      p2: ProjectedVertex,
      p3: ProjectedVertex,
      opacityMultiplier: number,
      collectTop: boolean
    ) => {
      const avgFade = (p0.fade + p1.fade + p2.fade + p3.fade) / 4
      if (avgFade <= 0) return
      const avgDepth = (p0.depth + p1.depth + p2.depth + p3.depth) / 4
      const v1x = p1.x3 - p0.x3
      const v1y = p1.y3 - p0.y3
      const v1z = p1.z3 - p0.z3
      const v2x = p2.x3 - p0.x3
      const v2y = p2.y3 - p0.y3
      const v2z = p2.z3 - p0.z3
      let nx = v1y * v2z - v1z * v2y
      let ny = v1z * v2x - v1x * v2z
      let nz = v1x * v2y - v1y * v2x
      const len = sqrt(nx * nx + ny * ny + nz * nz)
      let light = 0.5
      if (len > 0) {
        nx /= len
        ny /= len
        nz /= len
        light = (nx * lightX + ny * lightY + nz * lightZ + 1) / 2
      }
      // why: only top-lit, wide landscape trapezoids (width ≥ 1.5× height — a 2:3 height:width ratio) read as up-facing surfaces a drop can splash across.
      if (collectTop && avgFade > 0.15 && light > 0.5) {
        const faceW = max(p0.x, p1.x, p2.x, p3.x) - min(p0.x, p1.x, p2.x, p3.x)
        const faceH = max(p0.y, p1.y, p2.y, p3.y) - min(p0.y, p1.y, p2.y, p3.y)
        if (faceH > 0 && faceW >= faceH * 1.5) topFaces.push({ poly: [p0, p1, p2, p3], upness: light })
      }
      const midX = (p0.x + p1.x + p2.x + p3.x) / 4
      const midY = (p0.y + p1.y + p2.y + p3.y) / 4
      const cursorDistance = sqrt((midX - localMouseX) ** 2 + (midY - localMouseY) ** 2)
      const highlight = interactive && cursorDistance < 150 ? (1 - cursorDistance / 150) * 0.12 : 0
      const depthAlpha = ((avgDepth + 1) / 2) * 0.025 + 0.005
      let alpha = depthAlpha * avgFade * opacityMultiplier * intensityScale
      if (alpha <= 0) return
      alpha = min(0.4, alpha + highlight * opacityMultiplier)
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.lineTo(p3.x, p3.y)
      ctx.closePath()
      // how: lit facets trend toward bright cyan-white (dark) or saturated blue (light).
      const shade = floor(light * 40)
      ctx.fillStyle = isDark
        ? `rgba(${shade}, ${180 + shade}, ${210 + shade}, ${alpha})`
        : `rgba(${37 + shade}, ${99 + shade}, 235, ${alpha})`
      ctx.fill()
    }

    const drawEdgeSeg = (p1: ProjectedVertex, p2: ProjectedVertex, opacityMultiplier: number) => {
      const avgFade = (p1.fade + p2.fade) / 2
      if (avgFade <= 0) return
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const cursorDistance = sqrt((midX - localMouseX) ** 2 + (midY - localMouseY) ** 2)
      const highlight = interactive && cursorDistance < 140 ? (1 - cursorDistance / 140) * 0.3 : 0
      const avgDepth = (p1.depth + p2.depth) / 2
      const depthAlpha = ((avgDepth + 1) / 2) * 0.22 + 0.05
      let alpha = depthAlpha * avgFade * opacityMultiplier * intensityScale
      if (alpha <= 0) return
      alpha = min(1, alpha + highlight)
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = highlight > 0 ? `rgba(${palette.lineHi}, ${alpha})` : `rgba(${palette.line}, ${alpha})`
      ctx.lineWidth = highlight > 0 ? 1.3 : 0.9
      ctx.stroke()
    }

    const drawNodeDot = (p: ProjectedVertex, opacityMultiplier: number) => {
      if (p.fade <= 0) return
      const cursorDistance = sqrt((p.x - localMouseX) ** 2 + (p.y - localMouseY) ** 2)
      const proximity = interactive && cursorDistance < 160 ? (1 - cursorDistance / 160) * 0.35 : 0
      // why: steeper depth falloff (low floor) keeps far nodes faint and clustered centrally while near nodes carry presence, so deepest points read as further away.
      const depthAlpha = ((p.depth + 1) / 2) * 0.42 + 0.06
      let alpha = depthAlpha * p.fade * opacityMultiplier * intensityScale
      if (alpha <= 0) return
      alpha = min(1, alpha + proximity)
      ctx.beginPath()
      ctx.arc(p.x, p.y, proximity > 0 ? 1.4 : 0.9, 0, PI * 2)
      ctx.fillStyle = proximity > 0 ? `rgba(${palette.nodeHi}, ${alpha})` : `rgba(${palette.node}, ${alpha})`
      ctx.fill()
    }

    const drawInstance = (scaleMultiplier: number, opacityMultiplier: number, collectTop: boolean) => {
      const finalScale = max(width, height) * 0.42 * scaleMultiplier
      const projected: Array<ProjectedVertex> = []

      for (const v of vertices4D) {
        const r = rotate(v)
        const factor4D = 1 / (CAMERA_4D - r.w)
        const x3 = r.x * factor4D
        const y3 = r.y * factor4D
        const z3 = r.z * factor4D
        const factor2D = 1 / (CAMERA_3D - z3)
        const x = x3 * factor2D * finalScale + width / 2
        const y = y3 * factor2D * finalScale + height / 2
        projected.push({ x, y, x3, y3, z3, depth: z3, fade: edgeFade(x, y) })
      }

      for (const face of faces) {
        drawFaceQuad(projected[face[0]], projected[face[1]], projected[face[2]], projected[face[3]], opacityMultiplier, collectTop)
      }
      for (const [i1, i2] of edges) drawEdgeSeg(projected[i1], projected[i2], opacityMultiplier)
      for (const p of projected) drawNodeDot(p, opacityMultiplier)
    }

    // why: the dive flavour is a zoom through self-similar copies of the whole rotating tesseract — four copies, each DIVE_RATIO× the next, cross-fade so a deeper copy materialises at the centre as the outer one swells past the viewport. Every copy carries the full 4D fold (via drawInstance's `rotate`), so the structure visibly turns inside-out as you fall through it.
    // how: gScale/gOpacity are the flavour-swap envelope — 1/1 at rest, driving the whole lattice toward a point (and out again) during a swap without touching rain.
    const drawDive = (collectTop: boolean, gScale: number, gOpacity: number) => {
      const loopFraction = diveProgress - floor(diveProgress)
      // why: walk from the outermost (largest) copy inward so each deeper copy layers over the one enclosing it as it emerges at the centre.
      for (let layerOffset = -1; layerOffset <= 2; layerOffset++) {
        const scaleFactor = pow(DIVE_RATIO, loopFraction - layerOffset) * gScale
        let layerOpacity = max(0, min(1, (3 - (layerOffset - loopFraction)) / 3))
        // why: ease the newest (deepest) copy in from near-zero and fade the oldest (outermost) out, so copies never pop as the zoom recycles each unit of diveProgress.
        if (layerOffset === -1) layerOpacity *= pow(1 - loopFraction, 2)
        if (layerOffset === 2) layerOpacity *= pow(loopFraction, 2.5)
        layerOpacity *= 0.85 * gOpacity
        if (layerOpacity > 0 && scaleFactor > 0.01 && scaleFactor < 10) {
          // why: only the resting-scale copy (offset 0) offers rain landing surfaces.
          drawInstance(scaleFactor, layerOpacity, collectTop && layerOffset === 0)
        }
      }
    }

    // why: one cube level of the tunnel flavour, projected orthographically at a geometric scale set by its depth `f`. A 3D tumble (angleX/angleY) is shared by every level; the per-level z-twist reproduces the 4D shear between a tesseract's nested cells.
    const rotate3D = (v: Point3D, twist: number, ax: number, ay: number) => {
      let x = v.x
      let y = v.y
      let z = v.z
      let c = cos(twist)
      let s = sin(twist)
      ;[x, y] = [x * c - y * s, x * s + y * c]
      c = cos(ax)
      s = sin(ax)
      ;[y, z] = [y * c - z * s, y * s + z * c]
      c = cos(ay)
      s = sin(ay)
      ;[x, z] = [x * c - z * s, x * s + z * c]
      // how: the same cursor-driven view tilt the 4D renderer applies, so both flavours share one perspective.
      c = cos(lookYaw)
      s = sin(lookYaw)
      ;[x, z] = [x * c - z * s, x * s + z * c]
      c = cos(lookPitch)
      s = sin(lookPitch)
      ;[y, z] = [y * c - z * s, y * s + z * c]
      return { x, y, z }
    }

    type TunnelCube = { f: number; op: number; verts: Array<ProjectedVertex> }

    const projectTunnelCube = (level: number, gScale: number, gOpacity: number): TunnelCube => {
      const f = diveProgress - level
      // why: gScale folds the swap collapse/expand into the geometric recession so the whole tunnel scales toward centre as one.
      const scale = max(width, height) * 0.11 * pow(TUNNEL_RATIO, f) * gScale
      const twist = f * TUNNEL_TWIST
      const verts: Array<ProjectedVertex> = []
      for (const v of cubeVertices3D) {
        const r = rotate3D(v, twist, angleX, angleY)
        const x = r.x * scale + width / 2
        const y = r.y * scale + height / 2
        // why: a unit cube's rotated z spans ±√3; normalising keeps depth shading in the same [-1,1] band the static renderer expects.
        verts.push({ x, y, x3: r.x, y3: r.y, z3: r.z, depth: r.z / 1.7320508, fade: edgeFade(x, y) })
      }
      // why: ease each level in from the vanishing point and out past the viewport so cubes never pop; dim deeper levels so the tunnel reads with genuine recession.
      const fadeIn = max(0, min(1, (f - TUNNEL_F_MIN) / TUNNEL_FADE_SPAN))
      const fadeOut = max(0, min(1, (TUNNEL_F_MAX - f) / TUNNEL_FADE_SPAN))
      const depthDim = 0.4 + ((f - TUNNEL_F_MIN) / (TUNNEL_F_MAX - TUNNEL_F_MIN)) * 0.6
      const op = fadeIn * fadeOut * depthDim * gOpacity
      return { f, op, verts }
    }

    const drawTunnel = (collectTop: boolean, gScale: number, gOpacity: number) => {
      const nLo = ceil(diveProgress - TUNNEL_F_MAX)
      const nHi = floor(diveProgress - TUNNEL_F_MIN)
      const cubes: Array<TunnelCube> = []
      for (let n = nLo; n <= nHi; n++) cubes.push(projectTunnelCube(n, gScale, gOpacity))
      // why: paint deepest (last, smallest) first so nearer cubes layer over them; only the nearest cubes offer rain surfaces, so far levels skip top-face collection.
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        if (cube.op <= 0) continue
        const allowTop = collectTop && cube.f > -1.5
        const inner = cubes[i + 1]
        if (inner && inner.op > 0) {
          const connOp = min(cube.op, inner.op)
          // why: each cube edge plus the matching edge of the deeper cube spans one connector facet — the slanted wall of the tesseract cell between the two cubes.
          for (const [a, b] of cubeEdges) drawFaceQuad(cube.verts[a], cube.verts[b], inner.verts[b], inner.verts[a], connOp, allowTop)
        }
        for (const face of cubeFaces)
          drawFaceQuad(cube.verts[face[0]], cube.verts[face[1]], cube.verts[face[2]], cube.verts[face[3]], cube.op, allowTop)
      }
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        if (cube.op <= 0) continue
        const inner = cubes[i + 1]
        if (inner && inner.op > 0) {
          const connOp = min(cube.op, inner.op)
          // why: the 8 connector edges joining each cube corner to the deeper cube's corner are the tesseract's "inward" struts.
          for (let v = 0; v < 8; v++) drawEdgeSeg(cube.verts[v], inner.verts[v], connOp)
        }
        for (const [a, b] of cubeEdges) drawEdgeSeg(cube.verts[a], cube.verts[b], cube.op)
      }
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        if (cube.op <= 0) continue
        for (const p of cube.verts) drawNodeDot(p, cube.op)
      }
    }

    // how: dispatch to whichever flavour renderer is named, passing the swap scale/opacity envelope through.
    const drawFlavour = (which: Flavour, collectTop: boolean, gScale: number, gOpacity: number) => {
      if (which === 'tunnel') drawTunnel(collectTop, gScale, gOpacity)
      else drawDive(collectTop, gScale, gOpacity)
    }

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height)
      topFaces.length = 0
      // why: back rain falls first so the lattice paints over it; front rain and splashes follow.
      if (rainEnabled) drawRain(false)
      if (dive) {
        if (swapping) {
          // why: outgoing flavour collapses to a point over the first ~55% while the incoming one blooms back out over the last ~55%; the small overlap keeps a clean singularity at the swap's midpoint, selling the "reconfiguration".
          const outScale = 1 - smoothstep(min(1, swapProgress / 0.55))
          const inScale = smoothstep(max(0, (swapProgress - 0.45) / 0.55))
          // why: hold each lattice fully opaque while it is still a visible size and fade only in the last sliver, so it truly shrinks to a pixel rather than dissolving early. Top-face collection is paused mid-swap — rain keeps falling, just no new splashes on the collapsing lattice.
          drawFlavour(swapFrom, false, outScale, min(1, outScale * 4))
          drawFlavour(swapTo, false, inScale, min(1, inScale * 4))
        } else {
          drawFlavour(flavour, rainEnabled, 1, 1)
        }
      } else {
        drawInstance(1, 1, rainEnabled)
      }
      if (rainEnabled) {
        processHits()
        drawSplashes()
        drawRain(true)
      }
    }

    if (prefersReducedMotion) {
      renderFrame()
      return
    }

    let frameId = 0
    const animate = () => {
      // how: the view angle glides toward where the cursor points; the low lerp factor keeps the tilt languid rather than twitchy.
      lookYaw += (targetLookYaw - lookYaw) * 0.04
      lookPitch += (targetLookPitch - lookPitch) * 0.04
      // why: rotation eased 15% slower (×0.85) for a calmer drift; dive runs 15% faster (×1.15).
      angleX += 0.000935
      angleY += 0.001275
      angleW += 0.001105
      if (dive) diveProgress += 0.001035
      if (swapping) {
        swapProgress += SWAP_STEP
        if (swapProgress >= 1) {
          // why: the incoming flavour is now at full scale — adopt it as the resting renderer and persist it across effect restarts.
          swapping = false
          swapProgress = 0
          flavour = swapTo
          flavourRef.current = flavour
        }
      }
      if (rainEnabled) updateRain()
      renderFrame()
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    // why: a click on inert background reconfigures the hypercube — the current flavour collapses and the other blooms out. Clicks on anything interactive (or while a swap is mid-flight) are ignored so they pass straight through to the UI.
    const onBackgroundClick = (event: MouseEvent) => {
      if (!dive || swapping) return
      const target = event.target as Element | null
      if (
        target?.closest(
          'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [tabindex], [contenteditable=""], [contenteditable="true"]'
        )
      )
        return
      swapping = true
      swapProgress = 0
      swapFrom = flavour
      swapTo = flavour === 'dive' ? 'tunnel' : 'dive'
    }

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    if (interactive) window.addEventListener('mousemove', onMouseMove)
    if (dive) window.addEventListener('click', onBackgroundClick)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('click', onBackgroundClick)
    }
  }, [resolvedTheme, intensity, dive, interactive, rain])

  return <canvas ref={canvasRef} aria-hidden="true" className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'} />
}
