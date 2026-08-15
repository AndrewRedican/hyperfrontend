<script setup lang="ts">
/**
 * The Vue renderer: one 3D koi, drawn through the shared pond view.
 *
 * The template owns exactly two elements — the canvas the koi renders into and
 * the identity card the host reveals on hover — and `onMounted` is where the
 * scene behind them comes to life. The component hands an imperative handle up
 * through `onReady` so the frame loop can drive the koi directly: sixty draws a
 * second write GPU uniforms and one element transform, never reactive state.
 * Only the hover flag is a ref, because it flips a handful of times a minute
 * and the card's visibility is the one thing the template decides.
 *
 * The canvas covers only the koi's own frame box, never the whole viewport:
 * the shared camera is narrowed onto that box each frame, so the small canvas
 * paints pixel-identically what a full-viewport render would have put there,
 * at a fraction of the fill and memory. A koi outside the visible window draws
 * nothing at all.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * this component only makes the koi's body express it.
 */
import type { KoiFrameBox, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { GlRenderer, KoiSceneHandle } from './koi-render'
import { POND_VIEW, koiFrameBox, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondView, fitPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'

/** How far the frame box's edge may drift from the fitted buffer before a re-fit, as a fraction. */
const REFIT_DRIFT = 0.1

/** What the renderer factory mounts this component with. */
interface Props {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app rendering it, revealed on hover. */
  url: string
  /** The world at mount time; later announcements arrive through the handle. */
  pond: PondEnvironment
  /** The GL factory, replaceable so specs can run headless. */
  createGl: (canvas: HTMLCanvasElement) => GlRenderer
  /** Takes the imperative handle once the scene exists. */
  onReady: (handle: KoiSceneHandle) => void
}

const props = defineProps<Props>()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')
const cardRef = useTemplateRef<HTMLDivElement>('card')
const cardUrlRef = useTemplateRef<HTMLAnchorElement>('cardUrl')

/** Whether the host's pointer is over this koi, which is what shows its identity card. */
const hovered = ref(false)

/** What unmounting must release; nothing until the scene exists. */
let cleanup: (() => void) | null = null

onMounted(() => {
  const canvas = canvasRef.value
  const card = cardRef.value
  // why: Template refs are bound before mounted hooks run, so a miss here means the template itself has drifted.
  if (canvas === null || card === null) {
    throw new Error('missing template ref: canvas or card')
  }

  const { profile, pond } = props
  const { palette, build, phenotype, trim } = profile

  const gl = props.createGl(canvas)
  const view: PondView = createPondView(pond)
  const scene = new Scene()
  scene.add(createLighting(POND_VIEW.lighting))

  const koi: Koi = createKoi({
    seed: koiSeed(profile.framework),
    // why: The phenotype is the profile's own many-levered build — width, belly, head, fins — so the seven read as related but individually recognisable animals rather than one mesh at seven scales.
    physical: phenotype,
    appearance: {
      pattern: palette.pattern,
      base: palette.body,
      primary: palette.marking,
      secondary: palette.shade,
      accent: palette.accent,
    },
    trim,
  })
  koi.mount(scene)

  let bodyPx = pxPerUnit(pond.fishLength) * build.lengthScale
  let lastHeading: number | null = null
  let lastSpeed = 0
  let current = pond
  let fittedSize = 0
  let shown = true
  const box: KoiFrameBox = { x: 0, y: 0, size: 0, visible: false }

  cleanup = () => {
    koi.dispose()
    gl.dispose()
  }

  props.onReady({
    koi,
    draw(state, dt) {
      koiFrameBox(state.position, state.heading, state.length, current.view, box)
      // why: A koi outside the window pays nothing — no pose, no uniforms, no clear, no composite. The brain keeps swimming; only the pixels stop.
      if (!box.visible) {
        if (shown) {
          shown = false
          canvas.style.display = 'none'
        }
        lastHeading = state.heading
        // why: The speed memory must track through skipped frames too, or re-entering the view lands the whole offscreen speed change as a single-frame acceleration spike that convulses the body.
        lastSpeed = state.speed / bodyPx
        return
      }
      if (!shown) {
        shown = true
        canvas.style.display = ''
      }
      if (Math.abs(box.size - fittedSize) > fittedSize * REFIT_DRIFT) {
        // why: The buffer re-fits only when the body's size genuinely changed — reallocating a drawing buffer every frame would cost more than the render itself.
        fittedSize = box.size
        fitPondRenderer(gl, box.size)
        canvas.style.width = `${box.size}px`
        canvas.style.height = `${box.size}px`
      }
      canvas.style.transform = `translate3d(${(box.x - current.view.x).toFixed(1)}px, ${(box.y - current.view.y).toFixed(1)}px, 0)`

      const seconds = dt > 0 ? dt : 1e-6
      // why: The swimming model thinks in this koi's own body lengths, while the brain and the wire think in pond pixels.
      const speed = state.speed / bodyPx
      // why: Both grow clockwise on screen — the model's positive turn bends toward the right flank exactly as a growing pond heading turns — so the heading's own rate feeds straight in and the head leads into the turn.
      const turnRate = lastHeading === null ? 0 : wrapAngle(state.heading - lastHeading) / seconds
      koi.setMotion({
        speed,
        turnRate,
        acceleration: (speed - lastSpeed) / seconds,
        escapeIntensity: state.phase === 'escape' ? 1 : 0,
        depth: swimDepth(state.depth),
      })
      lastHeading = state.heading
      lastSpeed = speed
      koi.update(dt)
      view.frame(box)
      view.place(koi.object, state.position, state.heading)
      gl.render(scene, view.camera)
    },

    setPond(next) {
      bodyPx = pxPerUnit(next.fishLength) * build.lengthScale
      current = next
      view.setPond(next)
      // why: A pond announcement moves the window, so the next draw must re-fit rather than trust a buffer sized against the old world.
      fittedSize = 0
    },

    setHovered(next) {
      hovered.value = next
    },

    placeCard(state) {
      const head = state.spine.joints[0]
      if (head === undefined) {
        return
      }
      // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
      const x = head.x - current.view.x + state.length * 0.12
      const y = head.y - current.view.y - state.length * 0.38
      // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
      const width = card.offsetWidth || 200
      const height = card.offsetHeight || 64
      const clampedX = Math.min(Math.max(x, 8), Math.max(8, current.view.width - width - 8))
      const clampedY = Math.min(Math.max(y, 8), Math.max(8, current.view.height - height - 8))
      // why: Writing the transform straight onto the element keeps the sixty-a-second card chase out of Vue's reactive re-render entirely.
      card.style.transform = `translate(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px)`
    },

    cardLinkRect() {
      const cardUrl = cardUrlRef.value
      if (!hovered.value || cardUrl === null) {
        return null
      }
      // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
      const rect = cardUrl.getBoundingClientRect()
      return { x: rect.left + current.view.x, y: rect.top + current.view.y, width: rect.width, height: rect.height }
    },
  })
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<template>
  <canvas ref="canvas" class="koi-canvas" aria-hidden="true"></canvas>
  <div ref="card" class="koi-card" :hidden="!hovered">
    <span class="koi-card-name" :style="{ color: profile.palette.accent }">{{ profile.label }}</span>
    <!-- why: The URL is a real anchor for semantics and link styling, but this frame never receives the pointer — the host reads its rectangle off the outline report and floats the anchor that actually opens it. -->
    <a ref="cardUrl" class="koi-card-url" :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
  </div>
</template>
