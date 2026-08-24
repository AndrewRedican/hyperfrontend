import type { KoiFramework, KoiOutline } from '@hyperfrontend/demo-koi-lib'
import type { SceneScale } from '../../feature/wire-contract'
import type { KoiInstanceId } from '../instance-id'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPond } from '../pond'

/**
 * One faked koi shell: records what the pond sends and lets a spec speak as
 * the fish by emitting the session events the pond subscribed to.
 */
interface FakeShell {
  /** Mount attempts the pond made. */
  opened: number
  /** Polite closes the pond asked for. */
  closed: number
  /** Hard teardowns the pond asked for. */
  destroyed: number
  /** Every contract action the pond sent, in order. */
  sent: { type: string; data: unknown }[]
  /** Matches the shell surface; always `false` here. */
  isOpen: boolean
  /** Records a mount attempt. */
  open(): void
  /** Records a polite close. */
  close(): void
  /** Records a hard teardown. */
  destroy(): void
  /** Records a contract action. */
  send(type: string, data?: unknown): void
  /** Subscribes a pond handler. */
  on(event: string, handler: (data?: unknown) => void): () => void
  /** Speaks as the fish: fires the pond's handlers for an event. */
  emit(event: string, data?: unknown): void
}

const { shells, createFakeShell, device, water } = vi.hoisted(() => {
  const shellsByInstance = new Map<string, FakeShell>()
  const profile = { tier: 'middle', cap: 8 }
  return {
    shells: shellsByInstance,
    device: profile,
    water: { lost: false, tell: <() => void>(() => {}) },
    createFakeShell(id: string): FakeShell {
      const handlers = new Map<string, Set<(data?: unknown) => void>>()
      const shell: FakeShell = {
        opened: 0,
        closed: 0,
        destroyed: 0,
        sent: [],
        isOpen: false,
        open() {
          shell.opened += 1
        },
        close() {
          shell.closed += 1
        },
        destroy() {
          shell.destroyed += 1
        },
        send(type, data) {
          shell.sent.push({ type, data })
        },
        on(event, handler) {
          let set = handlers.get(event)
          if (set === undefined) {
            set = new Set()
            handlers.set(event, set)
          }
          set.add(handler)
          return () => {
            set?.delete(handler)
          }
        },
        emit(event, data) {
          for (const handler of handlers.get(event) ?? []) {
            handler(data)
          }
        },
      }
      shellsByInstance.set(id, shell)
      return shell
    },
  }
})

vi.mock('../koi-sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../koi-sessions')>()
  return {
    ...actual,
    openInstance: (stage: { layers: Map<string, HTMLElement>; surface: HTMLElement }, framework: string, ordinal: number) => {
      const id = `${framework}:${ordinal}`
      let layer = stage.layers.get(id)
      if (layer === undefined) {
        layer = document.createElement('div')
        layer.className = 'koi-layer'
        layer.dataset['fish'] = framework
        layer.dataset['instance'] = id
        stage.surface.before(layer)
        stage.layers.set(id, layer)
      }
      return { id, framework, ordinal, layer, shell: createFakeShell(id) }
    },
  }
})

// why: The GPU painter is stood in for rather than skipped, because losing its context is the one thing it tells the pond about and the one thing the pond acts on.
vi.mock('../water-gl', () => ({
  createWaterPainter: (_canvas: HTMLCanvasElement, onLost?: () => void) => {
    water.tell = onLost ?? (() => {})
    return { paint: () => {}, lost: () => water.lost }
  },
}))
vi.mock('../surface-canvas', () => ({ createSurfacePainter: () => ({ paint: () => {} }) }))
vi.mock('../floor', () => ({ paintFloor: () => {} }))
vi.mock('../interactions', () => ({ createInteractionsPainter: () => ({ paint: () => {}, clear: () => {} }) }))
// why: Only the hardware reading is stood in for; the frame-size banding is real arithmetic these specs drive through the root they measure.
vi.mock('../../runtime/device-tier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../runtime/device-tier')>()),
  readDeviceProfile: () => ({ ...device }),
}))

/**
 * Reads one instance's fake shell, failing loudly when the pond never made it.
 *
 * @param id - The instance whose shell to read.
 * @returns The fake shell.
 */
