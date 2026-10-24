import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { readProjectPackageJson } from './read-package-json'

describe('readProjectPackageJson', () => {
  const dir = useTempDir({ prefix: 'builder-pkg-read-' })

  it('reads and parses package.json from the given project root', () => {
    dir.write('package.json', { name: 'foo', version: '1.2.3' })
    expect(readProjectPackageJson(dir.path)).toEqual({ name: 'foo', version: '1.2.3' })
  })

  it('throws when package.json is missing at the project root', () => {
    expect(() => readProjectPackageJson(dir.path)).toThrow(/File not found/)
  })
})
