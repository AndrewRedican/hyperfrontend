'use client'

import { useTheme } from '@/components/theme-provider'
import { useEffect, useRef } from 'react'
import { abs, atan2, cos, floor, log, max, min, PI, pow, random, sin, sqrt } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { cancelAnimationFrame, requestAnimationFrame } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** A point in 4D space; each coordinate is one of the tesseract's two extents. */
type Vertex4D = { x: number; y: number; z: number; w: number }

/** Visual intensity of the backdrop — how much it competes for attention. */
type Intensity = 'subtle' | 'normal'

/** Props for {@link TesseractBackground} */
type TesseractBackgroundProps = {
  /** Extra classes for the positioning wrapper. Defaults to filling the parent. */
  className?: string
  /** Overall opacity weighting; `subtle` recedes further into the page. */
  intensity?: Intensity
  /**
   * When true the structure slowly zooms through its nested layers, evoking the
   * Russian-doll lazy-loading metaphor. When false the layers hold a static
   * depth while still rotating gently.
   */
  dive?: boolean
  /** When true the surfaces track the cursor for parallax and hover highlight. */
  interactive?: boolean
  /** When true a subtle angled purple-rain layer falls in front of and behind the lattice. */
  rain?: boolean
}

// why: The 16 corners of a tesseract are every combination of ±1 across four axes.
const vertices4D: Array<Vertex4D> = []
for (let x = -1; x <= 1; x += 2) {
  for (let y = -1; y <= 1; y += 2) {
    for (let z = -1; z <= 1; z += 2) {
      for (let w = -1; w <= 1; w += 2) {
        vertices4D.push({ x, y, z, w })
      }
    }
  }
}

// why: Two corners share an edge when exactly one of their four coordinates differs.
const edges: Array<[number, number]> = []
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    let diff = 0
    if (vertices4D[i].x !== vertices4D[j].x) diff++
    if (vertices4D[i].y !== vertices4D[j].y) diff++
    if (vertices4D[i].z !== vertices4D[j].z) diff++
    if (vertices4D[i].w !== vertices4D[j].w) diff++
    if (diff === 1) edges.push([i, j])
  }
}

/**
 * Counts how many of the four spatial axes take both extents across a quad of
 * vertices. A genuine square facet of the tesseract varies in exactly two axes.
 * @param a First vertex of the quad.
 * @param b Second vertex of the quad.
 * @param c Third vertex of the quad.
 * @param d Fourth vertex of the quad.
 * @returns The number of axes (0-4) that fluctuate across the quad.
 */
function varyingAxes(a: Vertex4D, b: Vertex4D, c: Vertex4D, d: Vertex4D): number {
  let varying = 0
  if (!(a.x === b.x && b.x === c.x && c.x === d.x)) varying++
  if (!(a.y === b.y && b.y === c.y && c.y === d.y)) varying++
  if (!(a.z === b.z && b.z === c.z && c.z === d.z)) varying++
  if (!(a.w === b.w && b.w === c.w && c.w === d.w)) varying++
  return varying
}

// why: The 24 square facets are quads of corners that span exactly two axes.
const faces: Array<[number, number, number, number]> = []
for (let i = 0; i < 16; i++) {
  for (let j = i + 1; j < 16; j++) {
    for (let k = j + 1; k < 16; k++) {
      for (let l = k + 1; l < 16; l++) {
        if (varyingAxes(vertices4D[i], vertices4D[j], vertices4D[k], vertices4D[l]) === 2) {
          // note: ordering as i,j,l,k yields a non-self-intersecting winding for fill.
          faces.push([i, j, l, k])
        }
      }
    }
  }
}

/** Per-theme RGB triples (as `r, g, b` strings) for the structure's strokes. */
type Palette = { line: string; lineHi: string; node: string; nodeHi: string }

const darkPalette: Palette = { line: '34, 211, 238', lineHi: '103, 232, 249', node: '34, 211, 238', nodeHi: '165, 243, 252' }
const lightPalette: Palette = { line: '37, 99, 235', lineHi: '29, 78, 216', node: '37, 99, 235', nodeHi: '29, 78, 216' }

/** A vertex after 4D→3D→2D projection, retaining the data shading and fade need. */
type ProjectedVertex = { x: number; y: number; x3: number; y3: number; z3: number; depth: number; fade: number }

