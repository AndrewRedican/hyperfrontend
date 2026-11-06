import type { PackageJson } from '@hyperfrontend/builder/models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { rootAssetSpecs } from './root-assets'

describe('rootAssetSpecs', () => {
  const root = useTempDir({ prefix: 'root-assets-', tree: { 'LICENSE.md': 'licence', 'FUNDING.md': 'funding' } })

  it('copies a named file that exists at the root, and skips one that does not', () => {
    expect(rootAssetSpecs(root.path, ['LICENSE.md', 'SECURITY.md'])).toEqual([{ from: root.path, files: ['LICENSE.md'] }])
  })

  it.each([
    ['declares funding', { name: 'a', funding: { url: 'https://example.test' } }, true],
    ['declares none', { name: 'a' }, false],
  ])('copies the funding file into a package that %s: %s', (_, manifest, copied) => {
    expect(rootAssetSpecs(root.path, ['FUNDING.md'])[0]?.condition?.(manifest as PackageJson)).toBe(copied)
  })

  it('copies nothing when no file is named', () => {
    expect(rootAssetSpecs(root.path, [])).toEqual([])
  })
})
