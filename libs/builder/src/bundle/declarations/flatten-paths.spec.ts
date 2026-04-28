import type { BuildContext, EntryPointDiscovery } from '../../models'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { flattenDeclarationPaths } from './flatten-paths'

const writeFile = (path: string, content = ''): void => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

const makeDiscovery = (entries: EntryPointDiscovery['entryPoints']): EntryPointDiscovery => ({
  category: 'root',
  entryPoints: entries,
  hasRootEntry: entries.some((e) => e.isRoot),
  platformEntries: entries.filter((e) => !e.isRoot && e.platform !== undefined),
  featureEntries: entries.filter((e) => !e.isRoot && e.platform === undefined),
})

describe('flattenDeclarationPaths', () => {
  let workspaceRoot: string
  let projectRoot: string
  let outputPath: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'builder-flat-'))
    projectRoot = join(workspaceRoot, 'libs', 'foo')
    outputPath = join(workspaceRoot, 'dist', 'libs', 'foo')
    mkdirSync(projectRoot, { recursive: true })
    mkdirSync(outputPath, { recursive: true })
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
  })

  const makeContext = (discovery: EntryPointDiscovery): BuildContext => ({
    projectRoot,
    workspaceRoot,
    projectRelativePath: 'libs/foo',
    outputPath,
    tsConfigPath: join(projectRoot, 'tsconfig.lib.json'),
    external: [],
    assets: [],
    isWorkspacePackage: () => false,
    entryPointDiscovery: discovery,
    startedAt: 0,
  })

  it('returns silently when the nested declarations directory does not exist', () => {
    expect(() =>
      flattenDeclarationPaths(makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: '', isRoot: true }])))
    ).not.toThrow()
  })

  it('moves root declaration files from the nested src directory to the package root', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'index.d.ts'), 'export {}')
    writeFile(join(nested, 'index.d.ts.map'), '{}')
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(readFileSync(join(outputPath, 'index.d.ts'), 'utf-8')).toBe('export {}')
  })

  it('relocates declarations for a non-root entry into the matching subdirectory', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'browser', 'index.d.ts'), 'export {}')
    flattenDeclarationPaths(
      makeContext(
        makeDiscovery([
          {
            exportPath: './browser',
            srcPath: 'browser',
            inputFile: join(projectRoot, 'src/browser/index.ts'),
            isRoot: false,
            platform: 'browser',
          },
        ])
      )
    )
    expect(existsSync(join(outputPath, 'browser', 'index.d.ts'))).toBe(true)
  })

  it('skips non-root entries whose declaration source directory is missing', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    mkdirSync(nested, { recursive: true })
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: './browser', srcPath: 'browser', inputFile: '', isRoot: false, platform: 'browser' }]))
    )
    expect(existsSync(join(outputPath, 'browser'))).toBe(false)
  })

  it('copies declaration files from the lib/ folder when present', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'lib', 'shared.d.ts'), 'export {}')
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(existsSync(join(outputPath, 'lib', 'shared.d.ts'))).toBe(true)
  })

  it('skips non-declaration files inside lib/', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'lib', 'shared.d.ts'), 'export {}')
    writeFile(join(nested, 'lib', 'shared.js'), 'noop')
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(existsSync(join(outputPath, 'lib', 'shared.js'))).toBe(false)
  })

  it('skips non-declaration files at the root of the nested src dir', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'index.d.ts'), 'export {}')
    writeFile(join(nested, 'index.js'), 'noop')
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(existsSync(join(outputPath, 'index.js'))).toBe(false)
  })

  it('skips directory entries at the nested src root when flattening root declarations', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'index.d.ts'), 'export {}')
    mkdirSync(join(nested, 'browser'), { recursive: true })
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(existsSync(join(outputPath, 'index.d.ts'))).toBe(true)
  })

  it('removes the leftover libs / plugins / apps directories at the output root', () => {
    const nested = join(outputPath, 'libs', 'foo', 'src')
    writeFile(join(nested, 'index.d.ts'), 'export {}')
    flattenDeclarationPaths(
      makeContext(makeDiscovery([{ exportPath: '.', srcPath: '', inputFile: join(projectRoot, 'src/index.ts'), isRoot: true }]))
    )
    expect(existsSync(join(outputPath, 'libs'))).toBe(false)
  })
})
