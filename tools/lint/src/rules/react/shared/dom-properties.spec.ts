import { describe, expect, it } from '@hyperfrontend/testing'
import { ANY_CASE, ARIA, POINTER_PROPERTIES, PROPERTIES, RENAMED, TAGS_BY_PROPERTY } from './dom-properties.ts'

describe('dom-properties', () => {
  it('renames an HTML attribute', () => {
    expect(RENAMED.get('class')).toBe('className')
  })
  it('camel-cases a hyphenated SVG attribute', () => {
    expect(RENAMED.get('stroke-dasharray')).toBe('strokeDasharray')
  })
  it('camel-cases a namespaced SVG attribute', () => {
    expect(RENAMED.get('xlink:href')).toBe('xlinkHref')
  })
  it('lists the tags of a tag-specific property', () => {
    expect(TAGS_BY_PROPERTY.get('download')).toEqual(['a', 'area'])
  })
  it('reads names in any case', () => {
    expect(ANY_CASE.includes('charset')).toBe(true)
  })
  it('knows an ARIA attribute', () => {
    expect(ARIA.has('aria-label')).toBe(true)
  })
  it('finds a property by its lower-cased form', () => {
    expect(PROPERTIES.get('onclick')).toBe('onClick')
  })
  it('keeps the first spelling of a name listed twice', () => {
    expect(PROPERTIES.get('onchange')).toBe('onChange')
  })
  it('finds a pointer event property', () => {
    expect(POINTER_PROPERTIES.get('onpointerdown')).toBe('onPointerDown')
  })
})
