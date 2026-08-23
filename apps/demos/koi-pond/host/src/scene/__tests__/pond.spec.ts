import type { KoiFramework, KoiOutline } from '@hyperfrontend/demo-koi-lib'
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

const { shells, createFakeShell, device } = vi.hoisted(() => {
  const shellsByInstance = new Map<string, FakeShell>()
  const profile = { tier: 'middle', cap: 8 }
  return {
    shells: shellsByInstance,
    device: profile,
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
          for (const handler of [...(handlers.get(event) ?? [])]) {
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

vi.mock('../water-gl', () => ({ createWaterPainter: () => null }))
vi.mock('../surface-canvas', () => ({ createSurfacePainter: () => ({ paint: () => {} }) }))
vi.mock('../floor', () => ({ paintFloor: () => {} }))
vi.mock('../interactions', () => ({ createInteractionsPainter: () => ({ paint: () => {}, clear: () => {} }) }))
vi.mock('../../runtime/device-tier', () => ({ readDeviceProfile: () => ({ ...device }) }))

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

/** Builds a pond root, raises the scene, and hands back its spies. */
function harness() {
  const root = document.createElement('div')
  root.id = 'pond'
  root.setPointerCapture = () => {}
  document.body.append(root)
  const onShoal = vi.fn()
  const onSequenceComplete = vi.fn()
  const onDiagnostic = vi.fn()
  const scene = createPond(root, { onShoal, onSequenceComplete, onDiagnostic })
  return { root, scene, onShoal, onSequenceComplete, onDiagnostic }
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
  vi.useFakeTimers()
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

describe('raising the pond', () => {
  it('opens each framework once, as its canonical instance', () => {
    harness()
    expect([...shells.keys()]).toEqual(['vanilla:0', 'react:0', 'vue:0', 'svelte:0', 'solid:0', 'preact:0', 'lit:0', 'angular:0'])
  })

  it('deals an identity carrying the instance ordinal on open', () => {
    harness()
    shellOf('react:0').emit('open')
    const identity = shellOf('react:0').sent.find((message) => message.type === 'identity')
    expect(identity?.data).toMatchObject({ framework: 'react', instance: 0 })
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
    const { scene, onDiagnostic } = harness()
    expect(scene.addKoi('react')).toBeNull()
    expect(onDiagnostic).toHaveBeenCalledWith(null, 'shoal:refused', expect.stringContaining('middle'))
  })

  it('leaves no session behind with a refusal', () => {
    const { scene } = harness()
    scene.addKoi('react')
    expect(scene.shoalState().roster).toHaveLength(8)
  })

  it('reports the grown roster to the gallery', () => {
    device.cap = 12
    const { scene, onShoal } = harness()
    scene.addKoi('react')
    expect(onShoal).toHaveBeenLastCalledWith(0, 9)
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
    expect(onShoal).toHaveBeenLastCalledWith(0, 8)
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
    expect(outcomes).toEqual([true, true, true, true, true, true, true, false])
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
    const firstSeed = (<{ seed: number }>shellOf('react:1').sent.find((message) => message.type === 'identity')?.data).seed
    scene.removeKoi('react:1')
    shellOf('react:1').emit('close')
    scene.addKoi('react')
    shellOf('react:1').emit('open')
    const secondSeed = (<{ seed: number }>shellOf('react:1').sent.find((message) => message.type === 'identity')?.data).seed
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
    expect(onShoal).toHaveBeenLastCalledWith(1, 9)
  })

  it('keeps the roster row lit while either twin answers', () => {
    device.cap = 12
    const { root, scene } = harness()
    scene.addKoi('react')
    shellOf('react:0').emit('open')
    shellOf('react:1').emit('open')
    shellOf('react:0').emit('status', { state: 'gone' })
    expect(root.querySelector('.koi-roster li a[data-fish="react"]')?.closest('li')?.dataset['connected']).toBe('true')
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
