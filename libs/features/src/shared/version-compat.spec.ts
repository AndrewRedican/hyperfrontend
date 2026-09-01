import type { FeatureContract } from './types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createContractCompat } from './version-compat'

const compat = createContractCompat()

const withVersion = (version?: string): FeatureContract => ({
  emitted: [{ type: 'timeUpdated' }],
  accepted: [{ type: 'setTimezone' }],
  ...(version !== undefined && { version }),
})

describe('createContractCompat', () => {
  it('is compatible when neither side announces a version', () => {
    expect(compat(withVersion(), withVersion())).toEqual({ compatible: true })
  })

  it('is compatible when only the counterpart announces a version', () => {
    expect(compat(withVersion(), withVersion('2.0.0'))).toEqual({ compatible: true })
  })

  it('is compatible when only the local side announces a version', () => {
    expect(compat(withVersion('2.0.0'), withVersion())).toEqual({ compatible: true })
  })

  it('is compatible across differing minors of the same major', () => {
    expect(compat(withVersion('1.2.0'), withVersion('1.9.3'))).toEqual({ compatible: true })
  })

  it('is compatible across differing patches of the same 0.x minor', () => {
    expect(compat(withVersion('0.2.1'), withVersion('0.2.9'))).toEqual({ compatible: true })
  })

  it('is incompatible across differing minors below 1.0.0', () => {
    expect(compat(withVersion('0.2.0'), withVersion('0.3.0'))).toEqual({
      compatible: false,
      reason: 'Incompatible contract versions: this side holds 0.2.0 and the counterpart holds 0.3.0.',
    })
  })

  it('is incompatible across differing majors', () => {
    expect(compat(withVersion('1.2.0'), withVersion('2.0.0'))).toEqual({
      compatible: false,
      reason: 'Incompatible contract versions: this side holds 1.2.0 and the counterpart holds 2.0.0.',
    })
  })

  it('is symmetric: both sides reach the same verdict on a major mismatch', () => {
    expect(compat(withVersion('2.0.0'), withVersion('1.2.0')).compatible).toBe(false)
  })

  it('is incompatible when an announced version is not valid semver', () => {
    expect(compat(withVersion('1.0.0'), withVersion('latest'))).toEqual({
      compatible: false,
      reason:
        'Unrecognized contract version: this side announces "1.0.0" and the counterpart announces "latest"; both must be valid semver versions.',
    })
  })
})
