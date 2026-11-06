import { describe, expect, it } from '@hyperfrontend/testing'
import { buildPublishArgs } from './executor'

describe('buildPublishArgs', () => {
  it('publishes with no flags when no option is set', () => {
    expect(buildPublishArgs({})).toEqual(['publish'])
  })

  it('passes every option set, provenance last', () => {
    expect(
      buildPublishArgs({
        dryRun: true,
        registry: 'https://registry.example',
        tag: 'next',
        access: 'public',
        otp: '123456',
        provenance: true,
      })
    ).toEqual([
      'publish',
      '--dry-run',
      '--registry',
      'https://registry.example',
      '--tag',
      'next',
      '--access',
      'public',
      '--otp',
      '123456',
      '--provenance',
    ])
  })

  it('attaches provenance to a real publish', () => {
    expect(buildPublishArgs({ tag: 'latest', access: 'public', provenance: true })).toEqual([
      'publish',
      '--tag',
      'latest',
      '--access',
      'public',
      '--provenance',
    ])
  })

  it('publishes without provenance when the option is false', () => {
    expect(buildPublishArgs({ provenance: false })).toEqual(['publish'])
  })
})
