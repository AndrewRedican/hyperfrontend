import { describe, expect, it } from '@hyperfrontend/testing'
import { languageFor } from './languages.ts'

describe('languageFor', () => {
  it('reads a .json file as JSON', () => {
    expect(languageFor('/w/package.json')?.name).toBe('json')
  })

  it('reads a .jsonc file as JSON', () => {
    expect(languageFor('/w/settings.jsonc')?.name).toBe('json')
  })

  it('has no language for an unknown extension', () => {
    expect(languageFor('/w/image.png')).toBeNull()
  })
})

describe('languageFor with an upper-case extension', () => {
  it('reads a .MTS file as code', () => {
    expect(languageFor('/w/FILE.MTS')?.name).toBe('code')
  })
})
