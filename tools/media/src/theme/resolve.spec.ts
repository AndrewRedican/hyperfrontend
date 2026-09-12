import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveTheme } from './resolve'
import { builtInTheme } from './themes'

describe('resolveTheme', () => {
  it('returns the built-in theme untouched when the scene tints and overrides nothing', () => {
    expect(resolveTheme('dark', undefined, undefined)).toEqual(builtInTheme('dark'))
  })

  it.each(['portable', 'dark', 'light'] as const)('resolves the %s variant by name', (id) => {
    expect(resolveTheme(id, undefined, undefined).id).toBe(id)
  })

  it('rejects a variant no built-in theme carries', () => {
    expect(() => resolveTheme('sepia' as never, undefined, undefined)).toThrow('No media theme named "sepia"')
  })

  it('tints the dark backdrop with the hue and leaves its readable tokens alone', () => {
    const tinted = resolveTheme('dark', 120, undefined)
    expect(tinted).toEqual({ ...builtInTheme('dark'), backdrop: expect.stringContaining('hsl(120 44% 17%)') })
  })

  it('tints the light backdrop with the hue', () => {
    expect(resolveTheme('light', 120, undefined).backdrop).toBe('linear-gradient(170deg, hsl(120 60% 98%) 0%, hsl(120 45% 93%) 100%)')
  })

  it('tints the portable plate and surfaces faintly and leaves the backdrop transparent', () => {
    const tinted = resolveTheme('portable', 120, undefined)
    expect(tinted).toEqual({
      ...builtInTheme('portable'),
      backdrop: 'transparent',
      plate: 'hsl(120 9% 12%)',
      plateBorder: 'hsl(120 8% 33%)',
      surface: 'hsl(120 10% 16%)',
      surfaceRaised: 'hsl(120 10% 20%)',
      border: 'hsl(120 9% 29%)',
      rule: 'hsl(120 9% 25%)',
    })
  })

  it('applies an override for every variant', () => {
    expect(resolveTheme('light', undefined, { all: { accent: '#5eead4' } }).accent).toBe('#5eead4')
  })

  it("applies a variant's own override over the one for every variant", () => {
    expect(resolveTheme('light', undefined, { all: { accent: '#5eead4' }, light: { accent: '#0d9488' } }).accent).toBe('#0d9488')
  })

  it("leaves another variant's override alone", () => {
    expect(resolveTheme('dark', undefined, { light: { accent: '#0d9488' } }).accent).toBe(builtInTheme('dark').accent)
  })

  it('merges a grouped override one level deep without dropping its siblings', () => {
    const resolved = resolveTheme('dark', undefined, { all: { tones: { danger: '#ff0000' }, fonts: { mono: 'Fira Code' } } })
    expect(resolved).toEqual(
      expect.objectContaining({
        tones: { ...builtInTheme('dark').tones, danger: '#ff0000' },
        fonts: { ...builtInTheme('dark').fonts, mono: 'Fira Code' },
      })
    )
  })

  it('lays the overrides over the tint, so an override can undo it', () => {
    expect(resolveTheme('light', 120, { light: { backdrop: '#ffffff' } }).backdrop).toBe('#ffffff')
  })

  it('never mutates the built-in table', () => {
    resolveTheme('dark', 300, { all: { accent: '#000000', text: { plain: '#000000' } } })
    expect(builtInTheme('dark')).toEqual(
      expect.objectContaining({ accent: '#60a5fa', text: expect.objectContaining({ plain: '#cbd5f5' }) })
    )
  })

  it('resolves each call from the built-in table, so one scene cannot colour another', () => {
    resolveTheme('portable', 10, { all: { accent: '#123456' } })
    expect(resolveTheme('portable', undefined, undefined)).toEqual(builtInTheme('portable'))
  })
})
