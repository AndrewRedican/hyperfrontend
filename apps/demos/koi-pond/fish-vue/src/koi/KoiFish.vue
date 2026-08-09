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
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * this component only makes the koi's body express it.
 */
import type { KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { GlRenderer, KoiSceneHandle } from './koi-render'
import { POND_VIEW, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondView, sizePondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'

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

  sizePondRenderer(gl, pond.view.width, pond.view.height)

  cleanup = () => {
    koi.dispose()
    gl.dispose()
  }

  props.onReady({
    koi,
    draw(state, dt) {
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
      view.place(koi.object, state.position, state.heading)
      gl.render(scene, view.camera)
    },

    setPond(next) {
      bodyPx = pxPerUnit(next.fishLength) * build.lengthScale
      current = next
      view.setPond(next)
      sizePondRenderer(gl, next.view.width, next.view.height)
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
      // why: Writing the transform straight onto the element keeps the sixty-a-second card chase out of Vue's reactive re-render entirely.
      card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    },

    applyTune(tune) {
      // why: The scales ride on this koi's own derived numbers rather than replacing them, so the playground moves the whole shoal while each fish keeps its identity.
      koi.setTrim({
        amplitude: trim.amplitude * (tune.amplitudeScale ?? 1),
        frequency: trim.frequency * (tune.frequencyScale ?? 1),
        waveReach: tune.waveReach ?? trim.waveReach,
      })
      koi.setPhysical({
        width: (phenotype.width ?? 1) * (tune.widthScale ?? 1),
        height: (phenotype.height ?? 1) * (tune.heightScale ?? 1),
      })
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
    <span class="koi-card-url">{{ url }}</span>
  </div>
</template>
