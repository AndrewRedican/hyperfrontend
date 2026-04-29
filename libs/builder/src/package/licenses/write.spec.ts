import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeThirdPartyLicensesFile } from './write'

describe('writeThirdPartyLicensesFile', () => {
  let outputPath: string

  beforeEach(() => {
    outputPath = mkdtempSync(join(tmpdir(), 'builder-licenses-write-'))
  })

  afterEach(() => {
    rmSync(outputPath, { recursive: true, force: true })
  })

  it('writes the THIRD_PARTY_LICENSES.md file at the output root', () => {
    writeThirdPartyLicensesFile(outputPath, '# Third-Party Licenses\n')
    expect(readFileSync(join(outputPath, 'THIRD_PARTY_LICENSES.md'), 'utf-8')).toBe('# Third-Party Licenses\n')
  })

  it('overwrites existing content on subsequent calls', () => {
    writeThirdPartyLicensesFile(outputPath, 'first')
    writeThirdPartyLicensesFile(outputPath, 'second')
    expect(readFileSync(join(outputPath, 'THIRD_PARTY_LICENSES.md'), 'utf-8')).toBe('second')
  })
})
