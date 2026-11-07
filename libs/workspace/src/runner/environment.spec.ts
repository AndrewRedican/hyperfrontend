import { describe, expect, it } from '@hyperfrontend/testing'
import { pathKey, searchPath, withSearchPath } from './environment'

describe('pathKey', () => {
  it('names PATH off Windows', () => {
    expect(pathKey({ Path: '/bin' }, 'linux')).toBe('PATH')
  })

  it('keeps the spelling a Windows environment uses', () => {
    expect(pathKey({ HOME: 'C:\\', PATH: 'C:\\bin' }, 'win32')).toBe('PATH')
  })

  it('names Path on Windows when the environment holds none', () => {
    expect(pathKey({ HOME: 'C:\\' }, 'win32')).toBe('Path')
  })
})

describe('searchPath', () => {
  it('lists the bin directories up to the root, the Node.js directory, then the inherited path', () => {
    expect(searchPath('/work/libs/a', '/usr/bin:/bin', '/opt/node/bin/node', 'linux')).toBe(
      [
        '/work/libs/a/node_modules/.bin',
        '/work/libs/node_modules/.bin',
        '/work/node_modules/.bin',
        '/node_modules/.bin',
        '/opt/node/bin',
        '/usr/bin:/bin',
      ].join(':')
    )
  })

  it('ends at the Node.js directory when nothing is inherited', () => {
    expect(searchPath('/work', undefined, '/opt/node/bin/node', 'linux')).toBe('/work/node_modules/.bin:/node_modules/.bin:/opt/node/bin')
  })

  it('writes Windows paths with their own separators', () => {
    expect(searchPath('C:\\work\\app', 'C:\\Windows', 'C:\\node\\node.exe', 'win32')).toBe(
      'C:\\work\\app\\node_modules\\.bin;C:\\work\\node_modules\\.bin;C:\\node_modules\\.bin;C:\\node;C:\\Windows'
    )
  })
})

describe('withSearchPath', () => {
  it('replaces the search path and keeps the rest of the environment', () => {
    expect(withSearchPath({ HOME: '/home/a', PATH: '/bin' }, '/work', '/opt/node/bin/node', 'linux')).toEqual({
      HOME: '/home/a',
      PATH: '/work/node_modules/.bin:/node_modules/.bin:/opt/node/bin:/bin',
    })
  })
})
