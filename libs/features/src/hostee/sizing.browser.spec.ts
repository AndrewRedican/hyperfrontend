import { applyBodyReset, createPresentationApplier, watchWindowSize } from './sizing'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

function styleTexts(): string[] {
  return Array.from(document.head.querySelectorAll('style')).map((style) => style.textContent ?? '')
}

// note: 1000x1000 makes the viewport-derived dialog fallback deterministic: height 600 (60% coverage), width 578 (aspect ratio 530/550).
const FALLBACK_WIDTH = 578
const FALLBACK_HEIGHT = 600

beforeEach(() => {
  setViewport(1000, 1000)
})

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('applyBodyReset', () => {
  it('injects the body reset stylesheet', () => {
    applyBodyReset()
    expect(styleTexts()).toContain('html,body{margin:0;padding:0;background:transparent;color-scheme:normal}')
  })
})

describe('createPresentationApplier', () => {
  describe('viewport sync', () => {
    it('sizes the document root to the exact reported pixels', () => {
      createPresentationApplier(undefined, jest.fn()).applyViewport({ width: 640, height: 480 })
      expect(styleTexts()).toContain('html,body{width:640px;height:480px}')
    })

    it('keeps fractional pixel dimensions exact', () => {
      createPresentationApplier(undefined, jest.fn()).applyViewport({ width: 412.5, height: 733.25 })
      expect(styleTexts()).toContain('html,body{width:412.5px;height:733.25px}')
    })

    it('updates the managed stylesheet in place on a later report', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyViewport({ width: 640, height: 480 })
      applier.applyViewport({ width: 320, height: 480 })
      expect(styleTexts()).toEqual(['html,body{width:320px;height:480px}'])
    })
  })

  describe('dialog layout', () => {
    it('sizes the default root selector with the agreed dialog dimensions', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { width: 480, height: 320 } })
      expect(styleTexts()).toContain('body>:first-child{width:480px;height:320px;max-width:100%;max-height:100%;box-sizing:border-box}')
    })

    it('sizes a custom selector root', () => {
      createPresentationApplier('#app', jest.fn()).applyPresent({ mode: 'dialog', dialog: { width: 480, height: 320 } })
      expect(styleTexts()).toContain('#app{width:480px;height:320px;max-width:100%;max-height:100%;box-sizing:border-box}')
    })

    it('sizes an element root with inline styles', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      createPresentationApplier(root, jest.fn()).applyPresent({ mode: 'dialog', dialog: { width: 480, height: 320 } })
      expect({
        width: root.style.width,
        height: root.style.height,
        maxWidth: root.style.maxWidth,
        maxHeight: root.style.maxHeight,
        boxSizing: root.style.boxSizing,
      }).toEqual({ width: '480px', height: '320px', maxWidth: '100%', maxHeight: '100%', boxSizing: 'border-box' })
    })

    it('adds the centering layout stylesheet when no position is announced', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog' })
      expect(styleTexts()).toContain('body{display:flex;align-items:center;justify-content:center;overflow:hidden}')
    })

    it('centers the layout for an explicit center position', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { position: 'center' } })
      expect(styleTexts()).toContain('body{display:flex;align-items:center;justify-content:center;overflow:hidden}')
    })

    it('aligns the layout to the top-left corner', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { position: 'top-left' } })
      expect(styleTexts()).toContain('body{display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden}')
    })

    it('aligns the layout to the bottom-center edge', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { position: 'bottom-center' } })
      expect(styleTexts()).toContain('body{display:flex;align-items:flex-end;justify-content:center;overflow:hidden}')
    })

    it('aligns the layout to the center-right edge', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { position: 'center-right' } })
      expect(styleTexts()).toContain('body{display:flex;align-items:center;justify-content:flex-end;overflow:hidden}')
    })

    it('derives both dimensions from the viewport when the announcement carries none', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog' })
      expect(styleTexts()).toContain(
        `body>:first-child{width:${FALLBACK_WIDTH}px;height:${FALLBACK_HEIGHT}px;max-width:100%;max-height:100%;box-sizing:border-box}`
      )
    })

    it('falls back per axis for a missing height', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { width: 480 } })
      expect(styleTexts()).toContain(
        `body>:first-child{width:480px;height:${FALLBACK_HEIGHT}px;max-width:100%;max-height:100%;box-sizing:border-box}`
      )
    })

    it('falls back per axis for a missing width', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', dialog: { height: 320 } })
      expect(styleTexts()).toContain(
        `body>:first-child{width:${FALLBACK_WIDTH}px;height:320px;max-width:100%;max-height:100%;box-sizing:border-box}`
      )
    })

    it('applies the dialog layout once across repeated announcements', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'dialog' })
      applier.applyPresent({ mode: 'dialog' })
      expect(styleTexts().filter((text) => text.startsWith('body>:first-child'))).toHaveLength(1)
    })

    it('does not re-arm dismiss detection on a repeated announcement', () => {
      const sendDismiss = jest.fn()
      const applier = createPresentationApplier(undefined, sendDismiss)
      applier.applyPresent({ mode: 'dialog' })
      applier.applyPresent({ mode: 'dialog' })
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(sendDismiss).toHaveBeenCalledTimes(1)
    })

    it('applies no dialog layout for a non-dialog mode', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'embedded' })
      expect(styleTexts()).toEqual([])
    })

    it('arms no dismiss detection for a non-dialog mode', () => {
      const sendDismiss = jest.fn()
      createPresentationApplier(undefined, sendDismiss).applyPresent({ mode: 'popup' })
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(sendDismiss).not.toHaveBeenCalled()
    })
  })

  describe('present-carried viewport', () => {
    it('sizes the canvas from the viewport carried by the announcement', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'embedded', viewport: { width: 800, height: 600 } })
      expect(styleTexts()).toContain('html,body{width:800px;height:600px}')
    })

    it('sizes the canvas before applying the dialog layout', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'dialog', viewport: { width: 800, height: 600 } })
      const texts = styleTexts()
      expect(texts.indexOf('html,body{width:800px;height:600px}')).toBeLessThan(
        texts.findIndex((text) => text.startsWith('body{display:flex'))
      )
    })

    it('adds no canvas sizing when the announcement carries no viewport', () => {
      createPresentationApplier(undefined, jest.fn()).applyPresent({ mode: 'embedded' })
      expect(styleTexts()).toEqual([])
    })

    it('updates the announcement-installed stylesheet in place on a later report', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'embedded', viewport: { width: 800, height: 600 } })
      applier.applyViewport({ width: 320, height: 240 })
      expect(styleTexts()).toEqual(['html,body{width:320px;height:240px}'])
    })

    it('removes the announcement-installed canvas sizing on stop', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'embedded', viewport: { width: 800, height: 600 } })
      applier.stop()
      expect(styleTexts()).toEqual([])
    })
  })

  describe('dismiss detection', () => {
    function armedApplier() {
      const sendDismiss = jest.fn()
      const applier = createPresentationApplier(undefined, sendDismiss)
      applier.applyPresent({ mode: 'dialog' })
      return { applier, sendDismiss }
    }

    it('reports a backdrop dismiss for a pointer landing on the body', () => {
      const { sendDismiss } = armedApplier()
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(sendDismiss).toHaveBeenCalledWith({ source: 'backdrop' })
    })

    it('reports a backdrop dismiss for a pointer landing on the document element', () => {
      const { sendDismiss } = armedApplier()
      document.documentElement.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(sendDismiss).toHaveBeenCalledWith({ source: 'backdrop' })
    })

    it('does not report a pointer landing on content inside the box', () => {
      const { sendDismiss } = armedApplier()
      const content = document.createElement('div')
      document.body.appendChild(content)
      content.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(sendDismiss).not.toHaveBeenCalled()
    })

    it('reports an escape dismiss for an Escape keydown', () => {
      const { sendDismiss } = armedApplier()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(sendDismiss).toHaveBeenCalledWith({ source: 'escape' })
    })

    it('does not report other keydowns', () => {
      const { sendDismiss } = armedApplier()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      expect(sendDismiss).not.toHaveBeenCalled()
    })
  })

  describe('mode', () => {
    it('reports null before any announcement', () => {
      expect(createPresentationApplier(undefined, jest.fn()).mode()).toBeNull()
    })

    it('reports the announced mode', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'dialog' })
      expect(applier.mode()).toBe('dialog')
    })

    it('tracks the latest announcement', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'dialog' })
      applier.applyPresent({ mode: 'embedded' })
      expect(applier.mode()).toBe('embedded')
    })

    it('reports null after stop', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'dialog' })
      applier.stop()
      expect(applier.mode()).toBeNull()
    })
  })

  describe('stop', () => {
    it('removes the managed viewport and dialog styles', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyPresent({ mode: 'dialog' })
      applier.applyViewport({ width: 640, height: 480 })
      applier.stop()
      expect(styleTexts()).toEqual([])
    })

    it('clears the inline styles applied to an element root', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const applier = createPresentationApplier(root, jest.fn())
      applier.applyPresent({ mode: 'dialog', dialog: { width: 480, height: 320 } })
      applier.stop()
      expect({
        width: root.style.width,
        height: root.style.height,
        maxWidth: root.style.maxWidth,
        maxHeight: root.style.maxHeight,
        boxSizing: root.style.boxSizing,
      }).toEqual({ width: '', height: '', maxWidth: '', maxHeight: '', boxSizing: '' })
    })

    it('disarms dismiss detection', () => {
      const sendDismiss = jest.fn()
      const applier = createPresentationApplier(undefined, sendDismiss)
      applier.applyPresent({ mode: 'dialog' })
      applier.stop()
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(sendDismiss).not.toHaveBeenCalled()
    })

    it('is a no-op before anything applied', () => {
      expect(() => createPresentationApplier(undefined, jest.fn()).stop()).not.toThrow()
    })

    it('allows a fresh viewport report after stopping', () => {
      const applier = createPresentationApplier(undefined, jest.fn())
      applier.applyViewport({ width: 640, height: 480 })
      applier.stop()
      applier.applyViewport({ width: 320, height: 240 })
      expect(styleTexts()).toEqual(['html,body{width:320px;height:240px}'])
    })
  })
})

describe('watchWindowSize', () => {
  it('reports the window inner size on resize', () => {
    const onResize = jest.fn()
    watchWindowSize(onResize)
    setViewport(800, 500)
    window.dispatchEvent(new Event('resize'))
    expect(onResize).toHaveBeenCalledWith({ width: 800, height: 500 })
  })

  it('stops reporting after the stop callback runs', () => {
    const onResize = jest.fn()
    const stop = watchWindowSize(onResize)
    window.dispatchEvent(new Event('resize'))
    stop()
    window.dispatchEvent(new Event('resize'))
    expect(onResize).toHaveBeenCalledTimes(1)
  })
})
