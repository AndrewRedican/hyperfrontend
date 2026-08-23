<script setup lang="ts">
/**
 * The Vue renderer: one 3D koi, drawn through the shared stage.
 *
 * The template owns exactly two elements — the canvas the koi renders into and
 * the identity card a visitor opens by holding the koi — and `onMounted` is
 * where the scene behind them comes to life. The component hands an imperative
 * handle up through `onReady` so the frame loop can drive the koi directly:
 * sixty draws a second go straight to the shared stage, never through reactive
 * state. Only the selection flag and the card's inspector rows are refs,
 * because they change a handful of times a minute and the card is the one
 * thing the template decides.
 *
 * This is the one browser-facing module in the app. The other seven koi replace
 * exactly this file with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * this component only makes the koi's body express it; the shared stage draws
 * the animal into the canvas the template owns.
 */
import type { KoiCardLink, KoiCardText, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiSceneHandle } from './koi-render'
import { FRAMEWORK_SITES, cardAnchor, cardTransform, describeKoiCard, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage } from '@hyperfrontend/demo-koi-lib/three'
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'

/** How firmly the silhouette reads when the pointer is merely over the koi. */
const HOVER_OUTLINE = 0.35

/** How firmly the silhouette reads while a visitor holds the koi. */
const HELD_OUTLINE = 1

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
const cardSiteRef = useTemplateRef<HTMLAnchorElement>('cardSite')
const cardSourceRef = useTemplateRef<HTMLAnchorElement>('cardSource')

/** Whether a visitor is holding this koi, which is what shows its identity card. */
const selected = ref(false)

/** The card's inspector rows, rewritten from the live facts while the koi is held. */
const rows = ref<KoiCardText | null>(null)

/** The official website of the framework driving this app, linked from the card. */
const siteUrl = FRAMEWORK_SITES[props.profile.framework]

/** Where this very app's implementation lives in the repository, linked from the card. */
const sourceUrl = koiSourceUrl(props.profile.framework)

/** Whether the host's pointer is over this koi; it only shades the silhouette, so it never touches the template. */
let hovered = false

/** What unmounting must release; nothing until the scene exists. */
let cleanup: (() => void) | null = null

onMounted(() => {
  const canvas = canvasRef.value
  const card = cardRef.value
  // why: Template refs are bound before mounted hooks run, so a miss here means the template itself has drifted.
  if (canvas === null || card === null) {
    throw new Error('missing template ref: canvas or card')
  }

  const { pond } = props
  // why: The stage owns the scene, camera, and animal behind the canvas; this component only decides the card and hands the frame loop a plain handle.
  const stage = createKoiStage(canvas, props.profile, pond, props.createGl)

  let current = pond

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  const applyOutline = (): void => {
    stage.setOutline(selected.value ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
  }

  /**
   * A card element's rectangle lifted into pond space.
   *
   * @param element - The element to measure.
   * @returns The pond-space rectangle.
   */
  const rectOf = (element: HTMLElement): KoiCardLink => {
    // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
    const rect = element.getBoundingClientRect()
    return { x: rect.left + current.view.x, y: rect.top + current.view.y, width: rect.width, height: rect.height }
  }

  cleanup = () => {
    stage.dispose()
  }

  props.onReady({
    draw(state, dt) {
      stage.draw(state, dt)
    },

    setPond(next) {
      current = next
      stage.setPond(next)
    },

    setHovered(next) {
      hovered = next
      applyOutline()
    },

    setSelected(next) {
      // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
      selected.value = next
      applyOutline()
    },

    updateCard(details) {
      rows.value = describeKoiCard(details)
    },

    placeCard(state) {
      // why: A hidden card measures nothing, so a nominal footprint keeps the window clamp honest on the very first placement.
      const at = cardAnchor(state, current, { width: card.offsetWidth || 200, height: card.offsetHeight || 64 })
      // why: Writing the transform straight onto the element keeps the sixty-a-second card chase out of Vue's reactive re-render entirely.
      card.style.transform = cardTransform(at)
    },

    cardRects() {
      const cardUrl = cardUrlRef.value
      const cardSite = cardSiteRef.value
      const cardSource = cardSourceRef.value
      if (!selected.value || cardUrl === null || cardSite === null || cardSource === null) {
        return null
      }
      return { frame: rectOf(card), app: rectOf(cardUrl), site: rectOf(cardSite), source: rectOf(cardSource) }
    },
  })
})

onUnmounted(() => {
  cleanup?.()
})
</script>

<template>
  <canvas ref="canvas" class="koi-canvas" aria-hidden="true"></canvas>
  <div ref="card" class="koi-card" :hidden="!selected">
    <span class="koi-card-name">
      <!-- why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app. -->
      <span class="koi-card-title" :style="{ color: profile.palette.accent }">{{ profile.label }}</span>
      <span class="koi-card-variety">{{ profile.palette.pattern }}</span>
    </span>
    <span class="koi-card-line koi-card-state">{{ rows?.state }}</span>
    <!-- why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. -->
    <a ref="cardUrl" class="koi-card-url" :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
    <span class="koi-card-line koi-card-runtime">{{ rows?.runtime }}</span>
    <span class="koi-card-line koi-card-memory">{{ rows?.memory }}</span>
    <span class="koi-card-line koi-card-event" :hidden="!rows || rows.event === null">{{ rows?.event }}</span>
    <a ref="cardSite" class="koi-card-site" :href="siteUrl" target="_blank" rel="noopener noreferrer">{{ profile.label }} website ↗</a>
    <!-- why: The demo's claim is checkable — the card links straight to this very app's implementation in the repository. -->
    <a ref="cardSource" class="koi-card-source" :href="sourceUrl" target="_blank" rel="noopener noreferrer">App source ↗</a>
  </div>
</template>