function shellOf(id: KoiInstanceId): FakeShell {
  const shell = shells.get(id)
  if (shell === undefined) {
    throw new Error(`no session was opened for ${id}`)
  }
  return shell
}

/**
 * Builds a pond root, raises the scene, and hands back its spies.
 *
 * The clock is pinned to an hour-eight boot, so a full scene always opens on
 * vanilla and counts up the roster from there; pass `null` to leave the scene
 * undecided. A frame left out reports jsdom's zeros, which the opening shoal
 * reads as a middling frame.
 *
 * @param scale - The scene to decide at boot, or `null` to hold the water empty.
 * @param frame - CSS dimensions the root pretends to have; jsdom's zeros otherwise.
 */
function harness(scale: SceneScale | null = 'full', frame?: { width: number; height: number }) {
  const root = document.createElement('div')
  root.id = 'pond'
  root.setPointerCapture = () => {}
  if (frame !== undefined) {
    Object.defineProperty(root, 'clientWidth', { value: frame.width, configurable: true })
    Object.defineProperty(root, 'clientHeight', { value: frame.height, configurable: true })
  }
  document.body.append(root)
  const onShoal = vi.fn<(connected: number, expected: number) => void>()
  const onSequenceComplete = vi.fn<(fish: number) => void>()
  const onDiagnostic = vi.fn<(instance: KoiInstanceId | null, kind: string, detail?: string) => void>()
  const scene = createPond(root, { onShoal, onSequenceComplete, onDiagnostic })
  if (scale !== null) {
    scene.setScale(scale)
  }
  return { root, scene, onShoal, onSequenceComplete, onDiagnostic }
}

/**
 * The seed the pond dealt one shell in its identity, failing loudly when none was sent.
 *
 * @param shell - The shell whose identity to read.
 * @returns The dealt seed.
 */
function identitySeed(shell: FakeShell): number {
  const identity = shell.sent.find((message) => message.type === 'identity')
  if (identity === undefined) {
    throw new Error('no identity was dealt')
  }
  return (<{ seed: number }>identity.data).seed
}

/**
 * Reads one part of the shoal panel, failing loudly when the panel never built it.
 *
 * @param root - The pond root.
 * @param selector - What to find inside the panel.
 * @returns The element.
 */
function panelPart<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const found = root.querySelector<T>(selector)
  if (found === null) {
    throw new Error(`the shoal panel has no ${selector}`)
  }
  return found
}

/**
 * Whether a koi was last told a visitor is on it.
 *
 * @param shell - The shell to read.
 * @returns `true` when the last hover notice lit it.
 */
function litUp(shell: FakeShell): boolean {
  const last = shell.sent.filter((message) => message.type === 'hover').at(-1)
  return last !== undefined && (<{ hovered: boolean }>last.data).hovered
}

/**
 * An outline whose nose sits at a pond point, as a fish would report it.
 *
 * @param framework - The reporting fish's framework.
 * @param x - Nose x in pond space.
 * @param y - Nose y in pond space.
 * @returns The outline.
 */
function outlineFor(framework: KoiFramework, x: number, y: number): KoiOutline {
  return {
    framework,
    spine: [
      { x, y },
      { x: x - 40, y },
      { x: x - 80, y },
    ],
    girth: [8, 14, 5],
    heading: 0,
    speed: 0,
    depth: 3,
    phase: 'relaxed',
  }
}

