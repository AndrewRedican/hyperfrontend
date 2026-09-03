import { describe, expect, it } from '@hyperfrontend/testing'
import { applyEdits } from './edits'

describe('applyEdits', () => {
  it('splices edits back-to-front so offsets stay valid against the original source', () => {
    expect(
      applyEdits('abcdef', [
        { start: 0, end: 1, text: 'X' },
        { start: 4, end: 6, text: 'Y' },
      ])
    ).toBe('Xbcd' + 'Y')
  })

  it('deletes a span when the replacement text is empty', () => {
    expect(applyEdits('keep-drop-keep', [{ start: 4, end: 9, text: '' }])).toBe('keep-keep')
  })

  it('leaves the caller edit array order untouched', () => {
    const edits = [
      { start: 0, end: 1, text: 'X' },
      { start: 4, end: 5, text: 'Y' },
    ]
    applyEdits('abcdef', edits)
    expect(edits[0]).toEqual({ start: 0, end: 1, text: 'X' })
  })

  it('keeps blank-line runs verbatim when the collapse hook is off', () => {
    expect(applyEdits('a\n\n\n\nb', [])).toBe('a\n\n\n\nb')
  })

  it('collapses runs of three or more newlines to one blank line when the collapse hook is on', () => {
    expect(applyEdits('a\n\n\n\nb', [], true)).toBe('a\n\nb')
  })
})
