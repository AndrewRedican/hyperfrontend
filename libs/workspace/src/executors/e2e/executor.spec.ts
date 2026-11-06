import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { formatRun, libraryUnderTest, testingAliases } from './executor'

describe('formatRun', () => {
  it.each([
    ['cjs', ['src/cjs.spec.ts'], false],
    ['esm', ['src/esm.spec.ts'], false],
    ['browser', ['src/iife.spec.ts', 'src/umd.spec.ts'], true],
  ] as const)('runs the conventional specs of the built-in format %s', (format, candidates, dom) => {
    expect(formatRun(format, 'linux')).toEqual({ name: format, candidates, dom, timeoutMs: 30_000, serial: false })
  })

  it('knows no built-in format by another name', () => {
    expect(formatRun('nx' as 'cjs', 'linux')).toBe(undefined)
  })

  it('runs the suite a project declares with the defaults it leaves unset', () => {
    expect(formatRun({ name: 'cli', specs: ['src/cli.spec.ts'] }, 'linux')).toEqual({
      name: 'cli',
      candidates: ['src/cli.spec.ts'],
      dom: false,
      timeoutMs: 30_000,
      serial: false,
    })
  })

  it('takes the timeout and the DOM preload a declared suite asks for', () => {
    expect(formatRun({ name: 'slow', specs: ['src/slow.spec.ts'], timeoutMs: 900_000, dom: true }, 'linux')).toEqual(
      expect.objectContaining({ dom: true, timeoutMs: 900_000 })
    )
  })

  it.each([
    ['win32', true],
    ['linux', false],
  ])('runs a suite declared serial on win32 one at a time on %s: %s', (platform, serial) => {
    expect(formatRun({ name: 'nx', specs: ['src/nx.spec.ts'], serialOn: ['win32'] }, platform)?.serial).toBe(serial)
  })
})

describe('libraryUnderTest', () => {
  const projects = {
    docs: { root: 'docs' },
    alpha: { root: 'libs/alpha', targets: { build: {} } },
    beta: { root: 'libs/beta', targets: { build: {} } },
  }

  it('answers the first implicit dependency that builds', () => {
    expect(libraryUnderTest(projects, { root: 'e2e/alpha', implicitDependencies: ['docs', 'alpha', 'beta'] })).toBe(projects.alpha)
  })

  it.each([
    ['depends on nothing', { root: 'e2e/none' }],
    ['depends on no project that builds', { root: 'e2e/docs', implicitDependencies: ['docs'] }],
    ['depends on a project the workspace does not have', { root: 'e2e/gone', implicitDependencies: ['gone'] }],
  ])('answers nothing for a project that %s', (_, project) => {
    expect(libraryUnderTest(projects, project)).toBe(undefined)
  })
})

describe('testingAliases', () => {
  const workspace = useTempDir({
    prefix: 'e2e-aliases-',
    tree: {
      'source/tsconfig.base.json': {
        compilerOptions: {
          paths: {
            '@hyperfrontend/testing': ['libs/testing/src/index.ts'],
            '@hyperfrontend/testing/hooks': ['libs/testing/src/hooks/index.ts'],
            '@hyperfrontend/testing-extras': ['libs/extras/src/index.ts'],
            '@fixture/alpha': ['libs/alpha/src/index.ts'],
          },
        },
      },
      'installed/keep.txt': '',
    },
  })

  it('keeps the aliases of the test runtime and drops every other', () => {
    expect(testingAliases(`${workspace.path}/source`)).toEqual({
      '@hyperfrontend/testing': ['libs/testing/src/index.ts'],
      '@hyperfrontend/testing/hooks': ['libs/testing/src/hooks/index.ts'],
    })
  })

  it('answers none in a workspace that declares no aliases', () => {
    expect(testingAliases(`${workspace.path}/installed`)).toEqual({})
  })
})
