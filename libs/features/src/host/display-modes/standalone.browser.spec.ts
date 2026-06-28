import type { ShellOptions } from '../../shared/types'
import { mountStandalone } from './standalone'

describe('mountStandalone', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function spyOpen() {
    return jest.spyOn(window, 'open').mockReturnValue(<Window>(<unknown>{ closed: false, close: jest.fn() }))
  }

  it('opens the feature in a blank standalone window', () => {
    const open = spyOpen()
    mountStandalone({ options: <ShellOptions>{ container: '#x', url: 'https://feature.example/' }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', undefined)
  })

  it('defaults the url to an empty string', () => {
    const open = spyOpen()
    mountStandalone({ options: <ShellOptions>{ container: '#x' }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('', '_blank', undefined)
  })
})