/** A screen-space point. */
type Point2D = { x: number; y: number }

/**
 * A falling purple-rain droplet with an angled, speed-varied trajectory and fading tail.
 * `armed` gates one splash roll per facet entry so a drop never re-rolls along its path.
 */
type RainDrop = { x: number; y: number; vx: number; vy: number; tail: number; alpha: number; armed: boolean; front: boolean }

/** A projected landscape (wide-trapezoid) facet rain can land on, weighted by how strongly the top light hits it. */
type TopFace = { poly: Array<Point2D>; upness: number }

/**
 * A short-lived purple highlight where a droplet struck a facet. It traces the
 * surface as an oriented ellipse (`angle`, `rx`, `ry`), leans into the impact
 * direction (`ix`, `iy`) rather than a uniform circle, and is clipped to the
 * snapshot of the contacted facet (`poly`) so it never spills past the edges.
 */
type Splash = {
  x: number
  y: number
  life: number
  rx: number
  ry: number
  angle: number
  ix: number
  iy: number
  strength: number
  poly: Array<Point2D>
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
    // why: the whole structure's centre eases toward the cursor's resting point (a fraction of the way) rather than depth-skewing every vertex around a pinned viewport origin.
    const followStrength = interactive ? 0.6 : 0
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

    // how: smoothed centre offset that eases toward the cursor, plus the raw cursor position for hover focus.
    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0
    let localMouseX = -9999
    let localMouseY = -9999

    let angleX = 0
    let angleY = 0
    let angleW = 0
    let diveProgress = 1

    const onMouseMove = (event: MouseEvent) => {
      localMouseX = event.clientX - rectLeft
      localMouseY = event.clientY - rectTop
      targetMouseX = (localMouseX - width / 2) * followStrength
      targetMouseY = (localMouseY - height / 2) * followStrength
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
      // why: per-drop angle and speed jitter make streaks arrive offset rather than as parallel straight lines.
      const speed = clamp(gauss(3.2, 1.2), 1.2, 7.5)
      drop.vy = speed
      drop.vx = speed * (0.28 + gauss(0, 0.13))
      drop.tail = clamp(gauss(7, 4), 1.5, 14)
      // why: baseline skews high-transparency; gaussian gives a few brighter drops without a hard origin.
      drop.alpha = clamp(gauss(0.18, 0.12), 0.03, 0.5)
      // why: a freshly spawned drop is clear of every facet, so it is armed to roll once on its next entry.
      drop.armed = true
    }

    const dropCount = rainEnabled ? floor(clamp((width * height) / 14000, 18, intensity === 'subtle' ? 55 : 110)) : 0
    const drops: Array<RainDrop> = []
    for (let i = 0; i < dropCount; i++) {
      const drop = { x: 0, y: 0, vx: 0, vy: 0, tail: 0, alpha: 0, armed: true, front: random() < 0.55 }
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
      splashes.push({
        x: drop.x,
        y: drop.y,
        life: 1,
        rx: clamp((useFirst ? len1 : len2) * 0.3, 8, 60),
        ry: clamp((useFirst ? len2 : len1) * 0.16, 3, 26),
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
        // why: re-arm once clear of every facet, so each entry rolls exactly once (no splashes tracing the path).
        if (!hitFace) {
          drop.armed = true
          continue
        }
        if (!drop.armed) continue
        drop.armed = false
        // why: most crossings pass through; ~22% splash, and a splashing drop halts and recycles from the top.
        if (random() < 0.22 && splashes.length < 30) {
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

    const drawInstance = (scaleMultiplier: number, opacityMultiplier: number, collectTop: boolean) => {
      const finalScale = max(width, height) * 0.42 * scaleMultiplier
      const projected: Array<ProjectedVertex> = []

      for (const v of vertices4D) {
        const r = rotate(v)
        const factor4D = 1 / (2.2 - r.w)
        const x3 = r.x * factor4D
        const y3 = r.y * factor4D
        const z3 = r.z * factor4D
        const factor2D = 1 / (2.4 - z3)
        const x = x3 * factor2D * finalScale + width / 2 + mouseX
        const y = y3 * factor2D * finalScale + height / 2 + mouseY
        projected.push({ x, y, x3, y3, z3, depth: z3, fade: edgeFade(x, y) })
      }

      // how: top-centre directional light gives the abstract lattice tangible weight.
      const lightX = 0
      const lightY = -1
      const lightZ = 0.5

      for (const face of faces) {
        const p0 = projected[face[0]]
        const p1 = projected[face[1]]
        const p2 = projected[face[2]]
        const p3 = projected[face[3]]
        const avgFade = (p0.fade + p1.fade + p2.fade + p3.fade) / 4
        if (avgFade <= 0) continue
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
        if (alpha <= 0) continue
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

      for (const [i1, i2] of edges) {
        const p1 = projected[i1]
        const p2 = projected[i2]
        const avgFade = (p1.fade + p2.fade) / 2
        if (avgFade <= 0) continue
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        const cursorDistance = sqrt((midX - localMouseX) ** 2 + (midY - localMouseY) ** 2)
        const highlight = interactive && cursorDistance < 140 ? (1 - cursorDistance / 140) * 0.3 : 0
        const avgDepth = (p1.depth + p2.depth) / 2
        const depthAlpha = ((avgDepth + 1) / 2) * 0.22 + 0.05
        let alpha = depthAlpha * avgFade * opacityMultiplier * intensityScale
        if (alpha <= 0) continue
        alpha = min(1, alpha + highlight)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.strokeStyle = highlight > 0 ? `rgba(${palette.lineHi}, ${alpha})` : `rgba(${palette.line}, ${alpha})`
        ctx.lineWidth = highlight > 0 ? 1.3 : 0.9
        ctx.stroke()
      }

      for (const p of projected) {
        if (p.fade <= 0) continue
        const cursorDistance = sqrt((p.x - localMouseX) ** 2 + (p.y - localMouseY) ** 2)
        const proximity = interactive && cursorDistance < 160 ? (1 - cursorDistance / 160) * 0.35 : 0
        // why: steeper depth falloff (low floor) keeps far nodes faint and clustered centrally while near nodes carry presence, so deepest points read as further away.
        const depthAlpha = ((p.depth + 1) / 2) * 0.42 + 0.06
        let alpha = depthAlpha * p.fade * opacityMultiplier * intensityScale
        if (alpha <= 0) continue
        alpha = min(1, alpha + proximity)
        ctx.beginPath()
        ctx.arc(p.x, p.y, proximity > 0 ? 1.4 : 0.9, 0, PI * 2)
        ctx.fillStyle = proximity > 0 ? `rgba(${palette.nodeHi}, ${alpha})` : `rgba(${palette.node}, ${alpha})`
        ctx.fill()
      }
    }

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height)
      topFaces.length = 0
      // why: back rain falls first so the lattice paints over it; front rain and splashes follow.
      if (rainEnabled) drawRain(false)
      const currentLevel = floor(diveProgress)
      const loopFraction = diveProgress - currentLevel
      // how: four nested copies cross-fade so deeper layers emerge as outer ones grow past view.
      for (let layerOffset = -1; layerOffset <= 2; layerOffset++) {
        const scaleFactor = pow(3.5, -layerOffset + loopFraction)
        let layerOpacity = max(0, min(1, (3 - (layerOffset - loopFraction)) / 3))
        // why: ease the newest (deepest) layer in from near-zero so points never visibly "pop" — they materialise imperceptibly and gain presence only as they expand outward toward the viewer.
        if (layerOffset === -1) layerOpacity *= pow(1 - loopFraction, 2)
        if (layerOffset === 2) layerOpacity *= pow(loopFraction, 2.5)
        layerOpacity *= 0.85
        if (layerOpacity > 0 && scaleFactor > 0.01 && scaleFactor < 10) {
          drawInstance(scaleFactor, layerOpacity, rainEnabled && layerOffset === 0)
        }
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
      // how: low lerp factor makes the centre drift slowly toward the cursor's resting position.
      mouseX += (targetMouseX - mouseX) * 0.012
      mouseY += (targetMouseY - mouseY) * 0.012
      // why: rotation eased 15% slower (×0.85) for a calmer drift; dive runs 15% faster (×1.15).
      angleX += 0.000935
      angleY += 0.001275
      angleW += 0.001105
      if (dive) diveProgress += 0.001035
      if (rainEnabled) updateRain()
      renderFrame()
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    if (interactive) window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [resolvedTheme, intensity, dive, interactive, rain])

  return <canvas ref={canvasRef} aria-hidden="true" className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'} />
}
