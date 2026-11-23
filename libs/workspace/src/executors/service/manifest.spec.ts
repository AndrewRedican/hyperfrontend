import { describe, expect, it } from '@hyperfrontend/testing'
import { serializeServiceManifest } from './manifest'

const DIGEST = 'b5b6218a6b9b5c1bfb195664199d27962e910b54420a8f192806d345987a91e9'

describe('serializeServiceManifest', () => {
  it('writes the section and its digest with two spaces of indentation', () => {
    expect(serializeServiceManifest({ greeting: 'Hello', punctuation: ['!', '?'], limits: { names: 3 } }, DIGEST)).toBe(
      [
        '{',
        '  "schema": 1,',
        '  "immutable": {',
        `    "digest": "${DIGEST}",`,
        '    "value": {',
        '      "greeting": "Hello",',
        '      "punctuation": [',
        '        "!",',
        '        "?"',
        '      ],',
        '      "limits": {',
        '        "names": 3',
        '      }',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n')
    )
  })

  it('ends with one line feed', () => {
    expect(serializeServiceManifest({}, DIGEST).endsWith('}\n')).toBe(true)
  })

  it("keeps the author's key order", () => {
    expect(serializeServiceManifest({ zebra: 1, apple: 2 }, DIGEST).indexOf('zebra')).toBeLessThan(
      serializeServiceManifest({ zebra: 1, apple: 2 }, DIGEST).indexOf('apple')
    )
  })

  it('writes an empty section as an empty object', () => {
    expect(serializeServiceManifest({}, DIGEST)).toContain('"value": {}')
  })
})