beforeEach(() => {
  shells.clear()
  device.tier = 'middle'
  device.cap = 8
  water.lost = false
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-23T08:15:00'))
  window.matchMedia = <typeof window.matchMedia>(<unknown>((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('deciding the scene', () => {
  it('opens nothing until the scene is decided', () => {
    harness(null)
    expect(shells.size).toBe(0)
  })

  it('opens the shoal its own frame carries for a full scene, in the deciding tick', () => {
    harness('full')
    expect([...shells.keys()]).toEqual(['vanilla:0', 'react:0', 'vue:0', 'svelte:0', 'solid:0'])
  })

  it('opens the hour koi alone for a card scene', () => {
    harness('card')
    expect([...shells.keys()]).toEqual(['vanilla:0'])
  })

  it('opens the hour koi alone for a card however much room the card has', () => {
    // why: A card is an invitation to expand rather than a scene in itself, so its shoal is one koi at any size.
    harness('card', { width: 1600, height: 900 })
    expect([...shells.keys()]).toEqual(['vanilla:0'])
  })

  it.each([
    ['a full desktop window', 1600, 900, 8],
    ['a tablet held upright', 768, 1024, 5],
    ['a phone held upright', 390, 844, 3],
    ['a frame barely bigger than a card', 300, 220, 1],
  ])('opens %s with the shoal that frame carries', (_frame, width, height, koi) => {
    device.cap = 12
    harness('full', { width, height })
    expect(shells.size).toBe(koi)
  })

  it('never opens a shoal the device cannot seat', () => {
    device.cap = 4
    harness('full', { width: 1600, height: 900 })
    expect(shells.size).toBe(4)
  })

  it('anchors the shoal on the local hour', () => {
    vi.setSystemTime(new Date('2026-08-23T14:15:00'))
    harness('full')
    expect([...shells.keys()]).toEqual(['lit:0', 'angular:0', 'vanilla:0', 'react:0', 'vue:0'])
  })

  it('wraps the shoal past the end of the roster', () => {
    vi.setSystemTime(new Date('2026-08-23T07:05:00'))
    harness('full')
    expect([...shells.keys()]).toEqual(['angular:0', 'vanilla:0', 'react:0', 'vue:0', 'svelte:0'])
  })

  it('ignores and diagnoses a scene that contradicts the decision', () => {
    const { scene, onDiagnostic } = harness('card')
    scene.setScale('full')
    expect(shells.size).toBe(1)
    expect(onDiagnostic).toHaveBeenCalledWith(null, 'scene:ignored', 'decided card, told full')
  })

  it('lets the decided scene be repeated without complaint', () => {
    const { scene, onDiagnostic } = harness('full')
    scene.setScale('full')
    expect(onDiagnostic).not.toHaveBeenCalledWith(null, 'scene:ignored', expect.anything())
  })

  it('deals an identity carrying the instance ordinal on open', () => {
    harness()
    shellOf('react:0').emit('open')
    const identity = shellOf('react:0').sent.find((message) => message.type === 'identity')
    expect(identity?.data).toMatchObject({ framework: 'react', instance: 0 })
  })
})

describe('the card profile', () => {
  it('derives the card world from the frame itself', () => {
    harness('card', { width: 288, height: 180 })
    shellOf('vanilla:0').emit('open')
    const world = shellOf('vanilla:0').sent.find((message) => message.type === 'pond')
    expect(world?.data).toMatchObject({ width: 288, height: 180 })
  })

  it('keeps the full world derived from the screen', () => {
    harness('full', { width: 288, height: 180 })
    shellOf('vanilla:0').emit('open')
    const world = shellOf('vanilla:0').sent.find((message) => message.type === 'pond')
    // why: jsdom reports no screen, so the screen-derived world sits at the clamp floor — the point is that a small frame did not shrink it.
    expect(world?.data).toMatchObject({ width: 800, height: 600 })
  })

  it('sends the resting hold as soon as the card koi opens', () => {
    harness('card')
    shellOf('vanilla:0').emit('open')
    const pause = shellOf('vanilla:0').sent.find((message) => message.type === 'pause')
    expect(pause?.data).toEqual({ paused: true, resting: true })
  })

  it('sends no hold when a full-scene koi opens', () => {
    harness('full')
    shellOf('vanilla:0').emit('open')
    expect(shellOf('vanilla:0').sent.some((message) => message.type === 'pause')).toBe(false)
  })

  it('seats the card koi in the middle of the card', () => {
    harness('card', { width: 288, height: 180 })
    shellOf('vanilla:0').emit('open')
    const seat = shellOf('vanilla:0').sent.find((message) => message.type === 'place')
    expect(seat?.data).toEqual({ x: 144, y: 90 })
  })

  it('seats no full-scene koi anywhere', () => {
    harness('full')
    shellOf('vanilla:0').emit('open')
    expect(shellOf('vanilla:0').sent.some((message) => message.type === 'place')).toBe(false)
  })

  it('returns a released card koi to its resting hold', () => {
    const { root } = harness('card')
    shellOf('vanilla:0').emit('open')
    shellOf('vanilla:0').emit('outline', outlineFor('vanilla', 400, 300))
    root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
    root.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }))
    root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
    root.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }))
    const lastPause = shellOf('vanilla:0')
      .sent.filter((message) => message.type === 'pause')
      .at(-1)
    expect(lastPause?.data).toEqual({ paused: true, resting: true })
  })
})

