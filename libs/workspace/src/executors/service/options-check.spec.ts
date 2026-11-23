import type { ExecutorContext } from '../../runner/contract'
import { rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { optionProblems, requiredFiles, servicePlan, workspacePath } from './options-check'

const OUTPUT_PLACE = '"outputPath" must name a directory inside the workspace and outside the project.'
const ASSET_GLOB = (index: number): string =>
  `"assets[${index}]" must be a glob relative to the entry module's directory: "/" separators, no "..", not absolute.`

const workspace = useTempDir({
  prefix: 'service-options-',
  tree: {
    'apps/hello/package.json': { name: '@fixture/hello', version: '0.0.0' },
    'apps/hello/service.config.ts': 'export default {}\n',
    'apps/hello/tsconfig.lib.json': {},
    'apps/hello/src/main.ts': '',
  },
})

/**
 * The context of a build task of the service at `apps/hello`.
 *
 * @returns The context, rooted at the temporary workspace
 */
function context(): ExecutorContext {
  return {
    root: workspace.path,
    cwd: workspace.path,
    projectName: 'hello',
    targetName: 'build',
    target: {},
    projects: { hello: { root: 'apps/hello' } },
    configuration: {},
  }
}

/**
 * Checks some options of the service at `apps/hello`.
 *
 * @param options - What the task was given
 * @returns One line per problem found
 */
function problems(options: Record<string, unknown>): readonly string[] {
  return optionProblems(options, workspace.path, join(workspace.path, 'apps/hello'))
}

/**
 * The message a function throws.
 *
 * @param run - The call
 * @returns The message, or empty text when nothing was thrown
 */
function thrown(run: () => unknown): string {
  try {
    run()
    return ''
  } catch (error) {
    return (error as Error).message
  }
}

describe('workspacePath', () => {
  it('names a path from the workspace root with forward slashes', () => {
    expect(workspacePath(workspace.path, join(workspace.path, 'apps', 'hello', 'src', 'main.ts'))).toBe('apps/hello/src/main.ts')
  })
})

describe('optionProblems', () => {
  it('finds no problem in options that set nothing', () => {
    expect(problems({})).toEqual([])
  })

  it('finds no problem in options that set every member', () => {
    expect(problems({ outputPath: 'dist/out', tsConfig: 'apps/hello/tsconfig.json', assets: ['assets/**'], verbose: true })).toEqual([])
  })

  it.each([
    ['an empty text', ''],
    ['a number', 3],
  ])('refuses an output path that is %s', (_, outputPath) => {
    expect(problems({ outputPath })).toEqual(['"outputPath" must be a non-empty string.'])
  })

  it.each([
    ['the workspace root', '.'],
    ['the project root', 'apps/hello'],
    ['inside the project', 'apps/hello/out'],
    ['outside the workspace', '../elsewhere'],
    ['the directory above the workspace', '..'],
  ])('refuses an output path that is %s', (_, outputPath) => {
    expect(problems({ outputPath })).toEqual([OUTPUT_PLACE])
  })

  it('refuses an output path that reaches the project through a link', () => {
    workspace.mkdir('dist')
    // why: a junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere
    symlinkSync(workspace.resolve('apps', 'hello'), workspace.resolve('dist', 'linked'), 'junction')
    expect(problems({ outputPath: 'dist/linked/src/built' })).toEqual([OUTPUT_PLACE])
  })

  it('accepts an output path below a directory that does not exist yet', () => {
    expect(problems({ outputPath: 'dist/not/yet/there' })).toEqual([])
  })

  it('asks a project at the workspace root, whose default output lies inside it, to state one', () => {
    expect(optionProblems({}, workspace.path, workspace.path)).toEqual([
      '"outputPath" must be stated: the default, dist, is not a directory outside the project.',
    ])
  })

  it('refuses a TypeScript configuration that is an empty text', () => {
    expect(problems({ tsConfig: '' })).toEqual(['"tsConfig" must be a non-empty string.'])
  })

  it('refuses assets that are not an array', () => {
    expect(problems({ assets: 'assets/**' })).toEqual(['"assets" must be an array.'])
  })

  it.each([
    ['is not a string', 3],
    ['is an empty text', ''],
    ['holds a backslash', 'assets\\notice.txt'],
    ['climbs with ".."', 'assets/../../secret'],
    ['starts with a slash', '/etc/passwd'],
    ['starts with a drive letter', 'C:notice.txt'],
  ])('refuses an asset glob that %s', (_, glob) => {
    expect(problems({ assets: ['assets/**', glob] })).toEqual([ASSET_GLOB(1)])
  })

  it('refuses a verbose flag that is not a boolean', () => {
    expect(problems({ verbose: 'yes' })).toEqual(['"verbose" must be a boolean.'])
  })

  it('names every unknown member once, in code-unit order', () => {
    expect(problems({ sourcemap: true, external: [] })).toEqual([
      'the options have an unknown member "external": the service executor takes outputPath, tsConfig, assets and verbose.',
      'the options have an unknown member "sourcemap": the service executor takes outputPath, tsConfig, assets and verbose.',
    ])
  })

  it('never prints a value', () => {
    expect(
      problems({ outputPath: 7, tsConfig: 8, assets: ['secret-marker\\'], verbose: 'secret-marker', 'secret-key': 1 }).join('\n')
    ).not.toContain('secret-marker')
  })
})

describe('servicePlan', () => {
  it('plans the default paths of a service', () => {
    expect(servicePlan({}, context())).toEqual({
      project: 'hello',
      task: 'hello:build',
      workspaceRoot: workspace.path,
      projectRoot: join(workspace.path, 'apps/hello'),
      sourceRoot: join(workspace.path, 'apps/hello/src'),
      entry: join(workspace.path, 'apps/hello/src/main.ts'),
      configFile: join(workspace.path, 'apps/hello/service.config.ts'),
      tsConfigPath: join(workspace.path, 'apps/hello/tsconfig.lib.json'),
      outputPath: join(workspace.path, 'dist/apps/hello'),
      assets: [],
    })
  })

  it('plans the paths the options state', () => {
    expect(servicePlan({ outputPath: 'dist/out', tsConfig: 'tsconfig.service.json', assets: ['assets/**'] }, context())).toEqual(
      expect.objectContaining({
        tsConfigPath: join(workspace.path, 'tsconfig.service.json'),
        outputPath: join(workspace.path, 'dist/out'),
        assets: ['assets/**'],
      })
    )
  })

  it('reports every problem of the options in one error', () => {
    expect(thrown(() => servicePlan({ outputPath: '', assets: ['a', '/b'], sourcemap: true }, context()))).toBe(
      [
        'Invalid options of hello:build:',
        '  - "outputPath" must be a non-empty string.',
        `  - ${ASSET_GLOB(1)}`,
        '  - the options have an unknown member "sourcemap": the service executor takes outputPath, tsConfig, assets and verbose.',
      ].join('\n')
    )
  })
})

describe('requiredFiles', () => {
  it('reads the name and the version of a service that has every file', () => {
    expect(requiredFiles(servicePlan({}, context()))).toEqual({ name: '@fixture/hello', version: '0.0.0' })
  })

  it.each([
    ['the entry module', 'apps/hello/src/main.ts', 'apps/hello/src/main.ts is missing.'],
    [
      'the service configuration',
      'apps/hello/service.config.ts',
      'apps/hello/service.config.ts is missing: npx hf generate service writes one.',
    ],
    ['the TypeScript configuration', 'apps/hello/tsconfig.lib.json', 'apps/hello/tsconfig.lib.json is missing.'],
    ['the manifest', 'apps/hello/package.json', 'apps/hello/package.json is missing.'],
  ])('refuses a service without %s', (_, file, line) => {
    rmSync(join(workspace.path, file))
    expect(thrown(() => requiredFiles(servicePlan({}, context())))).toBe(`hello cannot be built:\n  - ${line}`)
  })

  it('lists every missing file in one error', () => {
    rmSync(join(workspace.path, 'apps/hello'), { recursive: true })
    expect(thrown(() => requiredFiles(servicePlan({}, context())))).toBe(
      [
        'hello cannot be built:',
        '  - apps/hello/src/main.ts is missing.',
        '  - apps/hello/service.config.ts is missing: npx hf generate service writes one.',
        '  - apps/hello/tsconfig.lib.json is missing.',
        '  - apps/hello/package.json is missing.',
      ].join('\n')
    )
  })

  it('refuses a manifest without a name', () => {
    workspace.write('apps/hello/package.json', { version: '0.0.0' })
    expect(thrown(() => requiredFiles(servicePlan({}, context())))).toBe(
      'hello cannot be built:\n  - apps/hello/package.json must state a "name" as a non-empty string.'
    )
  })

  it('refuses a manifest whose version is empty', () => {
    workspace.write('apps/hello/package.json', { name: '@fixture/hello', version: '' })
    expect(thrown(() => requiredFiles(servicePlan({}, context())))).toBe(
      'hello cannot be built:\n  - apps/hello/package.json must state a "version" as a non-empty string.'
    )
  })

  it.each([
    ['does not parse', '{'],
    ['holds no object', 'null'],
  ])('refuses a manifest that %s, as one that states neither', (_, text) => {
    workspace.write('apps/hello/package.json', text)
    expect(thrown(() => requiredFiles(servicePlan({}, context())))).toBe(
      [
        'hello cannot be built:',
        '  - apps/hello/package.json must state a "name" as a non-empty string.',
        '  - apps/hello/package.json must state a "version" as a non-empty string.',
      ].join('\n')
    )
  })
})
