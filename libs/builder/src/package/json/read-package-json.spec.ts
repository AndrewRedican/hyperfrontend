import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readProjectPackageJson } from './read-package-json'

describe('readProjectPackageJson', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-pkg-read-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reads and parses package.json from the given project root', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'foo', version: '1.2.3' }))
    expect(readProjectPackageJson(root)).toEqual({ name: 'foo', version: '1.2.3' })
  })

  it('throws when package.json is missing at the project root', () => {
    expect(() => readProjectPackageJson(root)).toThrow(/File not found/)
  })
})
