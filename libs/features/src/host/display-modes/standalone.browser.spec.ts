import type { ShellOptions } from '../../shared/types'
import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { mountStandalone } from './standalone'

describe('mountStandalone', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function spyOpen() {
    return jest.spyOn(window, 'open').mockReturnValue({ closed: false, close: jest.fn() } as unknown as Window)
  }

  it('opens the feature in a blank standalone window', () => {
    const open = spyOpen()
    mountStandalone({ options: { container: '#x', url: 'https://feature.example/' } as ShellOptions, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', undefined)
  })

  it('defaults the url to an empty string', () => {
    const open = spyOpen()
    mountStandalone({ options: { container: '#x' } as ShellOptions, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('', '_blank', undefined)
  })

  it('throws when a sandbox is requested for a standalone window', () => {
    expect(() => mountStandalone({ options: { container: '#x', sandbox: {} } as ShellOptions, requestClose: jest.fn() })).toThrow(
      'cannot be sandboxed'
    )
  })
})
