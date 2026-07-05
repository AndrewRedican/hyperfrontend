import type { ShellOptions } from '../../shared/types'
import { dialogDefaults } from './defaults'
import { mountDialog } from './dialog'

function mount(options: Partial<ShellOptions>) {
  const requestClose = jest.fn()
  const result = mountDialog({ options: <ShellOptions>{ container: '#unused', url: 'https://feature.example/', ...options }, requestClose })
  const container = <HTMLElement>document.body.lastElementChild
  const dialog = <HTMLElement>container.querySelector('iframe')?.parentElement
  return { result, container, dialog, requestClose }
}

describe('mountDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders a backdrop overlay by default', () => {
    expect(mount({}).container.children).toHaveLength(2)
  })

  it('omits the backdrop when the overlay is disabled', () => {
    expect(mount({ dialogOverlay: false }).container.children).toHaveLength(1)
  })

  it('requests close when the backdrop is clicked', () => {
    const { container, requestClose } = mount({})
    ;(<HTMLElement>container.firstElementChild).click()
    expect(requestClose).toHaveBeenCalledTimes(1)
  })

  it('requests close when the close button is clicked', () => {
    const { container, requestClose } = mount({})
    container.querySelector('button')?.click()
    expect(requestClose).toHaveBeenCalledTimes(1)
  })

  it('requests close when Escape is pressed', () => {
    const { requestClose } = mount({})
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).toHaveBeenCalledTimes(1)
  })

  it('ignores non-Escape keys', () => {
    const { requestClose } = mount({})
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(requestClose).not.toHaveBeenCalled()
  })

  it('does not close on Escape when closeOnEscape is disabled', () => {
    const { requestClose } = mount({ closeOnEscape: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).not.toHaveBeenCalled()
  })

  it('applies the dynamic default footprint when no size is given', () => {
    const { dialog } = mount({})
    expect({ width: dialog.style.width, height: dialog.style.height }).toEqual({
      width: `${dialogDefaults.width}px`,
      height: `${dialogDefaults.height}px`,
    })
  })

  it('applies a custom dialog footprint', () => {
    const { dialog } = mount({ dialogWidth: 800, dialogHeight: 600 })
    expect({ width: dialog.style.width, height: dialog.style.height }).toEqual({ width: '800px', height: '600px' })
  })

  it('loads the provided url into the dialog iframe', () => {
    expect(mount({}).container.querySelector('iframe')?.src).toBe('https://feature.example/')
  })

  it('defaults the iframe url to empty when omitted', () => {
    expect(mount({ url: undefined }).container.querySelector('iframe')?.getAttribute('src')).toBe('')
  })

  it('targets the dialog iframe content window', () => {
    const { result, container } = mount({})
    expect(result.target).toBe(container.querySelector('iframe')?.contentWindow)
  })

  it('exposes the dialog container as the mounted element', () => {
    const { result, container } = mount({})
    expect(result.element).toBe(container)
  })

  it('removes the dialog container on cleanup', () => {
    const { result, container } = mount({})
    result.cleanup()
    expect(container.isConnected).toBe(false)
  })

  it('detaches the Escape listener on cleanup', () => {
    const { result, requestClose } = mount({})
    result.cleanup()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(requestClose).not.toHaveBeenCalled()
  })
})
