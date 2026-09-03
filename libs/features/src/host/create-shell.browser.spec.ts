import type { CreateShellOptions } from './create-shell'
import type { MountResult, ShellHandle } from './types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { installResizeObserverStub } from '../testing/resize-observer-stub'
import { createShell, deriveShellName } from './create-shell'
import { mountEmbedded } from './display-modes/embedded'
import { builtInDisplayModes } from './display-modes/registry'

beforeEach(() => {
  installResizeObserverStub()
})

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

  it('strips an uppercase scheme prefix from the slug', () => {
    expect(deriveShellName({ url: 'HTTPS://App.Example.com' }, 5)).toBe('shell-app-example-com-5')
  })

  it('keeps a non-alphabetic scheme prefix in the slug', () => {
    expect(deriveShellName({ url: 'view-source://app.example.com' }, 7)).toBe('shell-view-source-app-example-com-7')
  })
})

describe('createShell', () => {
  // why: an opened shell keeps connection retry and timeout timers aimed at its iframe, so it has to be destroyed before the body is wiped; a timer surviving the wipe fires after the test has ended and reaches a window jsdom has already detached.
  const shells: ShellHandle[] = []

  const openShell = (options: CreateShellOptions): ShellHandle => {
    const shell = createShell(options)
    shells.push(shell)
    return shell
  }

  afterEach(() => {
    for (const shell of shells.splice(0)) shell.destroy()
    document.body.innerHTML = ''
  })

  it('throws when no modes option is given', () => {
    expect(() => createShell({ container: '#shell' } as unknown as CreateShellOptions)).toThrow(
      'createShell needs at least one display mode: pass modes (e.g. { embedded: mountEmbedded }) or builtInDisplayModes.'
    )
  })

  it('throws when the modes map is empty', () => {
    expect(() => createShell({ modes: {}, container: '#shell' })).toThrow(
      'createShell needs at least one display mode: pass modes (e.g. { embedded: mountEmbedded }) or builtInDisplayModes.'
    )
  })

  it('returns a shell handle exposing the public surface', () => {
    expect(createShell({ modes: builtInDisplayModes, container: '#shell' })).toEqual(
      expect.objectContaining({
        open: expect.any(Function),
        close: expect.any(Function),
        destroy: expect.any(Function),
        send: expect.any(Function),
        on: expect.any(Function),
      })
    )
  })

  it('creates a shell without a container', () => {
    expect(createShell({ modes: builtInDisplayModes }).isOpen).toBe(false)
  })

  it('reports closed before the first open', () => {
    expect(createShell({ modes: builtInDisplayModes, container: '#shell' }).isOpen).toBe(false)
  })

  it('mounts an embedded feature into the container on open', () => {
    const container = document.createElement('div')
    container.id = 'shell'
    document.body.appendChild(container)
    openShell({ modes: builtInDisplayModes, container: '#shell', url: 'https://feature.example/' }).open()
    expect(container.querySelector('iframe')).not.toBeNull()
  })

  it('mounts a dialog pane on open with the dialog display mode', () => {
    openShell({ modes: builtInDisplayModes, url: 'https://feature.example/' }).open({ displayMode: 'dialog' })
    expect((document.body.querySelector('iframe') as HTMLIFrameElement).style.position).toBe('fixed')
  })

  it('rejects opening a display mode outside the modes map', () => {
    const shell = createShell({ modes: { embedded: mountEmbedded }, container: '#shell' })
    expect(() => shell.open({ displayMode: 'popup' })).toThrow(
      'This feature does not support the "popup" display mode; supported modes: embedded.'
    )
  })

  it('opens through a custom mount map', () => {
    const mount = jest.fn(() => ({ target: null, present: { mode: 'embedded' }, cleanup: jest.fn() }) as MountResult)
    openShell({ modes: { embedded: mount } }).open()
    expect(mount).toHaveBeenCalledTimes(1)
  })

  it('defaults a plain open to the embedded mode, so an embedded-only map works', () => {
    const container = document.createElement('div')
    container.id = 'shell'
    document.body.appendChild(container)
    openShell({ modes: { embedded: mountEmbedded }, container: '#shell', url: 'https://feature.example/' }).open()
    expect(container.querySelector('iframe')).not.toBeNull()
  })
})