describe('growing the shoal', () => {
  it('adds another koi of a framework under the cap', () => {
    device.cap = 12
    const { scene } = harness()
    expect(scene.addKoi('react')).toBe('react:1')
  })

  it('raises a layer and opens the newcomer', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    expect(root.querySelector('.koi-layer[data-instance="react:1"]') !== null && shellOf('react:1').opened).toBe(1)
  })

  it('refuses the koi past the cap and diagnoses the tier', () => {
    device.cap = 3
    const { scene, onDiagnostic } = harness()
    expect(scene.addKoi('react')).toBeNull()
    expect(onDiagnostic).toHaveBeenCalledWith(null, 'shoal:refused', expect.stringContaining('middle'))
  })

  it('leaves no session behind with a refusal', () => {
    device.cap = 3
    const { scene } = harness()
    scene.addKoi('react')
    expect(scene.shoalState().roster).toHaveLength(3)
  })

  it('reports the grown roster to the gallery', () => {
    device.cap = 12
    const { scene, onShoal } = harness()
    scene.addKoi('react')
    expect(onShoal).toHaveBeenLastCalledWith(0, 6)
  })

  it('diagnoses the koi it took in and the roster it grew to', () => {
    device.cap = 12
    const { scene, onDiagnostic } = harness()
    scene.addKoi('react')
    expect(onDiagnostic).toHaveBeenCalledWith('react:1', 'added', '6 of 12 koi')
  })
})

describe('shrinking the shoal', () => {
  it('closes politely before any teardown', () => {
    device.cap = 12
    const { scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    const shell = shellOf('react:1')
    expect([shell.closed, shell.destroyed]).toEqual([1, 0])
  })

  it('tears the layer down once the close lands', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    shellOf('react:1').emit('close')
    expect(root.querySelector('.koi-layer[data-instance="react:1"]')).toBeNull()
  })

  it('tears the layer down after the grace when the close never lands', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    vi.advanceTimersByTime(4000)
    expect(root.querySelector('.koi-layer[data-instance="react:1"]')).toBeNull()
  })

  it('reports the shrunk roster through the churn', () => {
    device.cap = 12
    const { scene, onShoal } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    expect(onShoal).toHaveBeenLastCalledWith(0, 5)
  })

  it('diagnoses the koi it let go and the roster it shrank to', () => {
    device.cap = 12
    const { scene, onDiagnostic } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    expect(onDiagnostic).toHaveBeenCalledWith('react:1', 'removed', '5 of 12 koi')
  })

  it('cancels a revive still pending for a removed koi', () => {
    device.cap = 12
    const { scene, onDiagnostic } = harness()
    scene.addKoi('react')
    shellOf('react:1').emit('open')
    shellOf('react:1').emit('error', { reason: 'unresponsive' })
    scene.removeKoi('react:1')
    vi.advanceTimersByTime(120_000)
    expect(onDiagnostic).not.toHaveBeenCalledWith('react:1', 'revive:reopened', expect.anything())
  })

  it('refuses to empty the pond', () => {
    const { scene, onDiagnostic } = harness()
    const roster = scene.shoalState().roster.map((member) => member.id)
    const outcomes = roster.map((id) => scene.removeKoi(id))
    expect(outcomes).toEqual([true, true, true, true, false])
    expect(onDiagnostic).toHaveBeenCalledWith(null, 'shoal:refused', 'the pond is never empty')
  })

  it('has nothing to remove for an id it does not hold', () => {
    const { scene } = harness()
    expect(scene.removeKoi('react:5')).toBe(false)
  })
})

