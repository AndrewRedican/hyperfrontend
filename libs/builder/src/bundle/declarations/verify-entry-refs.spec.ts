import type { BuildContext, EntryPoint, EntryPointDiscovery } from '../../models'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import {
  collectEntryRefs,
  collectExportedNames,
  collectReExports,
  findAliasCycles,
  findDanglingEntryRefs,
  verifyEntryTypeRefs,
} from './verify-entry-refs'

const entryOf = (srcPath: string): EntryPoint => ({
  exportPath: srcPath === '' ? '.' : `./${srcPath}`,
  srcPath,
  inputFile: `/abs/src/${srcPath}/index.ts`,
  isRoot: srcPath === '',
})

const makeDiscovery = (entries: EntryPoint[]): EntryPointDiscovery => ({
  category: 'hybrid',
  entryPoints: entries,
  hasRootEntry: entries.some((entry) => entry.isRoot),
  platformEntries: [],
  featureEntries: [],
})

const makeContext = (outputPath: string, srcPaths: string[]): BuildContext => ({
  projectRoot: '/abs/libs/foo',
  workspaceRoot: '/abs/repo',
  projectRelativePath: 'libs/foo',
  outputPath,
  tsConfigPath: '/abs/libs/foo/tsconfig.lib.json',
  external: [],
  assets: [],
  isWorkspacePackage: () => false,
  entryPointDiscovery: makeDiscovery(srcPaths.map(entryOf)),
  bundledDeps: [],
  workspaceBundledDeps: [],
  startedAt: 0,
})

describe('collectExportedNames', () => {
  it('collects re-exported and locally declared names', () => {
    const names = collectExportedNames(
      [
        "export type { Alias } from './alias';",
        "export { renamed as exposed } from './renamed';",
        'export declare const value: number;',
        'export declare function run(): void;',
        'export interface Shape {}',
        'export type Union = string;',
        'export declare class Widget {}',
        'declare const internal: number;',
        'interface Hidden {}',
        "export declare module 'ambient' {}",
        ';',
      ].join('\n')
    )
    expect([...(names ?? [])].sort()).toEqual(['Shape', 'Union', 'Widget', 'Alias', 'exposed', 'run', 'value'].sort())
  })

  it('reports an open export set for a bare star re-export', () => {
    expect(collectExportedNames("export * from './everything';")).toBeNull()
  })

  it('collects a namespace re-export under its alias', () => {
    expect([...(collectExportedNames("export * as models from './models';") ?? [])]).toEqual(['models'])
  })

  it('collects an export assignment as the default name', () => {
    expect([...(collectExportedNames('declare const main: () => void;\nexport = main;') ?? [])]).toEqual(['default'])
  })

  it('collects a default-modified declaration as the default name', () => {
    expect([...(collectExportedNames('export default class Widget {}') ?? [])]).toEqual(['default'])
  })

  it('skips a destructured exported variable', () => {
    expect([...(collectExportedNames('export declare const { a, b }: { a: number; b: number };') ?? [])]).toEqual([])
  })
})

describe('collectEntryRefs', () => {
  it('records named imports under the names the target must export', () => {
    expect(collectEntryRefs("import { Alpha, Beta as Local } from '..';")).toEqual([{ specifier: '..', names: ['Alpha', 'Beta'] }])
  })

  it('records a default import as the default name', () => {
    expect(collectEntryRefs("import generator from './feature';")).toEqual([{ specifier: './feature', names: ['default'] }])
  })

  it('records named re-exports under their source names', () => {
    expect(collectEntryRefs("export { Alpha as Renamed } from '..';")).toEqual([{ specifier: '..', names: ['Alpha'] }])
  })

  it('skips forms that name nothing falsifiable', () => {
    expect(
      collectEntryRefs(
        [
          "import * as everything from '..';",
          "import '../side-effect';",
          "export * from '..';",
          "export * as models from '..';",
          'export { Local };',
          'declare const Local: number;',
        ].join('\n')
      )
    ).toEqual([])
  })

  it('skips an import whose specifier is not a string literal', () => {
    expect(collectEntryRefs('import { Alpha } from notALiteral;')).toEqual([])
  })
})

describe('collectReExports', () => {
  it('records each re-exported name with the name the target must export', () => {
    expect(collectReExports("export { A, B as C } from './b';")).toEqual([
      { specifier: './b', exported: 'A', source: 'A' },
      { specifier: './b', exported: 'C', source: 'B' },
    ])
  })

  it('skips forms that forward no names', () => {
    expect(collectReExports("export * from './a';\nexport * as ns from './b';\nimport { z } from './c';\nexport { z };")).toEqual([])
  })
})

