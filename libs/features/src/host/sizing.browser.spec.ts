import { applyContentSize } from './sizing'

describe('applyContentSize', () => {
  it('applies a numeric announced height to the frame', () => {
    const frame = document.createElement('iframe')
    applyContentSize(frame, { height: 480 })
    expect(frame.style.height).toBe('480px')
  })

  it('ignores an announcement without a numeric height', () => {
    const frame = document.createElement('iframe')
    applyContentSize(frame, { height: 'tall' })
    expect(frame.style.height).toBe('')
  })

  it('ignores a missing payload', () => {
    const frame = document.createElement('iframe')
    applyContentSize(frame, null)
    expect(frame.style.height).toBe('')
  })
})