describe('the ordinal deal', () => {
  it('keeps a leaving ordinal spoken for until its layer is gone', () => {
    device.cap = 12
    const { scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    expect(scene.addKoi('react')).toBe('react:2')
  })

  it('re-deals a freed ordinal once the teardown lands', () => {
    device.cap = 12
    const { scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    shellOf('react:1').emit('close')
    expect(scene.addKoi('react')).toBe('react:1')
  })

  it('deals a re-added twin the seed it left with', () => {
    device.cap = 12
    const { scene } = harness()
    scene.addKoi('react')
    shellOf('react:1').emit('open')
    const firstSeed = identitySeed(shellOf('react:1'))
    scene.removeKoi('react:1')
    shellOf('react:1').emit('close')
    scene.addKoi('react')
    shellOf('react:1').emit('open')
    const secondSeed = identitySeed(shellOf('react:1'))
    // why: The variant seed is a pure function of framework and ordinal — the same fish comes back, and that determinism is the feature.
    expect(secondSeed).toBe(firstSeed)
  })
})

describe('twins in the scene', () => {
  it('keeps each twin its own presence', () => {
    device.cap = 12
    const { scene, onShoal } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    shellOf('react:0').emit('status', { state: 'gone' })
    expect(onShoal).toHaveBeenLastCalledWith(1, 6)
  })

  it('keeps the panel row lit while either twin answers', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    shellOf('react:0').emit('status', { state: 'gone' })
    expect(panelPart(root, '.koi-shoal-row[data-fish="react"]').dataset['connected']).toBe('true')
  })

  it('holds one twin without pausing the other', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    // why: The pointer at the frame's top-left corner reads as the centre of the virtual pond's view; only the twin reporting its body there is under the hand.
    shellOf('react:0').emit('outline', outlineFor('react', 400, 300))
    shellOf('react:1').emit('outline', outlineFor('react', 700, 500))
    root.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))
    const paused = (shell: FakeShell) =>
      shell.sent.some((message) => message.type === 'pause' && (<{ paused: boolean }>message.data).paused)
    expect([paused(shellOf('react:0')), paused(shellOf('react:1'))]).toEqual([true, false])
  })
})

describe('the shoal panel', () => {
  it('counts the koi a framework has in its badge', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    expect(panelPart(root, '.koi-shoal-row[data-fish="react"] .koi-shoal-tally').textContent).toBe('2 in the pond')
  })

  it('hides the badge for a framework with no koi in the water', () => {
    const { root } = harness()
    expect(panelPart<HTMLElement>(root, '.koi-shoal-row[data-fish="preact"] .koi-shoal-tally').hidden).toBe(true)
  })

  it('lights a row only once one of its koi answers', () => {
    const { root } = harness()
    const before = panelPart(root, '.koi-shoal-row[data-fish="react"]').dataset['connected']
    shellOf('react:0').emit('open')
    expect([before, panelPart(root, '.koi-shoal-row[data-fish="react"]').dataset['connected']]).toEqual(['false', 'true'])
  })

  it('gives every living koi its own control', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    expect(
      [...root.querySelectorAll('.koi-shoal-row[data-fish="react"] .koi-shoal-instance')].map((control) => control.textContent)
    ).toEqual(['1×', '2×'])
  })

  it('takes a removed koi and its control away together', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    scene.removeKoi('react:1')
    expect(root.querySelector('.koi-shoal-instance[data-instance="react:1"]')).toBeNull()
  })

  it('grows the shoal when a row add control is pressed', () => {
    device.cap = 12
    const { root } = harness()
    panelPart<HTMLButtonElement>(root, '.koi-shoal-add[data-fish="react"]').click()
    expect(shells.has('react:1')).toBe(true)
  })

  it('sends a koi away when its own control is pressed', () => {
    const { root } = harness()
    panelPart<HTMLButtonElement>(root, '.koi-shoal-instance[data-instance="react:0"]').click()
    expect(shellOf('react:0').closed).toBe(1)
  })

  it('stands every add control down at the cap', () => {
    device.cap = 3
    const { root } = harness()
    expect([...root.querySelectorAll<HTMLButtonElement>('.koi-shoal-add')].every((control) => control.disabled)).toBe(true)
  })

  it('names the tier that decided the ceiling on the control it stood down', () => {
    device.cap = 3
    const { root } = harness()
    expect(panelPart<HTMLButtonElement>(root, '.koi-shoal-add[data-fish="react"]').title).toBe('A middle-tier device seats 3 koi.')
  })

  it('offers the adds again once the shoal drops under the cap', () => {
    device.cap = 3
    const { root, scene } = harness()
    scene.removeKoi('vue:0')
    expect(panelPart<HTMLButtonElement>(root, '.koi-shoal-add[data-fish="react"]').disabled).toBe(false)
  })

  it('refuses to offer the removal of the last koi', () => {
    const { root, scene } = harness()
    scene.removeKoi('react:0')
    scene.removeKoi('vue:0')
    scene.removeKoi('svelte:0')
    scene.removeKoi('solid:0')
    const last = panelPart<HTMLButtonElement>(root, '.koi-shoal-instance[data-instance="vanilla:0"]')
    expect([last.disabled, last.title]).toEqual([true, 'The pond is never empty.'])
  })

  it('says how much room the device has left', () => {
    device.cap = 12
    const { root } = harness()
    expect(panelPart(root, '.koi-shoal-note').textContent).toBe('Room for 7 more.')
  })

  it('keeps the koi in seeded order as ordinals are re-dealt', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    scene.addKoi('react')
    scene.removeKoi('react:1')
    shellOf('react:1').emit('close')
    scene.addKoi('react')
    expect(
      [...root.querySelectorAll('.koi-shoal-row[data-fish="react"] .koi-shoal-instance')].map((control) => control.textContent)
    ).toEqual(['1×', '2×', '3×'])
  })

  it('carries focus to the newcomer when the press that made it reached the cap', () => {
    device.cap = 6
    const { root } = harness()
    const add = panelPart<HTMLButtonElement>(root, '.koi-shoal-add[data-fish="react"]')
    add.focus()
    add.click()
    expect(document.activeElement).toBe(panelPart(root, '.koi-shoal-instance[data-instance="react:1"]'))
  })

  it('carries focus to the row when the koi holding it is removed', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    panelPart<HTMLButtonElement>(root, '.koi-shoal-instance[data-instance="react:1"]').focus()
    scene.removeKoi('react:1')
    expect(document.activeElement).toBe(panelPart(root, '.koi-shoal-add[data-fish="react"]'))
  })
})

