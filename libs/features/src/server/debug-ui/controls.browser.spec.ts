import type { ControlsOptions } from './controls'
import { DisplayMode } from '../../shared/types'
import { createControls } from './controls'

const options = (over: Partial<ControlsOptions> = {}): ControlsOptions => ({
  displayMode: DisplayMode.Embedded,
  width: 480,
  height: 360,
  protocol: 'none',
  onDisplayModeChange: jest.fn(),
  onResize: jest.fn(),
  onProtocolChange: jest.fn(),
  ...over,
})

const change = (element: HTMLSelectElement, value: string): void => {
  element.value = value
  element.dispatchEvent(new Event('change'))
}

const edit = (element: HTMLInputElement, value: string): void => {
  element.value = value
  element.dispatchEvent(new Event('input'))
}

describe('createControls', () => {
  it('renders a display-mode option per built-in mode', () => {
    const { element } = createControls(options())
    expect(element.querySelector('select')?.querySelectorAll('option')).toHaveLength(4)
  })

  it('pre-selects the current display mode', () => {
    const { element } = createControls(options({ displayMode: DisplayMode.Dialog }))
    expect((element.querySelector('select') as HTMLSelectElement).value).toBe('dialog')
  })

  it('fires onDisplayModeChange with the chosen mode', () => {
    const onDisplayModeChange = jest.fn()
    const { element } = createControls(options({ onDisplayModeChange }))
    change(element.querySelectorAll('select')[0] as HTMLSelectElement, 'popup')
    expect(onDisplayModeChange).toHaveBeenCalledWith('popup')
  })

  it('fires onResize with the new width', () => {
    const onResize = jest.fn()
    const { element } = createControls(options({ onResize }))
    edit(element.querySelectorAll('input[type="number"]')[0] as HTMLInputElement, '800')
    expect(onResize).toHaveBeenCalledWith({ width: 800, height: 360 })
  })

  it('fires onResize with the new height', () => {
    const onResize = jest.fn()
    const { element } = createControls(options({ onResize }))
    edit(element.querySelectorAll('input[type="number"]')[1] as HTMLInputElement, '600')
    expect(onResize).toHaveBeenCalledWith({ width: 480, height: 600 })
  })

  it('fires onProtocolChange with the chosen protocol', () => {
    const onProtocolChange = jest.fn()
    const { element } = createControls(options({ onProtocolChange }))
    change(element.querySelectorAll('select')[1] as HTMLSelectElement, 'v2')
    expect(onProtocolChange).toHaveBeenCalledWith('v2')
  })

  it('reports a connected feature', () => {
    const controls = createControls(options())
    controls.setConnected(true)
    expect(controls.element.textContent).not.toEqual(expect.stringContaining('disconnected'))
  })

  it('reports a disconnected feature', () => {
    const controls = createControls(options())
    controls.setConnected(false)
    expect(controls.element.textContent).toEqual(expect.stringContaining('disconnected'))
  })
})
