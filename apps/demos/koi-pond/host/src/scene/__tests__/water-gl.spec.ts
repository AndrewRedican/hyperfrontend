import type { SurfaceFrame } from '../surface-canvas'
import { describe, expect, it, vi } from 'vitest'
import { createRippleField } from '../ripples'
import { createWaterPainter } from '../water-gl'

/** One frame of water, at a size and a ratio a spec can recognise in the calls it produces. */
const FRAME: SurfaceFrame = {
  width: 800,
  height: 600,
  view: { x: 40, y: 25 },
  pixelRatio: 2,
  fishLength: 120,
  elapsedMs: 4000,
  reducedMotion: false,
  fade: 0,
  field: createRippleField(),
}

/** A stand-in GPU call: the painter's arguments are never inspected, only the fact and the order of the calls. */
type Ignoring<T> = (...args: never[]) => T

/**
 * A GPU that answers every call the painter makes, and remembers them.
 *
 * The environment carries no GPU and none is wanted: what these specs ask is
 * whether the painter draws, stops when its context is taken, and builds
 * everything again when it is given back, and all three are visible in the
 * calls alone.
 *
 * @param options - Whether the program links, so the failure path can be driven too.
 * @returns The stand-in context.
 */
function fakeGl(options: { links?: boolean } = {}) {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    COLOR_BUFFER_BIT: 8,
    TRIANGLES: 9,
    lost: false,
    createShader: vi.fn<Ignoring<object>>(() => ({})),
    shaderSource: vi.fn<Ignoring<void>>(),
    compileShader: vi.fn<Ignoring<void>>(),
    getShaderParameter: vi.fn<Ignoring<boolean>>(() => true),
    deleteShader: vi.fn<Ignoring<void>>(),
    createProgram: vi.fn<Ignoring<object>>(() => ({})),
    attachShader: vi.fn<Ignoring<void>>(),
    linkProgram: vi.fn<Ignoring<void>>(),
    getProgramParameter: vi.fn<Ignoring<boolean>>(() => options.links !== false),
    useProgram: vi.fn<Ignoring<void>>(),
    createBuffer: vi.fn<Ignoring<object>>(() => ({})),
    bindBuffer: vi.fn<Ignoring<void>>(),
    bufferData: vi.fn<Ignoring<void>>(),
    getAttribLocation: vi.fn<Ignoring<number>>(() => 0),
    enableVertexAttribArray: vi.fn<Ignoring<void>>(),
    vertexAttribPointer: vi.fn<Ignoring<void>>(),
    getUniformLocation: vi.fn<Ignoring<object>>(() => ({})),
    isContextLost: vi.fn<Ignoring<boolean>>(function (this: { lost: boolean }) {
      return this.lost
    }),
    viewport: vi.fn<Ignoring<void>>(),
    uniform1f: vi.fn<Ignoring<void>>(),
    uniform1i: vi.fn<Ignoring<void>>(),
    uniform2f: vi.fn<Ignoring<void>>(),
    uniform4fv: vi.fn<Ignoring<void>>(),
    clearColor: vi.fn<Ignoring<void>>(),
    clear: vi.fn<Ignoring<void>>(),
    drawArrays: vi.fn<Ignoring<void>>(),
  }
}

/**
 * A surface canvas backed by a GPU that answers.
 *
 * @param options - Whether the program links.
 * @returns The canvas, its context, and the painter bound to them.
 */
function surface(options: { links?: boolean } = {}) {
  const canvas = document.createElement('canvas')
  const gl = fakeGl(options)
  canvas.getContext = <HTMLCanvasElement['getContext']>(<unknown>vi.fn<Ignoring<unknown>>(() => gl))
  return { canvas, gl, painter: createWaterPainter(canvas) }
}

/**
 * Tells a canvas its context has gone the way a browser does.
 *
 * @param canvas - The surface canvas.
 * @returns The event, so a spec can ask whether the painter asked for the context back.
 */
function loseContext(canvas: HTMLCanvasElement): Event {
  const lost = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(lost)
  return lost
}

describe('createWaterPainter', () => {
  it('paints the water on the context it was given', () => {
    const { gl, painter } = surface()
    painter?.paint(FRAME)
    expect(gl.drawArrays).toHaveBeenCalledTimes(1)
    // how: The buffer renders below device resolution on purpose, so the viewport it is given is the one the painter sized rather than the frame's own.
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, expect.any(Number), expect.any(Number))
  })

  it('hands nothing back where the page has no WebGL at all', () => {
    const canvas = document.createElement('canvas')
    canvas.getContext = <HTMLCanvasElement['getContext']>(<unknown>vi.fn<Ignoring<null>>(() => null))
    expect(createWaterPainter(canvas)).toBeNull()
  })

  it('hands nothing back where the program will not link', () => {
    expect(surface({ links: false }).painter).toBeNull()
  })

  it('asks the browser for the context back when it is taken', () => {
    const { canvas, painter } = surface()
    expect(painter).not.toBeNull()
    // why: A browser restores only a context the page said it still wanted, and preventing this event's default is the whole of that request. Without it the water never returns from a backgrounded tab.
    expect(loseContext(canvas).defaultPrevented).toBe(true)
  })

  it('tells its owner the moment the context goes', () => {
    const canvas = document.createElement('canvas')
    canvas.getContext = <HTMLCanvasElement['getContext']>(<unknown>vi.fn<Ignoring<unknown>>(() => fakeGl()))
    const told = vi.fn<() => void>()
    createWaterPainter(canvas, told)
    expect(told).not.toHaveBeenCalled()
    loseContext(canvas)
    // why: The loss lands well after a tab comes back, because it is the koi waking and rebuilding contexts of their own that costs the water its one. An owner that asked at the moment of return would always ask too early.
    expect(told).toHaveBeenCalledTimes(1)
  })

  it('reports itself lost until a context comes back', () => {
    const { canvas, gl, painter } = surface()
    expect(painter?.lost?.()).toBe(false)
    loseContext(canvas)
    gl.lost = true
    expect(painter?.lost?.()).toBe(true)
    gl.lost = false
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(painter?.lost?.()).toBe(false)
  })

  it('stops painting while the context is gone', () => {
    const { canvas, gl, painter } = surface()
    loseContext(canvas)
    gl.lost = true
    painter?.paint(FRAME)
    expect(gl.drawArrays).not.toHaveBeenCalled()
  })

  it('builds everything the lost context owned again when it comes back', () => {
    const { canvas, gl, painter } = surface()
    loseContext(canvas)
    gl.lost = true
    painter?.paint(FRAME)
    gl.lost = false
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    painter?.paint(FRAME)
    // why: Every shader, program and buffer belonged to the context that died with it, so a restored context needs the whole scene built into it before a single frame can be drawn.
    expect(gl.createProgram).toHaveBeenCalledTimes(2)
    expect(gl.bufferData).toHaveBeenCalledTimes(2)
    expect(gl.drawArrays).toHaveBeenCalledTimes(1)
  })

  it('sizes the buffer again on the first frame after a restore', () => {
    const { canvas, gl, painter } = surface()
    painter?.paint(FRAME)
    loseContext(canvas)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    painter?.paint(FRAME)
    // why: A restored context starts at the canvas's own default size, so a painter that remembered sizing the last one would draw the water into a corner of it.
    expect(gl.viewport).toHaveBeenCalledTimes(2)
  })

  it('paints nothing for a surface with no size', () => {
    const { gl, painter } = surface()
    painter?.paint({ ...FRAME, width: 0 })
    expect(gl.drawArrays).not.toHaveBeenCalled()
  })
})
