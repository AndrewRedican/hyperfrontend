/**
 * The vitals overlay: opt-in diagnostics for a pond on a real device.
 *
 * A frame that dies in a visitor's hand leaves nothing behind but a
 * placeholder, and a tethered console dies with the page it was inspecting.
 * This panel records what every koi's session and canvas are actually doing,
 * on the device, while it happens: session transitions with their reasons,
 * what each frame's document looks like from the host's side of the boundary,
 * canvas backing sizes, JS heap where the browser reports one, and WebGL
 * context loss the moment it fires. The log survives a page death in storage,
 * so the report of what killed the pond is waiting when the pond comes back.
 *
 * It is never part of the scene: nothing mounts it unless the visitor asked
 * with `?vitals=1` (remembered until `?vitals=0`), and when it is off the
 * pond spends nothing on it.
 */
import type { KoiInstanceId } from '../scene/instance-id'

/** Where the opt-in flag is remembered, per origin. */
const VITALS_FLAG_KEY = 'koi-pond:vitals'

/** Where the rolling log is kept so a page death cannot erase it. */
const VITALS_LOG_KEY = 'koi-pond:vitals-log'

/** How often every frame is probed, in milliseconds. */
const PROBE_INTERVAL_MS = 5000

/** How many log lines are kept. */
const LOG_LIMIT = 400

/** How many log lines the panel shows. */
const SHOWN_LIMIT = 120

/** How long after the latest line the log is persisted, in milliseconds. */
const SAVE_DELAY_MS = 1500

/** What one koi's frame looks like from the host's side, at a glance. */
export type FrameHealth = 'ok' | 'loading' | 'no-canvas' | 'no-document' | 'no-frame' | 'inaccessible'

/** The mounted vitals overlay. */
export interface PondVitals {
  /** Adds one line to the log; koi-level notes name their instance. */
  record(instance: KoiInstanceId | null, kind: string, detail?: string): void
  /** Stops the probe and removes the panel. */
  dispose(): void
}

/**
 * Whether the visitor asked for the vitals overlay.
 *
 * The query flag is the switch and storage is the memory: `?vitals=1` turns it
 * on and keeps it on for this origin until `?vitals=0` turns it off, so an
 * embedded pond whose URL cannot carry a query string can still be armed once
 * from a console and stay armed.
 *
 * @param search - The page's `location.search`.
 * @returns `true` when the overlay should mount.
 */
export function vitalsRequested(search: string): boolean {
  const flag = new URLSearchParams(search).get('vitals')
  try {
    if (flag === '1') {
      window.localStorage.setItem(VITALS_FLAG_KEY, '1')
      return true
    }
    if (flag === '0') {
      window.localStorage.removeItem(VITALS_FLAG_KEY)
      return false
    }
    return window.localStorage.getItem(VITALS_FLAG_KEY) === '1'
  } catch {
    // why: Storage can be walled off entirely inside an embedded frame; the flag alone still works for this one page.
    return flag === '1'
  }
}

/**
 * Finds the koi's canvas wherever its framework put it.
 *
 * Most koi draw straight into their document; a web-component koi draws
 * inside its element's shadow root, which an ordinary query never enters.
 *
 * @param root - The document or shadow root to search.
 * @returns The first canvas found, or `null`.
 */
function findCanvas(root: ParentNode): HTMLCanvasElement | null {
  const direct = root.querySelector('canvas')
  if (direct !== null) {
    return direct
  }
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot !== null) {
      const nested = findCanvas(element.shadowRoot)
      if (nested !== null) {
        return nested
      }
    }
  }
  return null
}

/**
 * Classifies what one koi's layer holds right now.
 *
 * The pond and its koi share an origin while deployed composed, so the host
 * may look straight into each frame; what it finds discriminates failures
 * that look identical from outside. No iframe means no mount; an iframe
 * whose document is unreachable is a frame the browser has given up on; a
 * document without a canvas is an app that never drew. A koi served from its
 * own origin reads `inaccessible`, never `no-document`.
 *
 * @param layer - The koi's host-owned layer.
 * @returns The frame's health.
 */
export function classifyFrame(layer: Element): FrameHealth {
  const frame = layer.querySelector('iframe')
  if (frame === null) {
    return 'no-frame'
  }
  try {
    // why: A cross-origin frame answers every document read with null rather than a throw, which would masquerade as a dead frame; the src the host itself set tells the two apart.
    if (frame.src !== '' && new URL(frame.src, window.location.href).origin !== window.location.origin) {
      return 'inaccessible'
    }
    const doc = frame.contentDocument
    if (doc === null) {
      return 'no-document'
    }
    if (findCanvas(doc) === null) {
      return doc.readyState === 'loading' ? 'loading' : 'no-canvas'
    }
    return 'ok'
  } catch {
    return 'inaccessible'
  }
}

