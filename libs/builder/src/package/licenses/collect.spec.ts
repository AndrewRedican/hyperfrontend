import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { collectThirdPartyLicenses } from './collect'
jest.mock('@hyperfrontend/logging', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/logging')>('@hyperfrontend/logging')
  return {
    ...actual,
    logger: { channel: jest.fn(() => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() })) },
  }
})

const writePkg = (dir: string, contents: object): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(contents))
}

describe('collectThirdPartyLicenses', () => {
  const workspace = useTempDir({ prefix: 'builder-licenses-' })
  let nodeModules: string

  beforeEach(() => {
    nodeModules = workspace.resolve('node_modules')
    mkdirSync(nodeModules, { recursive: true })
  })

  it('returns an empty array when externals is empty', () => {
    expect(collectThirdPartyLicenses(workspace.path, [])).toEqual([])
  })

  it('collects a license entry for a top-level dependency', () => {
    const dep = join(nodeModules, 'rollup')
    writePkg(dep, { name: 'rollup', license: 'MIT', repository: 'https://github.com/rollup/rollup.git' })
    writeFileSync(join(dep, 'LICENSE.md'), 'MIT License\n\n...')
    const result = collectThirdPartyLicenses(workspace.path, ['rollup'])
    expect(result).toEqual([expect.objectContaining({ name: 'rollup', licenseType: 'MIT' })])
  })

  it('resolves scoped packages under node_modules/@scope/name', () => {
    const dep = join(nodeModules, '@rollup', 'plugin-json')
    writePkg(dep, { name: '@rollup/plugin-json', license: 'MIT', repository: 'https://github.com/rollup/plugins.git' })
    const result = collectThirdPartyLicenses(workspace.path, ['@rollup/plugin-json'])
    expect(result).toEqual([expect.objectContaining({ name: '@rollup/plugin-json' })])
  })

  it('drops dependencies whose package.json is not present on disk', () => {
    const result = collectThirdPartyLicenses(workspace.path, ['missing'])
    expect(result).toEqual([])
  })

  it('falls back to the package.json license when no LICENSE file exists', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'Apache-2.0' })
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe('Apache-2.0')
  })

  it('marks the license as Unknown when neither package.json nor LICENSE convey it', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo' })
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe('Unknown')
  })

  it('detects MIT license from LICENSE file content', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'Unknown' })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License\n\nCopyright...')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe('MIT')
  })

  it('detects Apache-2.0 license from LICENSE file content', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo' })
    writeFileSync(join(dep, 'LICENSE'), 'Apache License Version 2.0\n\nlicense text...')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe('Apache-2.0')
  })

  it.each([
    ['BSD 3-Clause License', 'BSD-3-Clause'],
    ['BSD 2-Clause License', 'BSD-2-Clause'],
    ['ISC License', 'ISC'],
    ['GNU General Public License version 3', 'GPL-3.0'],
    ['GNU Lesser General Public License version 3', 'LGPL-3.0'],
    ['Mozilla Public License Version 2.0', 'MPL-2.0'],
  ])('detects %s license from LICENSE file content', (header, type) => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo' })
    writeFileSync(join(dep, 'LICENSE'), `${header}\n\nlicense text...`)
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe(type)
  })

  it('falls back to package.json license when LICENSE content is unrecognized', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'CUSTOM' })
    writeFileSync(join(dep, 'LICENSE'), 'Some bespoke license text')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseType).toBe('CUSTOM')
  })

  it('constructs a GitHub license URL when the repository is a GitHub URL', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT', repository: { type: 'git', url: 'https://github.com/x/y.git' } })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License')
    const url = collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl
    expect(url).toBe('https://github.com/x/y/blob/HEAD/LICENSE')
  })

  it('returns null licenseUrl when no LICENSE file is present', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT', repository: 'https://github.com/x/y.git' })
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl).toBeNull()
  })

  it('returns null licenseUrl when the repository field is missing', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT' })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl).toBeNull()
  })

  it('returns null licenseUrl for unrecognized repository hosts', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT', repository: 'https://example.com/x/y.git' })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl).toBeNull()
  })

  it('builds a GitLab license URL when the repository points at gitlab', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT', repository: 'https://gitlab.com/x/y.git' })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl).toBe('https://gitlab.com/x/y/-/blob/HEAD/LICENSE')
  })

  it('builds a Bitbucket license URL when the repository points at bitbucket', () => {
    const dep = join(nodeModules, 'foo')
    writePkg(dep, { name: 'foo', license: 'MIT', repository: 'https://bitbucket.org/x/y.git' })
    writeFileSync(join(dep, 'LICENSE'), 'MIT License')
    expect(collectThirdPartyLicenses(workspace.path, ['foo'])[0].licenseUrl).toBe('https://bitbucket.org/x/y/src/HEAD/LICENSE')
  })

  it('returns entries sorted alphabetically by package name', () => {
    for (const name of ['zeta', 'alpha', 'mike']) {
      const dep = join(nodeModules, name)
      writePkg(dep, { name, license: 'MIT' })
    }
    const result = collectThirdPartyLicenses(workspace.path, ['zeta', 'alpha', 'mike'])
    expect(result.map((e) => e.name)).toEqual(['alpha', 'mike', 'zeta'])
  })
})
