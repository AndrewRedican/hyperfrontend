import { setupAudio } from './setup-audio'

describe('setupAudio', () => {
  let mockElement: HTMLElement
  let audioContextInstance: any

  beforeEach(() => {
    mockElement = document.createElement('button')
    document.body.appendChild(mockElement)

    audioContextInstance = {
      createBufferSource: jest.fn(),
      createGain: jest.fn(),
      destination: {},
    }

    globalThis.AudioContext = jest.fn().mockImplementation(() => audioContextInstance) as any
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  it('sets up audio with click event', async () => {
    const audioPromise = setupAudio(mockElement)

    // Advance timers to allow getElementAsync to find the element
    jest.advanceTimersByTime(100)

    // Now click the element
    mockElement.click()

    const audioContext = await audioPromise
    expect(audioContext).toBe(audioContextInstance)
  })

  it('sets up audio with touchstart event', async () => {
    const audioPromise = setupAudio(mockElement)

    // Advance timers to allow getElementAsync to find the element
    jest.advanceTimersByTime(100)

    const touchEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [] as unknown as Touch[],
    })
    mockElement.dispatchEvent(touchEvent)

    const audioContext = await audioPromise
    expect(audioContext).toBe(audioContextInstance)
  })

  it('handles webkit AudioContext', async () => {
    delete (globalThis as any).AudioContext
    ;(globalThis as any).webkitAudioContext = jest.fn().mockImplementation(() => audioContextInstance)

    const audioPromise = setupAudio(mockElement)

    // Advance timers to allow getElementAsync to find the element
    jest.advanceTimersByTime(100)

    mockElement.click()

    const audioContext = await audioPromise
    expect(audioContext).toBeDefined()

    delete (globalThis as any).webkitAudioContext
    globalThis.AudioContext = jest.fn().mockImplementation(() => audioContextInstance) as any
  })

  it('rejects when element is not found', async () => {
    const promise = setupAudio('#nonexistent')

    // Advance past timeout to trigger onFail
    jest.advanceTimersByTime(10001)

    await expect(promise).rejects.toThrow('Element with selector "#nonexistent" not found.')
  })
})
