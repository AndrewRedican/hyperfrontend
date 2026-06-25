import { dialogDefaults } from './defaults'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

describe('dialogDefaults', () => {
  afterEach(() => {
    setViewport(1024, 768)
  })

  it('derives height from the viewport coverage', () => {
    setViewport(1200, 1000)
    expect(dialogDefaults.height).toBe(600)
  })

  it('derives width from the aspect ratio', () => {
    setViewport(1200, 1000)
    expect(dialogDefaults.width).toBe(578)
  })

  it('shrinks to honor the max viewport coverage on narrow viewports', () => {
    setViewport(300, 2000)
    expect(dialogDefaults.width).toBe(270)
  })

  it('falls back to the fixed footprint when the viewport is unmeasurable', () => {
    setViewport(0, 0)
    expect({ width: dialogDefaults.width, height: dialogDefaults.height }).toEqual({ width: 530, height: 550 })
  })
})
