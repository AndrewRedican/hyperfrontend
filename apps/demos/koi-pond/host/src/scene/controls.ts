/**
 * The koi playground: a curated handful of the shoal's real configuration
 * levers, surfaced as live sliders.
 *
 * Every slider broadcasts a single-field tune over the wire; each fish lays
 * the scale over its own derived behaviour and body through the shared
 * library's own APIs, so the playground moves the whole shoal while every
 * koi keeps its individual character. Deliberately small — this is a toy for
 * a visitor, not an engineering panel, and anything not worth playing with
 * stays unexposed.
 */
import type { KoiTune } from '@hyperfrontend/demo-koi-lib'

/** Milliseconds between live slider broadcasts, so a drag does not flood seven channels. */
const TUNE_THROTTLE_MS = 90

/** One slider: which tune field it drives, and its band. */
interface ControlSpec {
  /** The tune field this slider writes. */
  key: keyof KoiTune
  /** The label a visitor reads. */
  label: string
  /** Slider floor. */
  min: number
  /** Slider ceiling. */
  max: number
  /** Slider step. */
  step: number
  /** Where the slider starts; 1 for the pure scales. */
  neutral: number
  /**
   * When `true` the value only broadcasts once the visitor releases the
   * slider — the body levers rebuild seven meshes, which is not a per-frame
   * price.
   */
  onRelease?: boolean
}

/** The curated levers, in display order. */
const CONTROLS: readonly ControlSpec[] = [
  { key: 'speedScale', label: 'Pace', min: 0.3, max: 2, step: 0.05, neutral: 1 },
  { key: 'turnScale', label: 'Agility', min: 0.5, max: 2, step: 0.05, neutral: 1 },
  { key: 'wanderScale', label: 'Wander', min: 0, max: 2, step: 0.05, neutral: 1 },
  { key: 'clearanceScale', label: 'Spacing', min: 0.5, max: 2, step: 0.05, neutral: 1 },
  { key: 'amplitudeScale', label: 'Body wave', min: 0.6, max: 1.6, step: 0.05, neutral: 1 },
  { key: 'frequencyScale', label: 'Beat', min: 0.7, max: 1.4, step: 0.05, neutral: 1 },
  { key: 'waveReach', label: 'Wave reach', min: 0, max: 0.3, step: 0.01, neutral: 0.13 },
  { key: 'widthScale', label: 'Girth', min: 0.7, max: 1.4, step: 0.05, neutral: 1, onRelease: true },
  { key: 'heightScale', label: 'Depth of body', min: 0.7, max: 1.4, step: 0.05, neutral: 1, onRelease: true },
]

/** What the controls report back to the pond. */
export interface ControlsHooks {
  /**
   * A lever moved.
   *
   * @param tune - The single-field tune to broadcast to the shoal.
   */
  onTune(tune: KoiTune): void
}

/**
 * Builds the playground panel inside the pond root.
 *
 * @param root - The `#pond` element.
 * @param hooks - What the panel reports back.
 *
 * @example Broadcasting every lever to the shoal
 * ```typescript
 * createControls(root, { onTune: (tune) => sessions.forEach((s) => s.shell.send('tune', tune)) })
 * ```
 */
export function createControls(root: HTMLElement, hooks: ControlsHooks): void {
  const panel = document.createElement('section')
  panel.className = 'koi-controls'
  panel.dataset['open'] = 'false'
  panel.setAttribute('aria-label', 'Koi playground')

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'koi-controls-toggle'
  toggle.textContent = 'playground'
  toggle.setAttribute('aria-expanded', 'false')
  toggle.addEventListener('click', () => {
    const open = panel.dataset['open'] !== 'true'
    panel.dataset['open'] = open ? 'true' : 'false'
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  panel.append(toggle)

  const body = document.createElement('div')
  body.className = 'koi-controls-body'
  panel.append(body)

  let throttledUntil = 0
  let pending: KoiTune | null = null
  let flush: number | null = null
  const send = (tune: KoiTune): void => {
    const now = Date.now()
    // how: A trailing throttle — mid-drag values coalesce and the final one always lands, so the shoal follows the slider without seven channels drowning in frames.
    if (now < throttledUntil) {
      pending = { ...pending, ...tune }
      if (flush === null) {
        flush = window.setTimeout(() => {
          flush = null
          if (pending !== null) {
            const held = pending
            pending = null
            send(held)
          }
        }, throttledUntil - now)
      }
      return
    }
    throttledUntil = now + TUNE_THROTTLE_MS
    hooks.onTune({ ...pending, ...tune })
    pending = null
  }

  for (const control of CONTROLS) {
    const row = document.createElement('label')
    row.className = 'koi-control'

    const name = document.createElement('span')
    name.className = 'koi-control-name'
    name.textContent = control.label

    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = String(control.min)
    slider.max = String(control.max)
    slider.step = String(control.step)
    slider.value = String(control.neutral)

    const event = control.onRelease === true ? 'change' : 'input'
    slider.addEventListener(event, () => {
      send({ [control.key]: Number(slider.value) })
    })

    row.append(name, slider)
    body.append(row)
  }

  root.append(panel)
}
