import type { ReferrerPolicyValue } from './presets'
import { describe, expect, it } from '@hyperfrontend/testing'
import { crossOriginIsolation, immutableAssets, nosniff, referrerPolicy, strictTransportSecurity } from './presets'

describe('nosniff', () => {
  it('sets the content type options on every path', () => {
    expect(nosniff()).toEqual({ headers: { 'X-Content-Type-Options': 'nosniff' } })
  })

  it('bounds the rule by the scope', () => {
    expect(nosniff({ prefix: '/assets/' })).toEqual({ prefix: '/assets/', headers: { 'X-Content-Type-Options': 'nosniff' } })
  })

  it('refuses a scope whose prefix is no string', () => {
    expect(() => nosniff({ prefix: 5 as unknown as string })).toThrow('scope.prefix must be a string.')
  })
})

describe('referrerPolicy', () => {
  it('defaults to the origin on a cross-origin request', () => {
    expect(referrerPolicy()).toEqual({ headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } })
  })

  it('writes the value it is given under the scope', () => {
    expect(referrerPolicy('no-referrer', { prefix: '/private/' })).toEqual({
      prefix: '/private/',
      headers: { 'Referrer-Policy': 'no-referrer' },
    })
  })

  it('refuses a value that is no policy token', () => {
    expect(() => referrerPolicy('origin, unsafe-url' as ReferrerPolicyValue)).toThrow(
      'referrerPolicy: the value must be one of no-referrer, no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url.'
    )
  })

  it('refuses a scope whose suffix is no string', () => {
    expect(() => referrerPolicy('origin', { suffix: 5 as unknown as string })).toThrow('scope.suffix must be a string.')
  })
})

describe('strictTransportSecurity', () => {
  it('writes the lifetime alone', () => {
    expect(strictTransportSecurity({ maxAge: 15552000 })).toEqual({ headers: { 'Strict-Transport-Security': 'max-age=15552000' } })
  })

  it('writes the subdomain and preload directives after the lifetime', () => {
    expect(strictTransportSecurity({ maxAge: 63072000, includeSubDomains: true, preload: true })).toEqual({
      headers: { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' },
    })
  })

  it('writes the subdomain directive without preload', () => {
    expect(strictTransportSecurity({ maxAge: 300, includeSubDomains: true })).toEqual({
      headers: { 'Strict-Transport-Security': 'max-age=300; includeSubDomains' },
    })
  })

  it('accepts a lifetime of zero, which retires the policy', () => {
    expect(strictTransportSecurity({ maxAge: 0 })).toEqual({ headers: { 'Strict-Transport-Security': 'max-age=0' } })
  })

  it.each([[-1], [1.5], [Number.NaN], ['300'], [Number.MAX_VALUE]])('refuses the lifetime %p', (maxAge: number) => {
    expect(() => strictTransportSecurity({ maxAge })).toThrow(
      'strictTransportSecurity: maxAge must be a whole number of seconds, zero or more.'
    )
  })

  it('refuses preload without the subdomain directive', () => {
    expect(() => strictTransportSecurity({ maxAge: 63072000, preload: true })).toThrow(
      'strictTransportSecurity: preload needs includeSubDomains and a maxAge of at least 31536000.'
    )
  })

  it('throws both problems of a negative lifetime that asks for preload', () => {
    expect(() => strictTransportSecurity({ maxAge: -1, preload: true })).toThrow(
      'strictTransportSecurity: maxAge must be a whole number of seconds, zero or more.\nstrictTransportSecurity: preload needs includeSubDomains and a maxAge of at least 31536000.'
    )
  })

  it('refuses preload with a lifetime under a year', () => {
    expect(() => strictTransportSecurity({ maxAge: 31535999, includeSubDomains: true, preload: true })).toThrow(
      'strictTransportSecurity: preload needs includeSubDomains and a maxAge of at least 31536000.'
    )
  })
})

describe('immutableAssets', () => {
  it('caches everything under the prefix for a year', () => {
    expect(immutableAssets('/assets/')).toEqual({ prefix: '/assets/', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } })
  })

  it.each([['/'], ['assets/'], [''], [5]])('refuses the prefix %p', (prefix: string) => {
    expect(() => immutableAssets(prefix)).toThrow('immutableAssets: the prefix must start with "/" and name more than the whole site.')
  })
})

describe('crossOriginIsolation', () => {
  it('writes the three headers that isolate a document under the scope', () => {
    expect(crossOriginIsolation('credentialless', { prefix: '/app/' })).toEqual({
      prefix: '/app/',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    })
  })

  it('applies to every path without a scope', () => {
    expect(Object.keys(crossOriginIsolation('require-corp'))).toEqual(['headers'])
  })

  it('refuses a value that isolates nothing', () => {
    expect(() => crossOriginIsolation('same-origin' as 'require-corp')).toThrow(
      'crossOriginIsolation: the value must be one of require-corp, credentialless.'
    )
  })

  it('refuses a scope whose prefix is no string', () => {
    expect(() => crossOriginIsolation('require-corp', { prefix: 5 as unknown as string })).toThrow('scope.prefix must be a string.')
  })
})
