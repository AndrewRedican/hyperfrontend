import { describe, expect, it } from '@hyperfrontend/testing'
import { placeLibraryInEcosystem } from './docs-ecosystem'

const TOOLING =
  "    packages: ['@hyperfrontend/builder', '@hyperfrontend/versioning', '@hyperfrontend/project-scope', '@hyperfrontend/questions'],"

const MODULE = [
  'export const ECOSYSTEM_TIERS: readonly EcosystemTier[] = [',
  '  {',
  "    id: 'sdk',",
  "    label: 'Start here',",
  "    packages: ['@hyperfrontend/features'],",
  '  },',
  '  {',
  "    id: 'tooling',",
  "    label: 'Build, release, and CLI tooling',",
  '    // why: ordered by how large the problem is on its own.',
  TOOLING,
  '  },',
  '  {',
  "    id: 'standalone',",
  "    label: 'Standalone runtime libraries',",
  '    packages: [],',
  '  },',
  '  {',
  "    id: 'utilities',",
  "    label: 'Single-purpose utilities',",
  '    packages: [',
  "      '@hyperfrontend/data-utils',",
  "      '@hyperfrontend/time-utils',",
  '    ],',
  '  },',
  ']',
  '',
]

const SOURCE = MODULE.join('\n')

describe('placeLibraryInEcosystem', () => {
  it('appends to an inline array that still fits and reports the package before it', () => {
    expect(placeLibraryInEcosystem(SOURCE, '@hyperfrontend/nexus', 'sdk')).toEqual({
      content: SOURCE.replace(
        "    packages: ['@hyperfrontend/features'],",
        "    packages: ['@hyperfrontend/features', '@hyperfrontend/nexus'],"
      ),
      precededBy: '@hyperfrontend/features',
    })
  })

  it('breaks an inline array across lines when it would not fit the print width', () => {
    const { content } = placeLibraryInEcosystem(SOURCE, '@hyperfrontend/testing', 'tooling')
    expect(content.split(/\r?\n/).slice(10, 17)).toEqual([
      '    packages: [',
      "      '@hyperfrontend/builder',",
      "      '@hyperfrontend/versioning',",
      "      '@hyperfrontend/project-scope',",
      "      '@hyperfrontend/questions',",
      "      '@hyperfrontend/testing',",
      '    ],',
    ])
  })

  it('appends to an array written one package per line', () => {
    expect(placeLibraryInEcosystem(SOURCE, '@hyperfrontend/list-utils', 'utilities')).toEqual({
      content: SOURCE.replace(
        "      '@hyperfrontend/time-utils',\n",
        "      '@hyperfrontend/time-utils',\n      '@hyperfrontend/list-utils',\n"
      ),
      precededBy: '@hyperfrontend/time-utils',
    })
  })

  it('takes the predecessor from the level above when the level is empty', () => {
    expect(placeLibraryInEcosystem(SOURCE, '@hyperfrontend/logging', 'standalone')).toEqual({
      content: SOURCE.replace('    packages: [],', "    packages: ['@hyperfrontend/logging'],"),
      precededBy: '@hyperfrontend/questions',
    })
  })

  it('reports no predecessor for a package placed at the top of an empty hierarchy', () => {
    const empty = SOURCE.replace("    packages: ['@hyperfrontend/features'],", '    packages: [],')
    expect(placeLibraryInEcosystem(empty, '@hyperfrontend/features', 'sdk').precededBy).toBeNull()
  })

  it('leaves a placed package where it is and still reports the package before it', () => {
    expect(placeLibraryInEcosystem(SOURCE, '@hyperfrontend/questions', 'utilities')).toEqual({
      content: SOURCE,
      precededBy: '@hyperfrontend/project-scope',
    })
  })

  it('reports no predecessor for the package that leads the hierarchy', () => {
    expect(placeLibraryInEcosystem(SOURCE, '@hyperfrontend/features', 'sdk')).toEqual({ content: SOURCE, precededBy: null })
  })

  it('refuses a level the hierarchy does not have', () => {
    expect(() => placeLibraryInEcosystem(SOURCE, '@hyperfrontend/testing', 'messaging')).toThrow(
      'ecosystem.ts has no level named "messaging"'
    )
  })

  it('refuses packages listed before any level is named', () => {
    const orphaned = SOURCE.replace("    id: 'sdk',\n", '')
    expect(() => placeLibraryInEcosystem(orphaned, '@hyperfrontend/testing', 'tooling')).toThrow(
      'ecosystem.ts lists packages on line 4 before naming a level'
    )
  })

  it('refuses a module without the hierarchy', () => {
    expect(() => placeLibraryInEcosystem('export const OTHER = []\n', '@hyperfrontend/testing', 'tooling')).toThrow(
      'ecosystem.ts ECOSYSTEM_TIERS: the block that opens it was not found'
    )
  })
})
