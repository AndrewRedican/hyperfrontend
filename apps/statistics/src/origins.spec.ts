import { describe, expect, it } from '@hyperfrontend/testing'
import { asOrigins } from './origins'

describe('asOrigins', () => {
  it('reads one origin', () => {
    expect(asOrigins().read('https://www.example.dev')).toEqual(['https://www.example.dev'])
  })

  it('reads several origins in the order given', () => {
    expect(asOrigins().read('https://www.example.dev,http://localhost:3000')).toEqual(['https://www.example.dev', 'http://localhost:3000'])
  })

  it('writes each origin the way a browser sends it', () => {
    expect(asOrigins().read('https://www.example.dev:443/')).toEqual(['https://www.example.dev'])
  })

  it('refuses the whole list when one entry is not an origin', () => {
    expect(asOrigins().read('https://www.example.dev,example.dev')).toBeUndefined()
  })

  it('refuses plain http for a host that is not a loopback', () => {
    expect(asOrigins().read('http://www.example.dev')).toBeUndefined()
  })

  it('says what it expects and that it holds no secret', () => {
    expect({ expected: asOrigins().expected, secret: asOrigins().secret }).toEqual({
      expected: 'a comma-separated list of origins, such as https://site.example,http://localhost:3000',
      secret: false,
    })
  })
})
