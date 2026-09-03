import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveSdkVersion } from './sdk-version'

describe('resolveSdkVersion', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hf-sdk-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves the version of the running SDK package by default', () => {
    const manifest = readJsonFileIfExists<{ version: string }>(join(import.meta.dirname, '../../../package.json'))
    expect(resolveSdkVersion()).toBe(manifest?.version)
  })

  it('ascends past unrelated manifests to the SDK manifest', () => {
    writeFileSync(join(dir, 'package.json'), '{ "name": "@hyperfrontend/features", "version": "9.9.9" }')
    const nested = join(dir, 'node_modules', 'other', 'dist')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(dir, 'node_modules', 'other', 'package.json'), '{ "name": "other", "version": "1.0.0" }')
    expect(resolveSdkVersion(nested)).toBe('9.9.9')
  })

  it('ascends past an SDK manifest whose version is not a string', () => {
    writeFileSync(join(dir, 'package.json'), '{ "name": "@hyperfrontend/features", "version": "7.7.7" }')
    const nested = join(dir, 'inner')
    mkdirSync(nested)
    writeFileSync(join(nested, 'package.json'), '{ "name": "@hyperfrontend/features", "version": 5 }')
    expect(resolveSdkVersion(nested)).toBe('7.7.7')
  })

  it('throws when no ancestor holds the SDK manifest', () => {
    expect(() => resolveSdkVersion(dir)).toThrow(`Could not locate the @hyperfrontend/features package.json above ${dir}`)
  })
})
