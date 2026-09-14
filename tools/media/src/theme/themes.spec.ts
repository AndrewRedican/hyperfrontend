import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { builtInTheme, listThemes } from './themes'

describe('listThemes', () => {
  it('lists the portable theme first, then the two site themes', () => {
    expect(listThemes().map((theme) => theme.id)).toEqual(['portable', 'dark', 'light'])
  })

  it('draws only the portable theme on a transparent canvas', () => {
    expect(listThemes().map((theme) => [theme.id, theme.transparent])).toEqual([
      ['portable', true],
      ['dark', false],
      ['light', false],
    ])
  })

  it('gives the portable theme a plate with an edge and the others none', () => {
    expect(listThemes().map((theme) => theme.plate !== '' && theme.plateBorder !== '')).toEqual([true, false, false])
  })

  it('names every token in every theme', () => {
    const blank = listThemes().flatMap((theme) =>
      [
        ...[
          theme.backdrop,
          theme.surface,
          theme.surfaceRaised,
          theme.border,
          theme.rule,
          theme.borderActive,
          theme.shadow,
          theme.accent,
          theme.accentSoft,
        ],
        ...values(theme.text),
        ...values(theme.tones),
        ...values(theme.syntax),
        theme.chrome.bar,
        theme.chrome.title,
        ...theme.chrome.buttons,
        theme.fonts.sans,
        theme.fonts.mono,
      ].filter((value) => value === '')
    )
    expect(blank).toEqual([])
  })
})

describe('builtInTheme', () => {
  it.each(['portable', 'dark', 'light'] as const)('returns the %s theme by name', (id) => {
    expect(builtInTheme(id)).toEqual(expect.objectContaining({ id }))
  })

  it('rejects a name no theme carries', () => {
    expect(() => builtInTheme('sepia' as never)).toThrow('No media theme named "sepia". Built-in themes: portable, dark, light')
  })
})
