import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeOutputPackageJson } from './write'

describe('writeOutputPackageJson', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-pkg-write-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  it('writes the package.json file at <outputPath>/package.json', () => {
    writeOutputPackageJson(outputPath, { name: 'foo', version: '1.0.0' })
    const written = JSON.parse(readFileSync(join(outputPath, 'package.json'), 'utf-8'))
    expect(written).toEqual({ name: 'foo', version: '1.0.0' })
  })

  it('appends a trailing newline to keep the published artifact formatter-clean', () => {
    writeOutputPackageJson(outputPath, { name: 'foo' })
    const raw = readFileSync(join(outputPath, 'package.json'), 'utf-8')
    expect(raw.endsWith('\n')).toBe(true)
  })
})
