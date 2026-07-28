import type { ShellOptions } from '../../shared/types'
import { dialogDefaults } from './defaults'
import { mountPopup } from './popup'

describe('mountPopup', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function spyOpen() {
    return jest.spyOn(window, 'open').mockReturnValue(<Window>(<unknown>{ closed: false, close: jest.fn() }))
  }

  it('opens a popup sized from the dialog options', () => {
    const open = spyOpen()
    mountPopup({
      options: <ShellOptions>{ container: '#x', url: 'https://feature.example/', dialogWidth: 400, dialogHeight: 300 },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no')
  })

  it('falls back to the dynamic default popup footprint', () => {
    const open = spyOpen()
    mountPopup({ options: <ShellOptions>{ container: '#x', url: 'https://feature.example/' }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith(
      'https://feature.example/',
      '_blank',
      `width=${dialogDefaults.width},height=${dialogDefaults.height},scrollbars=no`
    )
  })

  it('defaults the url to an empty string', () => {
    const open = spyOpen()
    mountPopup({ options: <ShellOptions>{ container: '#x' }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('', '_blank', `width=${dialogDefaults.width},height=${dialogDefaults.height},scrollbars=no`)
  })

  it('throws when a sandbox is requested for a popup window', () => {
    expect(() => mountPopup({ options: <ShellOptions>{ container: '#x', sandbox: true }, requestClose: jest.fn() })).toThrow(
      'cannot be sandboxed'
    )
  })

  it('accepts an explicitly disabled sandbox', () => {
    const open = spyOpen()
    mountPopup({ options: <ShellOptions>{ container: '#x', sandbox: false }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledTimes(1)
  })
})
