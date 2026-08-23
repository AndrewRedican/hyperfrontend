import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyFrame, mountVitals, vitalsRequested } from '../vitals'
import type { PondVitals } from '../vitals'

/** Where the opt-in flag lives, mirrored from the module. */
const FLAG_KEY = 'koi-pond:vitals'

/** Where the log keepsake lives, mirrored from the module. */
const LOG_KEY = 'koi-pond:vitals-log'

/** Every overlay mounted in a test, so no probe timer outlives it. */
const mounted: PondVitals[] = []

/**
 * Raises a bare koi layer the probe can find.
 *
 * @param root - The pond root.
 * @param instance - The instance id the layer carries.
 * @returns The layer.
 */
function addKoiLayer(root: HTMLElement, instance: string): HTMLElement {
  const layer = document.createElement('div')
  layer.className = 'koi-layer'
  layer.dataset['fish'] = instance.slice(0, instance.indexOf(':'))
  layer.dataset['instance'] = instance
  root.append(layer)
  return layer
}

/** Builds a pond root and mounts the overlay into it. */
function harness() {
  const root = document.createElement('div')
  document.body.append(root)
  const vitals = mountVitals(root)
  mounted.push(vitals)
  return { root, vitals }
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})

afterEach(() => {
  for (const vitals of mounted.splice(0)) {
    vitals.dispose()
  }
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('the vitals opt-in', () => {
  it('arms on the query flag and remembers the choice', () => {
    expect(vitalsRequested('?vitals=1')).toBe(true)
    expect(vitalsRequested('')).toBe(true)
    expect(window.localStorage.getItem(FLAG_KEY)).toBe('1')
  })

  it('stands down on the off flag and forgets', () => {
    vitalsRequested('?vitals=1')
    expect(vitalsRequested('?vitals=0')).toBe(false)
    expect(vitalsRequested('')).toBe(false)
    expect(window.localStorage.getItem(FLAG_KEY)).toBeNull()
  })
})

describe('the frame classifier', () => {
  it('reports a layer with no mount at all', () => {
    const layer = document.createElement('div')
    expect(classifyFrame(layer)).toBe('no-frame')
  })

  it('reports a frame whose document is unreachable', () => {
    const layer = document.createElement('div')
    layer.append(document.createElement('iframe'))
    expect(classifyFrame(layer)).toBe('no-document')
  })

  it('reports a loaded document that never drew', () => {
    const layer = document.createElement('div')
    document.body.append(layer)
    const frame = document.createElement('iframe')
    layer.append(frame)
    expect(classifyFrame(layer)).toBe('no-canvas')
  })

  it('reports a healthy frame once its canvas exists', () => {
    const layer = document.createElement('div')
    document.body.append(layer)
    const frame = document.createElement('iframe')
    layer.append(frame)
    const doc = frame.contentDocument
    doc?.body.append(doc.createElement('canvas'))
    expect(classifyFrame(layer)).toBe('ok')
  })

  it('reads a koi served from another origin as unreachable, never as dead', () => {
    const layer = document.createElement('div')
    document.body.append(layer)
    const frame = document.createElement('iframe')
    frame.src = 'https://demo-koi-fish-react-production.up.railway.app/'
    layer.append(frame)
    expect(classifyFrame(layer)).toBe('inaccessible')
  })

  it('finds a canvas a web-component koi keeps inside its shadow root', () => {
    const layer = document.createElement('div')
    document.body.append(layer)
    const frame = document.createElement('iframe')
    layer.append(frame)
    const doc = frame.contentDocument
    if (doc === null) {
      throw new Error('jsdom gave the iframe no document')
    }
    const host = doc.createElement('div')
    const shadow = host.attachShadow({ mode: 'open' })
    shadow.append(doc.createElement('canvas'))
    doc.body.append(host)
    expect(classifyFrame(layer)).toBe('ok')
  })
})

describe('the vitals overlay', () => {
  it('logs what the pond reports and badges the koi it names', () => {
    const { root, vitals } = harness()
    addKoiLayer(root, 'react:0')
    vi.advanceTimersByTime(5000)
    vitals.record('react:0', 'error:unresponsive', 'missed 3')
    const log = root.querySelector('.pond-vitals-log')
    expect(log?.textContent).toContain('react:0 error:unresponsive missed 3')
    const badges = [...root.querySelectorAll('.pond-vitals-row')].map((row) => row.textContent)
    expect(badges.some((text) => text?.includes('react:0') === true && text.includes('error:unresponsive'))).toBe(true)
  })

  it('keeps the log for the next page in storage', () => {
    const { vitals } = harness()
    vitals.record(null, 'page-hidden')
    vi.advanceTimersByTime(1500)
    const kept = window.localStorage.getItem(LOG_KEY)
    expect(kept).toContain('page-hidden')
  })

  it('brings a previous page death back as evidence', () => {
    window.localStorage.setItem(LOG_KEY, JSON.stringify({ savedAt: '2026-08-21T10:00:00Z', lines: ['old line'] }))
    const { root } = harness()
    expect(root.querySelector('.pond-vitals-log')?.textContent).toContain('previous-session')
  })

  it('notices a koi layer with nothing in it on the next probe', () => {
    const { root } = harness()
    addKoiLayer(root, 'vanilla:0')
    vi.advanceTimersByTime(5000)
    expect(root.querySelector('.pond-vitals-log')?.textContent).toContain('vanilla:0 frame unseen to no-frame')
  })

  it('keeps one row per living instance, twins included', () => {
    const { root } = harness()
    addKoiLayer(root, 'react:0')
    addKoiLayer(root, 'react:1')
    vi.advanceTimersByTime(5000)
    expect(root.querySelectorAll('.pond-vitals-row')).toHaveLength(2)
  })

  it('drops the row of an instance whose layer left the scene', () => {
    const { root } = harness()
    const layer = addKoiLayer(root, 'react:1')
    vi.advanceTimersByTime(5000)
    layer.remove()
    vi.advanceTimersByTime(5000)
    expect(root.querySelectorAll('.pond-vitals-row')).toHaveLength(0)
  })

  it('shows only its window of the log however long the session runs', () => {
    const { root, vitals } = harness()
    for (let index = 0; index < 500; index += 1) {
      vitals.record(null, 'line', String(index))
    }
    expect(root.querySelectorAll('.pond-vitals-log li').length).toBeLessThanOrEqual(120)
  })

  it('leaves nothing behind on dispose', () => {
    const { root, vitals } = harness()
    vitals.dispose()
    expect(root.querySelector('.pond-vitals')).toBeNull()
  })
})
