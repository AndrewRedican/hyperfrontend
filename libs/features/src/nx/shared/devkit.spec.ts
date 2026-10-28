import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadDevkit } from './devkit'

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
  it('resolves an installed @nx/devkit with callable members', () => {
    expect(loadDevkit(installStubDevkit())).toEqual(
      expect.objectContaining({ formatFiles: expect.any(Function), installPackagesTask: expect.any(Function) })
    )
  })

  it('returns null when no anchor resolves', () => {
    const resolver = jest.fn((): unknown => {
      throw new Error('not found')
    })
    expect(loadDevkit('/ws', resolver)).toBeNull()
  })

  it('tries both anchors before giving up on resolution', () => {
    const resolver = jest.fn((): unknown => {
      throw new Error('not found')
    })
    loadDevkit('/ws', resolver)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('anchors at the consumer root package.json first', () => {
    const anchors: string[] = []
    const resolver = jest.fn((anchor: string): unknown => {
      anchors.push(anchor)
      return { formatFiles: async () => undefined }
    })
    loadDevkit('/consumer', resolver)
    expect(anchors).toEqual([join('/consumer', 'package.json')])
  })

  it('falls back to the plugin-location anchor when the consumer root fails', () => {
    const formatFiles = async (): Promise<void> => undefined
    const resolver = jest.fn((): unknown => ({ formatFiles }))
    resolver.mockImplementationOnce(() => {
      throw new Error('not found at consumer root')
    })
    const devkit = loadDevkit('/consumer', resolver)
    expect(devkit?.formatFiles).toBe(formatFiles)
  })

  it('consults both anchors when the consumer root fails', () => {
    const resolver = jest.fn((): unknown => ({ formatFiles: async (): Promise<void> => undefined }))
    resolver.mockImplementationOnce(() => {
      throw new Error('not found at consumer root')
    })
    loadDevkit('/consumer', resolver)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('skips an anchor whose resolution is not a module object', () => {
    const installPackagesTask = (): void => undefined
    const resolver = jest.fn((): unknown => ({ installPackagesTask }))
    resolver.mockImplementationOnce(() => 'not a module')
    const devkit = loadDevkit('/consumer', resolver)
    expect(devkit?.installPackagesTask).toBe(installPackagesTask)
  })

  it('consults both anchors when the first resolves to a non-module', () => {
    const resolver = jest.fn((): unknown => ({ installPackagesTask: (): void => undefined }))
    resolver.mockImplementationOnce(() => 'not a module')
    loadDevkit('/consumer', resolver)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('returns null when every anchor resolves to a non-object', () => {
    const resolver = jest.fn((): unknown => null)
    expect(loadDevkit('/consumer', resolver)).toBeNull()
  })

  it('consults both anchors when every anchor resolves to a non-object', () => {
    const resolver = jest.fn((): unknown => null)
    loadDevkit('/consumer', resolver)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('omits members the resolved module does not expose as functions', () => {
    const resolver = jest.fn((): unknown => ({ formatFiles: 'not callable', unrelated: true }))
    expect(loadDevkit('/consumer', resolver)).toEqual({})
  })
})
