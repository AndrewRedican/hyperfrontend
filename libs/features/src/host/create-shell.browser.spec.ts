import { createShell, deriveShellName } from './create-shell'

describe('deriveShellName', () => {
  it('prefers an explicit name over url and container', () => {
    expect(deriveShellName({ container: '#clock', name: 'Clock Widget', url: 'https://clock.example.com' }, 1)).toBe('shell-clock-widget-1')
  })

  it('slugs the feature url host when a url is given', () => {
    expect(deriveShellName({ container: '#clock', url: 'https://clock.example.com/widget' }, 1)).toBe('shell-clock-example-com-widget-1')
  })

  it('falls back to the container selector when no url is given', () => {
    expect(deriveShellName({ container: '#clock-host' }, 2)).toBe('shell-clock-host-2')
  })

  it('uses a bare counter when the container is an element and no url is given', () => {
    expect(deriveShellName({ container: document.createElement('div') }, 3)).toBe('shell-3')
  })

  it('uses a bare counter when no identifying option slugs to anything', () => {
    expect(deriveShellName({ container: '###', url: '' }, 4)).toBe('shell-4')
  })
})

describe('createShell', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns a shell handle exposing the public surface', () => {
    expect(createShell({ container: '#shell' })).toEqual(
      expect.objectContaining({
        open: expect.any(Function),
        close: expect.any(Function),
        destroy: expect.any(Function),
        send: expect.any(Function),
        on: expect.any(Function),
      })
    )
  })

  it('reports closed before the first open', () => {
    expect(createShell({ container: '#shell' }).isOpen).toBe(false)
  })

  it('mounts an embedded feature into the container on open', () => {
    const container = document.createElement('div')
    container.id = 'shell'
    document.body.appendChild(container)
    createShell({ container: '#shell', url: 'https://feature.example/' }).open()
    expect(container.querySelector('iframe')).not.toBeNull()
  })
})