describe('findAliasCycles', () => {
  const outputDir = useTempDir({ prefix: 'builder-verify-refs-' })

  const writeEntry = (srcPath: string, source: string): string => outputDir.write(join(srcPath, 'index.d.ts'), source)

  it('reports a name two entries re-export from each other, once', () => {
    writeEntry('tech', "export { DetectionSource } from './monorepo';")
    writeEntry(
      'tech/monorepo',
      "import { DetectionSource } from '..';\nexport { DetectionSource } from '..';\nexport interface MonorepoDetection {\n    detectedFrom: DetectionSource[];\n}"
    )
    expect(findAliasCycles(makeContext(outputDir.path, ['tech', 'tech/monorepo']))).toEqual([
      [
        { source: outputDir.resolve('tech', 'index.d.ts'), exported: 'DetectionSource', specifier: './monorepo' },
        { source: outputDir.resolve('tech', 'monorepo', 'index.d.ts'), exported: 'DetectionSource', specifier: '..' },
      ],
    ])
  })

  it('follows a renamed re-export back to the name that aliases itself', () => {
    writeEntry('tech', "export { Source as DetectionSource } from './monorepo';")
    writeEntry('tech/monorepo', "export { DetectionSource as Source } from '..';")
    expect(
      findAliasCycles(makeContext(outputDir.path, ['tech', 'tech/monorepo'])).map((cycle) => cycle.map((hop) => hop.exported))
    ).toEqual([['DetectionSource', 'Source']])
  })

  it('reports a cycle reached from an entry outside it once', () => {
    writeEntry('a', "export { X } from '../b';")
    writeEntry('b', "export { X } from '../c';")
    writeEntry('c', "export { X } from '../b';")
    writeEntry('d', "export { X } from '../b';")
    expect(findAliasCycles(makeContext(outputDir.path, ['a', 'b', 'c', 'd'])).map((cycle) => cycle.map((hop) => hop.source))).toEqual([
      [outputDir.resolve('b', 'index.d.ts'), outputDir.resolve('c', 'index.d.ts')],
    ])
  })

  it('ignores bare specifiers, self references, paths outside the entry set, and a chain ending at a declaration', () => {
    writeEntry('', "export { DetectionSource } from './shared/types';\nexport { Node } from 'typescript';\nexport { Self } from '.';")
    writeEntry('host', "export { DetectionSource } from '..';")
    expect(findAliasCycles(makeContext(outputDir.path, ['', 'host']))).toEqual([])
  })
})

describe('findDanglingEntryRefs', () => {
  const outputDir = useTempDir({ prefix: 'builder-verify-refs-' })

  const writeEntry = (srcPath: string, source: string): string => outputDir.write(join(srcPath, 'index.d.ts'), source)

  it('reports names the target entry does not export', () => {
    writeEntry('', 'export declare const sdkInfo: string;')
    writeEntry('host', "import { EventHandler } from '..';\nexport declare const on: EventHandler;")
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host']))).toEqual([
      {
        source: outputDir.resolve('host', 'index.d.ts'),
        specifier: '..',
        target: outputDir.resolve('index.d.ts'),
        missing: ['EventHandler'],
      },
    ])
  })

  it('accepts a reference the target entry exports', () => {
    writeEntry('', "export type { EventHandler } from './shared/event-emitter';")
    writeEntry('host', "import { EventHandler } from '..';\nexport declare const on: EventHandler;")
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host']))).toEqual([])
  })

  it('accepts a reference against an entry with an open export set', () => {
    writeEntry('', "export * from './everything';")
    writeEntry('host', "import { EventHandler } from '..';\nexport declare const on: EventHandler;")
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host']))).toEqual([])
  })

  it('ignores bare specifiers, self references, and paths outside the entry set', () => {
    writeEntry('', 'export declare const sdkInfo: string;')
    writeEntry(
      'host',
      ["import { Plugin } from 'rollup';", "import { Local } from '.';", "import { Helper } from './internal';"].join('\n')
    )
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host']))).toEqual([])
  })

  it('skips entries the build did not emit declarations for', () => {
    writeEntry('', 'export declare const sdkInfo: string;')
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host']))).toEqual([])
  })

  it('reuses one parse of a target referenced by several entries', () => {
    writeEntry('', 'export declare const sdkInfo: string;')
    writeEntry('host', "import { EventHandler } from '..';")
    writeEntry('hostee', "import { EventHandler } from '..';")
    expect(findDanglingEntryRefs(makeContext(outputDir.path, ['', 'host', 'hostee'])).map((ref) => ref.source)).toEqual([
      outputDir.resolve('host', 'index.d.ts'),
      outputDir.resolve('hostee', 'index.d.ts'),
    ])
  })
})

describe('verifyEntryTypeRefs', () => {
  const outputDir = useTempDir({ prefix: 'builder-verify-refs-' })

  const writeEntry = (srcPath: string, source: string): string => outputDir.write(join(srcPath, 'index.d.ts'), source)

  it('passes when every cross-entry reference resolves', () => {
    writeEntry('', "export type { EventHandler } from './shared/event-emitter';")
    writeEntry('host', "import { EventHandler } from '..';")
    expect(() => verifyEntryTypeRefs(makeContext(outputDir.path, ['', 'host']))).not.toThrow()
  })

  it('throws naming each hop of an alias cycle', () => {
    writeEntry('tech', "export { DetectionSource } from './monorepo';")
    writeEntry('tech/monorepo', "export { DetectionSource } from '..';")
    expect(() => verifyEntryTypeRefs(makeContext(outputDir.path, ['tech', 'tech/monorepo']))).toThrow(
      /1 declaration alias cycle\(s\)[\s\S]*TS2303[\s\S]*tech\/index\.d\.ts re-exports DetectionSource from '\.\/monorepo', and tech\/monorepo\/index\.d\.ts re-exports DetectionSource from '\.\.'/
    )
  })

  it('throws naming the entry, the specifier, and the missing symbols', () => {
    writeEntry('', 'export declare const sdkInfo: string;')
    writeEntry('host', "import { EventHandler, PresentPayload } from '..';")
    expect(() => verifyEntryTypeRefs(makeContext(outputDir.path, ['', 'host']))).toThrow(
      /1 cross-entry type reference\(s\)[\s\S]*host\/index\.d\.ts references EventHandler, PresentPayload from '\.\.', which index\.d\.ts does not export/
    )
  })
})
