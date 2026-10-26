import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { devkitFunction, loadDevkit } from './load-devkit'

const WORKSPACE_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

describe('loadDevkit', () => {
  it('resolves the repository-installed @nx/devkit from the workspace root', () => {
    expect(loadDevkit(WORKSPACE_ROOT)).toEqual(expect.objectContaining({ formatFiles: expect.any(Function) }))
  })

  it('returns null when no anchor resolves', () => {
    const resolve = jest.fn((): unknown => {
      throw new Error('not found')
    })
    expect(loadDevkit('/ws', { resolve })).toBeNull()
  })

  it('anchors at the workspace root package.json first, then at the anchors given', () => {
    const anchors: string[] = []
    const resolve = jest.fn((anchor: string): unknown => {
      anchors.push(anchor)
      throw new Error('not found')
    })
    loadDevkit('/consumer', { anchors: ['/plugin/package.json'], resolve })
    expect(anchors).toEqual([join('/consumer', 'package.json'), '/plugin/package.json'])
  })

  it('returns the first anchor that resolves a module object', () => {
    const module = { formatFiles: async (): Promise<void> => undefined }
    const resolve = jest.fn((): unknown => module)
    resolve.mockImplementationOnce(() => {
      throw new Error('not found at consumer root')
    })
    expect(loadDevkit('/consumer', { anchors: ['/plugin/package.json'], resolve })).toBe(module)
  })

  it('skips an anchor whose resolution is not an object', () => {
    const module = { installPackagesTask: (): void => undefined }
    const resolve = jest.fn((): unknown => module)
    resolve.mockImplementationOnce(() => 'not a module')
    expect(loadDevkit('/consumer', { anchors: ['/plugin/package.json'], resolve })).toBe(module)
  })

  it('returns null when every anchor resolves to a non-object', () => {
    expect(loadDevkit('/consumer', { resolve: () => null })).toBeNull()
  })
})

describe('devkitFunction', () => {
  it('returns a callable export', () => {
    const formatFiles = async (): Promise<void> => undefined
    expect(devkitFunction({ formatFiles }, 'formatFiles')).toBe(formatFiles)
  })

  it('returns null for an export that is not a function', () => {
    expect(devkitFunction({ logger: {} }, 'logger')).toBeNull()
  })

  it('returns null for an absent export', () => {
    expect(devkitFunction({}, 'formatFiles')).toBeNull()
  })
})
