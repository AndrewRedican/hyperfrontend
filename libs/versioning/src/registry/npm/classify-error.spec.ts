import { describe, expect, it } from '@hyperfrontend/testing'
import { classifyNpmError } from './classify-error'

describe('classifyNpmError', () => {
  const withStderr = (stderr: string): unknown => ({ stderr, status: 1 })

  describe('absence', () => {
    it('treats a missing package as absent', () => {
      const stderr = 'npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@scope%2fmissing - Not found'

      expect(classifyNpmError(withStderr(stderr))).toEqual({ kind: 'absent' })
    })

    it('treats a missing version of an existing package as absent', () => {
      const stderr = 'npm error code E404\nnpm error 404 No match found for version 99.99.99'

      expect(classifyNpmError(withStderr(stderr))).toEqual({ kind: 'absent' })
    })

    it('reads standard error captured as bytes', () => {
      const stderr = new TextEncoder().encode('npm error code E404\nnpm error 404 Not Found')

      expect(classifyNpmError({ stderr, status: 1 })).toEqual({ kind: 'absent' })
    })
  })

  describe('unavailability', () => {
    it('classifies a timeout that produced no output', () => {
      const result = classifyNpmError({ code: 'ETIMEDOUT', signal: 'SIGTERM', status: null })

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'timeout' }))
    })

    it('classifies a refused connection as a network failure', () => {
      const result = classifyNpmError(withStderr('npm error code ECONNREFUSED\nnpm error syscall connect'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'network', detail: 'ECONNREFUSED' }))
    })

    it('classifies a name-resolution failure as a network failure', () => {
      const result = classifyNpmError(withStderr('npm error code ENOTFOUND\nnpm error syscall getaddrinfo'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'network', detail: 'ENOTFOUND' }))
    })

    it('classifies a rejected credential as an authentication failure', () => {
      const result = classifyNpmError(withStderr('npm error code E401\nnpm error Incorrect or missing password'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'authentication', detail: 'E401' }))
    })

    it('classifies a throttled request as a rate limit', () => {
      const result = classifyNpmError(withStderr('npm error code E429\nnpm error Too many requests'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'rate-limit' }))
    })

    it('classifies a registry outage as a server failure', () => {
      const result = classifyNpmError(withStderr('npm error code E503\nnpm error Service Unavailable'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'server', detail: 'E503' }))
    })

    it('defaults to unavailable when nothing is recognised', () => {
      const result = classifyNpmError(withStderr('npm error something entirely new'))

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'unknown' }))
    })

    it('defaults to unavailable when there is no diagnostic output at all', () => {
      const result = classifyNpmError({})

      expect(result).toEqual(expect.objectContaining({ kind: 'unavailable', reason: 'unknown', detail: 'no diagnostic output' }))
    })

    it('defaults to unavailable for a nullish error', () => {
      expect(classifyNpmError(null)).toEqual(expect.objectContaining({ kind: 'unavailable' }))
    })
  })
})
