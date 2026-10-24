import { join } from 'node:path'
import { readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { resolveSdkVersion } from './sdk-version'

describe('resolveSdkVersion', () => {
  const tmp = useTempDir({ prefix: 'hf-sdk-' })

  it('resolves the version of the running SDK package by default', () => {
    const manifest = readJsonFileIfExists<{ version: string }>(join(import.meta.dirname, '../../../package.json'))
    expect(resolveSdkVersion()).toBe(manifest?.version)
  })

  it('ascends past unrelated manifests to the SDK manifest', () => {
    tmp.write('package.json', '{ "name": "@hyperfrontend/features", "version": "9.9.9" }')
    const nested = tmp.mkdir('node_modules/other/dist')
    tmp.write('node_modules/other/package.json', '{ "name": "other", "version": "1.0.0" }')
    expect(resolveSdkVersion(nested)).toBe('9.9.9')
  })

  it('ascends past an SDK manifest whose version is not a string', () => {
    tmp.write('package.json', '{ "name": "@hyperfrontend/features", "version": "7.7.7" }')
    const nested = tmp.mkdir('inner')
    tmp.write('inner/package.json', '{ "name": "@hyperfrontend/features", "version": 5 }')
    expect(resolveSdkVersion(nested)).toBe('7.7.7')
  })

  it('throws when no ancestor holds the SDK manifest', () => {
    expect(() => resolveSdkVersion(tmp.path)).toThrow(`Could not locate the @hyperfrontend/features package.json above ${tmp.path}`)
  })
})
