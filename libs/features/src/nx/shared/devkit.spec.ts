import { join } from 'node:path'
import { loadDevkit } from './devkit'

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..', '..', '..')

describe('loadDevkit', () => {
  it('resolves the repository-installed @nx/devkit with callable members', () => {
    const devkit = loadDevkit(WORKSPACE_ROOT)
    expect(devkit).not.toBeNull()
    expect(typeof devkit?.formatFiles).toBe('function')
    expect(typeof devkit?.installPackagesTask).toBe('function')
  })

  it('returns null when no anchor resolves', () => {
    const resolver = jest.fn((): unknown => {
      throw new Error('not found')
    })
    expect(loadDevkit('/ws', resolver)).toBeNull()
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
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('skips an anchor whose resolution is not a module object', () => {
    const installPackagesTask = (): void => undefined
    const resolver = jest.fn((): unknown => ({ installPackagesTask }))
    resolver.mockImplementationOnce(() => 'not a module')
    const devkit = loadDevkit('/consumer', resolver)
    expect(devkit?.installPackagesTask).toBe(installPackagesTask)
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('returns null when every anchor resolves to a non-object', () => {
    const resolver = jest.fn((): unknown => null)
    expect(loadDevkit('/consumer', resolver)).toBeNull()
    expect(resolver).toHaveBeenCalledTimes(2)
  })

  it('omits members the resolved module does not expose as functions', () => {
    const resolver = jest.fn((): unknown => ({ formatFiles: 'not callable', unrelated: true }))
    expect(loadDevkit('/consumer', resolver)).toEqual({})
  })
})