/** The non-standard Chrome heap report, absent everywhere else. */
interface HeapReport {
  memory?: { usedJSHeapSize?: number }
}

/** What the probe remembers about one koi between passes. */
interface FishProbe {
  health: FrameHealth | null
  buffer: string | null
  row: HTMLElement
  state: HTMLElement
  reading: HTMLElement
}

/** Reads which instances currently hold a layer in the scene. */
function livingInstances(root: HTMLElement): KoiInstanceId[] {
  const ids: KoiInstanceId[] = []
  for (const layer of root.querySelectorAll('.koi-layer[data-instance]')) {
    const id = (<HTMLElement>layer).dataset['instance']
    if (id !== undefined) {
      ids.push(<KoiInstanceId>id)
    }
  }
  return ids
}

/**
 * Mounts the vitals overlay into the pond root.
 *
 * @param root - The `#pond` element.
 * @returns The overlay handle the pond reports session events through.
 *
 * @example Arming the overlay when the visitor asked for it
 * ```typescript
 * const vitals = vitalsRequested(window.location.search) ? mountVitals(root) : null
 * vitals?.record('react:0', 'error:unresponsive', 'missed 3')
 * ```
 */
export function mountVitals(root: HTMLElement): PondVitals {
  const mountedAt = Date.now()
  const lines: string[] = []
  let previous: string[] = []
  let saveTimer: number | null = null
  let disposed = false
  // why: The watched canvases live inside frames the panel does not own, so their listeners are cut by one abort rather than enumerated.
  const canvasWatch = new AbortController()
  const watchedCanvases = new WeakMap<HTMLCanvasElement, { lost: boolean }>()
  const probes = new Map<KoiInstanceId, FishProbe>()

  const panel = document.createElement('section')
  panel.className = 'pond-vitals'
  panel.setAttribute('aria-label', 'Pond vitals')
  // why: The panel is chrome floating over the water — a press on it must read the panel, never strike the pond behind it.
  const contain = (event: Event): void => {
    event.stopPropagation()
  }
  panel.addEventListener('pointerdown', contain)
  panel.addEventListener('click', contain)

  const bar = document.createElement('div')
  bar.className = 'pond-vitals-bar'
  const title = document.createElement('span')
  title.textContent = 'vitals'
  bar.append(title)

  const log = document.createElement('ol')
  log.className = 'pond-vitals-log'

  const stamp = (): string => {
    const elapsed = Math.round((Date.now() - mountedAt) / 1000)
    return `${new Date().toISOString().slice(11, 19)} +${elapsed}s`
  }

  const persist = (): void => {
    saveTimer = null
    try {
      window.localStorage.setItem(VITALS_LOG_KEY, JSON.stringify({ savedAt: new Date().toISOString(), lines }))
    } catch {
      // why: A full or walled-off store must not take the live overlay down with it; the in-page log keeps working.
    }
  }

  const record = (instance: KoiInstanceId | null, kind: string, detail?: string): void => {
    if (disposed) {
      return
    }
    const line = `${stamp()} ${instance === null ? 'pond' : instance} ${kind}${detail === undefined ? '' : ` ${detail}`}`
    lines.push(line)
    if (lines.length > LOG_LIMIT) {
      lines.splice(0, lines.length - LOG_LIMIT)
    }
    const item = document.createElement('li')
    item.textContent = line
    log.append(item)
    while (log.childElementCount > SHOWN_LIMIT) {
      log.firstElementChild?.remove()
    }
    // why: The newest line is the one a visitor mid-incident needs on screen.
    log.scrollTop = log.scrollHeight
    if (instance !== null) {
      const probe = probes.get(instance)
      if (probe !== undefined) {
        probe.state.textContent = kind
      }
    }
    if (saveTimer === null) {
      saveTimer = window.setTimeout(persist, SAVE_DELAY_MS)
    }
  }

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'copy'
  copyButton.addEventListener('click', () => {
    const text = [...previous, ...(previous.length > 0 ? ['---- previous session above ----'] : []), ...lines].join('\n')
    navigator.clipboard?.writeText(text).then(
      () => {
        record(null, 'log-copied', `${lines.length} lines`)
      },
      () => {
        record(null, 'copy-failed')
      }
    )
  })
  const clearButton = document.createElement('button')
  clearButton.type = 'button'
  clearButton.textContent = 'clear'
  clearButton.addEventListener('click', () => {
    lines.length = 0
    previous = []
    log.replaceChildren()
    persist()
  })
  bar.append(copyButton, clearButton)

  const rows = document.createElement('div')
  rows.className = 'pond-vitals-rows'

  // why: The roster is alive — koi join and leave at a visitor's hand — so rows follow the layers the scene actually holds rather than a fixed rank of eight.
  const probeFor = (instance: KoiInstanceId): FishProbe => {
    let probe = probes.get(instance)
    if (probe !== undefined) {
      return probe
    }
    const row = document.createElement('div')
    row.className = 'pond-vitals-row'
    const name = document.createElement('span')
    name.textContent = instance
    const state = document.createElement('span')
    state.textContent = '·'
    const reading = document.createElement('span')
    reading.textContent = '·'
    row.append(name, state, reading)
    rows.append(row)
    probe = { health: null, buffer: null, row, state, reading }
    probes.set(instance, probe)
    return probe
  }

  panel.append(bar, rows, log)
  root.append(panel)

  try {
    const kept = window.localStorage.getItem(VITALS_LOG_KEY)
    if (kept !== null) {
      const parsed = <{ savedAt?: string; lines?: string[] }>JSON.parse(kept)
      if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        previous = parsed.lines
        record(null, 'previous-session', `${previous.length} lines kept from ${parsed.savedAt ?? 'an earlier run'}`)
      }
    }
  } catch {
    // why: A corrupt or unreadable keepsake is not worth failing the mount over.
  }

  const screenLine = `dpr=${window.devicePixelRatio} screen=${window.screen.width}x${window.screen.height} view=${Math.round(window.visualViewport?.width ?? window.innerWidth)}x${Math.round(window.visualViewport?.height ?? window.innerHeight)}`
  record(null, 'boot', `${screenLine} isolated=${window.crossOriginIsolated} cores=${navigator.hardwareConcurrency}`)
  record(null, 'agent', navigator.userAgent)

  const watchCanvas = (canvas: HTMLCanvasElement, instance: KoiInstanceId | null, label: string): void => {
    if (watchedCanvases.has(canvas)) {
      return
    }
    const state = { lost: false }
    watchedCanvases.set(canvas, state)
    canvas.addEventListener(
      'webglcontextlost',
      () => {
        state.lost = true
        record(instance, 'context-lost', label)
      },
      { signal: canvasWatch.signal }
    )
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        state.lost = false
        record(instance, 'context-restored', label)
      },
      { signal: canvasWatch.signal }
    )
  }

  const probeFish = (instance: KoiInstanceId, probe: FishProbe): void => {
    const layer = root.querySelector(`.koi-layer[data-instance="${instance}"]`)
    if (layer === null) {
      return
    }
    const health = classifyFrame(layer)
    if (health !== probe.health) {
      record(instance, 'frame', `${probe.health ?? 'unseen'} to ${health}`)
      probe.health = health
    }
    let reading: string = health
    let buffer: string | null = null
    try {
      const frame = layer.querySelector('iframe')
      const doc = frame?.contentDocument ?? null
      const canvas = doc === null ? null : findCanvas(doc)
      if (canvas !== null) {
        watchCanvas(canvas, instance, 'fish canvas')
        buffer = `${canvas.width}x${canvas.height}`
        // why: Loss is read from the listener's own memory, never by asking the canvas for a context — a probe that touches getContext would CREATE one on a canvas whose renderer failed, and on a context-starved device could evict the very context it came to observe.
        if (watchedCanvases.get(canvas)?.lost === true) {
          reading = 'context lost'
        }
      }
      const heap = (<HeapReport>(<unknown>frame?.contentWindow?.performance))?.memory?.usedJSHeapSize
      probe.reading.textContent = [buffer ?? '·', heap === undefined ? '·' : `${(heap / 1048576).toFixed(1)}MB`, reading].join(' ')
    } catch {
      probe.reading.textContent = reading
    }
    if (buffer !== null && probe.buffer !== null && buffer !== probe.buffer) {
      record(instance, 'buffer', `${probe.buffer} to ${buffer}`)
    }
    probe.buffer = buffer
  }

  const probeAll = (): void => {
    // why: What the browser says about this page belongs on screen beside the readings: a stopped scene and a hidden page look identical in a capture that shows only one of them.
    title.textContent = `vitals · ${document.visibilityState}`
    const living = new Set(livingInstances(root))
    for (const instance of living) {
      probeFish(instance, probeFor(instance))
    }
    for (const [instance, probe] of probes) {
      if (!living.has(instance)) {
        probe.row.remove()
        probes.delete(instance)
      }
    }
    const water = root.querySelector<HTMLCanvasElement>('#surface')
    if (water !== null) {
      watchCanvas(water, null, 'water canvas')
    }
  }

  const probeTimer = window.setInterval(probeAll, PROBE_INTERVAL_MS)

  return {
    record,
    dispose() {
      disposed = true
      canvasWatch.abort()
      window.clearInterval(probeTimer)
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
        persist()
      }
      panel.remove()
    },
  }
}