describe('identity without a pointer', () => {
  it('lights every answering koi of a framework from its row', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    panelPart<HTMLElement>(root, '.koi-shoal-name[data-fish="react"]').focus()
    expect([litUp(shellOf('react:0')), litUp(shellOf('react:1'))]).toEqual([true, true])
  })

  it('leaves a koi that is not answering unlit', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    panelPart<HTMLElement>(root, '.koi-shoal-name[data-fish="react"]').focus()
    expect([litUp(shellOf('react:0')), litUp(shellOf('react:1'))]).toEqual([true, false])
  })

  it('lights only the koi whose own control took focus', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    panelPart<HTMLButtonElement>(root, '.koi-shoal-instance[data-instance="react:1"]').focus()
    expect([litUp(shellOf('react:0')), litUp(shellOf('react:1'))]).toEqual([false, true])
  })

  it('marks that koi own row entry as the lit one', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:1').emit('open')
    panelPart<HTMLButtonElement>(root, '.koi-shoal-instance[data-instance="react:1"]').focus()
    expect(panelPart(root, '.koi-shoal-instances li[data-instance="react:1"]').dataset['hovered']).toBe('true')
  })

  it('puts every koi out again when the panel loses focus', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    const link = panelPart<HTMLElement>(root, '.koi-shoal-name[data-fish="react"]')
    link.focus()
    link.blur()
    expect([litUp(shellOf('react:0')), litUp(shellOf('react:1'))]).toEqual([false, false])
  })

  it('keeps a framework with nothing in the water out of the tab order', () => {
    const { root } = harness()
    expect(panelPart<HTMLAnchorElement>(root, '.koi-shoal-name[data-fish="svelte"]').tabIndex).toBe(-1)
  })
})

