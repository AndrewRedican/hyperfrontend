import { describe, expect, it } from 'vitest'
import { FRAMEWORK_SITES, KOI_FRAMEWORKS, KOI_POND_SOURCE_URL, koiSourceUrl } from '../types.js'

describe('koiSourceUrl', () => {
  it('points every framework at its own application directory', () => {
    for (const framework of KOI_FRAMEWORKS) {
      expect(koiSourceUrl(framework)).toBe(`${KOI_POND_SOURCE_URL}/fish-${framework}`)
    }
  })
})

describe('FRAMEWORK_SITES', () => {
  it('names an official site for every framework in the pond', () => {
    for (const framework of KOI_FRAMEWORKS) {
      expect(FRAMEWORK_SITES[framework]).toMatch(/^https:\/\//)
    }
  })
})
