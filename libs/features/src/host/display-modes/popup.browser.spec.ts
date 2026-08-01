import type { ShellOptions } from '../../shared/types'
import { resolvePopupDefaults } from './defaults'
import { mountPopup } from './popup'

describe('mountPopup', () => {
  const originalScreen = Object.getOwnPropertyDescriptor(window, 'screen')

  function stubScreen(screen: { availWidth: number; availHeight: number } | undefined) {
    Object.defineProperty(window, 'screen', { value: screen, configurable: true })
  }

  beforeEach(() => {
    // note: jsdom's own screen reports zero avail dimensions; stubbing keeps the placement branch deterministic either way.
    stubScreen({ availWidth: 0, availHeight: 0 })
  })

  afterEach(() => {
    if (originalScreen) {
      Object.defineProperty(window, 'screen', originalScreen)
    } else {
      Reflect.deleteProperty(window, 'screen')
    }
    jest.restoreAllMocks()
  })

  function spyOpen() {
    return jest.spyOn(window, 'open').mockReturnValue(<Window>(<unknown>{ closed: false, close: jest.fn() }))
  }

  it('opens a popup sized from the popup options', () => {
    const open = spyOpen()
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300 },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no')
  })

  it('falls back to the dynamic default popup footprint', () => {
    const open = spyOpen()
    const defaults = resolvePopupDefaults()
    mountPopup({ options: <ShellOptions>{ url: 'https://feature.example/' }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith(
      'https://feature.example/',
      '_blank',
      `width=${defaults.width},height=${defaults.height},scrollbars=no`
    )
  })

  it('fills only the missing axis from the defaults', () => {
    const open = spyOpen()
    const defaults = resolvePopupDefaults()
    mountPopup({ options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400 }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', `width=400,height=${defaults.height},scrollbars=no`)
  })

  it('defaults the url to an empty string', () => {
    const open = spyOpen()
    const defaults = resolvePopupDefaults()
    mountPopup({ options: <ShellOptions>{}, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledWith('', '_blank', `width=${defaults.width},height=${defaults.height},scrollbars=no`)
  })

  it('centers the popup on the available screen by default', () => {
    const open = spyOpen()
    stubScreen({ availWidth: 1024, availHeight: 768 })
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300 },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no,left=312,top=234')
  })

  it('places a top-left popup at the screen origin', () => {
    const open = spyOpen()
    stubScreen({ availWidth: 1024, availHeight: 768 })
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300, popupPosition: 'top-left' },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no,left=0,top=0')
  })

  it('aligns a bottom-right popup to the far screen edges', () => {
    const open = spyOpen()
    stubScreen({ availWidth: 1024, availHeight: 768 })
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300, popupPosition: 'bottom-right' },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no,left=624,top=468')
  })

  it('omits placement when no screen is available', () => {
    const open = spyOpen()
    stubScreen(undefined)
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300, popupPosition: 'top-left' },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no')
  })

  it('omits placement when the screen reports no usable width', () => {
    const open = spyOpen()
    stubScreen({ availWidth: 0, availHeight: 768 })
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300 },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no')
  })

  it('omits placement when the screen reports no usable height', () => {
    const open = spyOpen()
    stubScreen({ availWidth: 1024, availHeight: 0 })
    mountPopup({
      options: <ShellOptions>{ url: 'https://feature.example/', popupWidth: 400, popupHeight: 300 },
      requestClose: jest.fn(),
    })
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400,height=300,scrollbars=no')
  })

  it('announces the popup display mode', () => {
    spyOpen()
    const result = mountPopup({ options: <ShellOptions>{ url: 'https://feature.example/' }, requestClose: jest.fn() })
    expect(result.present).toEqual({ mode: 'popup' })
  })

  it('throws when a sandbox is requested for a popup window', () => {
    expect(() => mountPopup({ options: <ShellOptions>{ sandbox: true }, requestClose: jest.fn() })).toThrow('cannot be sandboxed')
  })

  it('accepts an explicitly disabled sandbox', () => {
    const open = spyOpen()
    mountPopup({ options: <ShellOptions>{ sandbox: false }, requestClose: jest.fn() })
    expect(open).toHaveBeenCalledTimes(1)
  })
})