describe('the interactions control', () => {
  it('round-trips the overlay through the panel', () => {
    const { root } = harness()
    const control = panelPart<HTMLButtonElement>(root, '.koi-shoal-interactions')
    control.click()
    const on = control.getAttribute('aria-pressed')
    control.click()
    expect([on, control.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
  })

  it('reflects an overlay the scene was told to draw', () => {
    const { root, scene } = harness()
    scene.setInteractions(true)
    expect(panelPart(root, '.koi-shoal-interactions').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('the panel in a narrow pond', () => {
  it('collapses to a pill under the threshold', () => {
    const { root } = harness('full', { width: 400, height: 720 })
    const panel = panelPart<HTMLElement>(root, '.koi-shoal')
    expect([panel.dataset['narrow'], panel.dataset['collapsed']]).toEqual(['true', 'true'])
  })

  it('stays open in a pond with room for it', () => {
    const { root } = harness('full', { width: 1200, height: 800 })
    const panel = panelPart<HTMLElement>(root, '.koi-shoal')
    expect([panel.dataset['narrow'], panel.dataset['collapsed']]).toEqual(['false', 'false'])
  })

  it('opens the pill when it is pressed', () => {
    const { root } = harness('full', { width: 400, height: 720 })
    panelPart<HTMLButtonElement>(root, '.koi-shoal-pill').click()
    expect(panelPart(root, '.koi-shoal').dataset['collapsed']).toBe('false')
  })

  it('says what the pill is standing for', () => {
    const { root } = harness('full', { width: 400, height: 720 })
    expect(panelPart(root, '.koi-shoal-summary').textContent).toBe('3 of 8 koi')
  })
})

describe('water the browser reclaimed', () => {
  /** Longer than the grace the water gives a browser to restore the context it took. */
  const AFTER_THE_GRACE_MS = 2000

  /**
   * Takes the visitor away from the pond and brings them back.
   *
   * The watch settles on `document.visibilityState`, so that is what a spec
   * changes; the announcement is what the pond acts on.
   */
  function away(): void {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
  }

  /** Speaks as the browser taking the water's context away. */
  function takeTheContext(): void {
    water.lost = true
    water.tell()
  }

  it('hangs a new surface for water whose context never came back', () => {
    const { root, onDiagnostic } = harness()
    const before = root.querySelector('#surface')
    takeTheContext()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    // why: A context that was lost and never restored can never be replaced on the canvas that held it, so the element itself has to go; without this the pond simply has no water for the rest of the visit.
    expect(root.querySelector('#surface')).not.toBe(before)
    expect(onDiagnostic).toHaveBeenCalledWith(null, 'water:reseated', expect.any(String))
  })

  it('lets a browser that restores the context keep the canvas it restored it on', () => {
    const { root, onDiagnostic } = harness()
    const before = root.querySelector('#surface')
    takeTheContext()
    water.lost = false
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    expect(root.querySelector('#surface')).toBe(before)
    expect(onDiagnostic).not.toHaveBeenCalledWith(null, 'water:reseated', expect.any(String))
  })

  it('waits for the visitor before building a context for a hidden pond', () => {
    const { root } = harness()
    const before = root.querySelector('#surface')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    takeTheContext()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    // why: Building a GPU context for a page nobody is looking at is the very cost the sleep was for.
    expect(root.querySelector('#surface')).toBe(before)
    away()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    expect(root.querySelector('#surface')).not.toBe(before)
  })

  it('leaves a surface nothing happened to exactly where it is', () => {
    const { root } = harness()
    const before = root.querySelector('#surface')
    away()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    expect(root.querySelector('#surface')).toBe(before)
  })

  it('hangs the new surface over the koi and under the overlay', () => {
    const { root } = harness()
    takeTheContext()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    const surface = root.querySelector('#surface')
    // why: The stacking is DOM order: a surface hung in the wrong place would put the water under the fish or over the marks the overlay draws on it.
    expect(surface?.compareDocumentPosition(<Node>root.querySelector('#interactions'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(root.querySelector('.koi-layer')?.compareDocumentPosition(<Node>surface)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('keeps seating later koi under the surface it hung', () => {
    const { root, scene } = harness()
    takeTheContext()
    vi.advanceTimersByTime(AFTER_THE_GRACE_MS)
    scene.addKoi('lit')
    const surface = root.querySelector('#surface')
    for (const layer of root.querySelectorAll('.koi-layer')) {
      expect(layer.compareDocumentPosition(<Node>surface)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    }
  })
})
