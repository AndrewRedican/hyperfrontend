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

  it('removes the iframe on cleanup', () => {
    const { container, result } = mount({})
    result.cleanup()
    expect(container.querySelector('iframe')).toBeNull()
  })
})
