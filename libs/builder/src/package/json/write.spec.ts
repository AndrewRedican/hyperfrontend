import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { writeOutputPackageJson } from './write'

describe('writeOutputPackageJson', () => {
  const outputDir = useTempDir({ prefix: 'builder-pkg-write-' })

  it('writes the package.json file at <outputPath>/package.json', () => {
    writeOutputPackageJson(outputDir.path, { name: 'foo', version: '1.0.0' })
    expect(outputDir.readJson('package.json')).toEqual({ name: 'foo', version: '1.0.0' })
  })

  it('appends a trailing newline to keep the published artifact formatter-clean', () => {
    writeOutputPackageJson(outputDir.path, { name: 'foo' })
    expect(outputDir.read('package.json').endsWith('\n')).toBe(true)
  })
})
