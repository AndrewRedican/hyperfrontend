import { describe, expect, it } from '@hyperfrontend/testing'
import { scopeCss } from './scope-css'

describe('scopeCss', () => {
  it('prefixes a single selector', () => {
    expect(scopeCss('.p-row { color: red; }', '.seq-chapter--1')).toBe('.seq-chapter--1 .p-row { color: red; }\n')
  })

  it('prefixes every selector in a list', () => {
    expect(scopeCss('.p-row--lit, .p-caret { color: blue; }', '.c')).toBe('.c .p-row--lit, .c .p-caret { color: blue; }\n')
  })

  it('strips block comments before scoping', () => {
    expect(scopeCss('/* why: a note */ .a { x: 1; }', '.c')).toBe('.c .a { x: 1; }\n')
  })

  it('drops an empty selector left by a trailing comma', () => {
    expect(scopeCss('.a, { x: 1; }', '.c')).toBe('.c .a { x: 1; }\n')
  })

  it('keeps two stylesheets from the same stage apart under different scopes', () => {
    const css = '.p-frame { gap: 4px; }'
    expect([scopeCss(css, '.seq-chapter--0'), scopeCss(css, '.seq-chapter--1')]).toEqual([
      '.seq-chapter--0 .p-frame { gap: 4px; }\n',
      '.seq-chapter--1 .p-frame { gap: 4px; }\n',
    ])
  })
})
