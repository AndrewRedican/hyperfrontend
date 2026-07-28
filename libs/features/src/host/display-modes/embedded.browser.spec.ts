import type { ShellOptions } from '../../shared/types'
import { mountEmbedded } from './embedded'

function mount(options: Partial<ShellOptions>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const result = mountEmbedded({ options: <ShellOptions>{ container, ...options }, requestClose: jest.fn() })
  return { container, result }
}

describe('mountEmbedded', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('appends an iframe into the container', () => {
    expect(mount({}).container.querySelector('iframe')).not.toBeNull()
  })

  it('loads the provided url into the iframe', () => {
    expect(mount({ url: 'https://feature.example/' }).container.querySelector('iframe')?.src).toBe('https://feature.example/')
  })

  it('targets the iframe content window', () => {
    const { container, result } = mount({})
    expect(result.target).toBe(container.querySelector('iframe')?.contentWindow)
  })

  it('exposes the iframe as the mounted element', () => {
    const { container, result } = mount({})
    expect(result.element).toBe(container.querySelector('iframe'))
  })

  it('removes the iframe on cleanup', () => {
    const { container, result } = mount({})
    result.cleanup()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('delegates the configured permissions to the iframe', () => {
    expect(
      mount({ permissions: ['fullscreen'] })
        .container.querySelector('iframe')
        ?.getAttribute('allow')
    ).toBe('fullscreen')
  })

  it('sandboxes the iframe when a sandbox is configured', () => {
    const { container } = mount({ url: 'https://feature.example/', sandbox: true })
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  })
})
