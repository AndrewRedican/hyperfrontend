import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
type TypedArraysModule = typeof import('./index')

const originalSharedArrayBuffer = globalThis.SharedArrayBuffer

describe('typed-arrays without a SharedArrayBuffer global', () => {
  const loadWithoutSharedArrayBuffer = async (): Promise<TypedArraysModule> => {
    jest.resetModules()
    delete (globalThis as { SharedArrayBuffer?: SharedArrayBufferConstructor }).SharedArrayBuffer
    return import('./index')
  }

  afterEach(() => {
    globalThis.SharedArrayBuffer = originalSharedArrayBuffer
  })

  it('imports without throwing', async () => {
    await expect(loadWithoutSharedArrayBuffer()).resolves.toBeDefined()
  })

  it('creates a Uint8Array from a number array', async () => {
    const { createUint8Array } = await loadWithoutSharedArrayBuffer()
    expect([...createUint8Array([1, 2])]).toEqual([1, 2])
  })

  it('treats a plain object as array-like input instead of a buffer', async () => {
    const { createUint8Array } = await loadWithoutSharedArrayBuffer()
    expect([...createUint8Array({ length: 1, 0: 7 } as ArrayLike<number>)]).toEqual([7])
  })

  it('throws a TypeError from createSharedArrayBuffer', async () => {
    const { createSharedArrayBuffer } = await loadWithoutSharedArrayBuffer()
    expect(() => createSharedArrayBuffer(8)).toThrow(new TypeError('SharedArrayBuffer is not available in this environment'))
  })
})

describe('typed-arrays with the SharedArrayBuffer global present', () => {
  it('creates a Uint8Array view over a SharedArrayBuffer', async () => {
    jest.resetModules()
    const { createUint8Array }: TypedArraysModule = await import('./index')
    expect(createUint8Array(new SharedArrayBuffer(4))).toHaveLength(4)
  })
})
