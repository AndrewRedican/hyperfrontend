import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { writeThirdPartyLicensesFile } from './write'

describe('writeThirdPartyLicensesFile', () => {
  const outputDir = useTempDir({ prefix: 'builder-licenses-write-' })

  it('writes the THIRD_PARTY_LICENSES.md file at the output root', () => {
    writeThirdPartyLicensesFile(outputDir.path, '# Third-Party Licenses\n')
    expect(outputDir.read('THIRD_PARTY_LICENSES.md')).toBe('# Third-Party Licenses\n')
  })

  it('overwrites existing content on subsequent calls', () => {
    writeThirdPartyLicensesFile(outputDir.path, 'first')
    writeThirdPartyLicensesFile(outputDir.path, 'second')
    expect(outputDir.read('THIRD_PARTY_LICENSES.md')).toBe('second')
  })
})
