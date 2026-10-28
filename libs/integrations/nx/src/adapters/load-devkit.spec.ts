import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { devkitFunction, loadDevkit } from './load-devkit'

const directory = useTempDir({ prefix: 'devkit-' })

/**
 * Installs a stand-in `@nx/devkit` under the temporary workspace, exporting the members the loader checks.
 *
 * @returns The temporary workspace root
 */
function installStubDevkit(): string {
  const packageRoot = join(directory.path, 'node_modules', '@nx', 'devkit')
  mkdirSync(packageRoot, { recursive: true })
  writeFileSync(join(packageRoot, 'package.json'), JSON.stringify({ name: '@nx/devkit', version: '0.0.0', main: 'index.js' }))
  writeFileSync(join(packageRoot, 'index.js'), 'exports.formatFiles = async () => {}\nexports.installPackagesTask = () => {}\n')
  writeFileSync(join(directory.path, 'package.json'), JSON.stringify({ name: 'consumer', private: true }))
  return directory.path
}

describe('loadDevkit', () => {
  it('resolves an installed @nx/devkit from the workspace root', () => {
    expect(loadDevkit(installStubDevkit())).toEqual(expect.objectContaining({ formatFiles: expect.any(Function) }))
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
