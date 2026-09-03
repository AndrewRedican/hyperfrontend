import type { BuildContext, WorkspaceBundledDep } from '../../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { collectWorkspaceExactSpecifiers, collectWorkspacePrefixDeps } from './collect-workspace-deps'

const dep = (over: Partial<WorkspaceBundledDep>): WorkspaceBundledDep => ({
  packageName: '@hyperfrontend/logging',
  subPath: '',
  specifier: '@hyperfrontend/logging',
  inputPath: '/abs/src/index.ts',
  tsConfigPath: '/abs/tsconfig.lib.json',
  policy: 'whole-surface',
  ...over,
})

const ctx = (deps: WorkspaceBundledDep[]): BuildContext => ({ workspaceBundledDeps: deps }) as BuildContext

describe('collectWorkspacePrefixDeps', () => {
  it('returns the distinct whole-surface package names', () => {
    const context = ctx([
      dep({ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }),
      dep({ packageName: '@hyperfrontend/logging', policy: 'whole-surface' }),
      dep({ packageName: '@hyperfrontend/events', policy: 'whole-surface' }),
    ])
    expect(collectWorkspacePrefixDeps(context)).toEqual(['@hyperfrontend/logging', '@hyperfrontend/events'])
  })

  it('ignores sub-path entries', () => {
    const context = ctx([dep({ packageName: '@hyperfrontend/logging', policy: 'sub-path', specifier: '@hyperfrontend/logging/node' })])
    expect(collectWorkspacePrefixDeps(context)).toEqual([])
  })
})

describe('collectWorkspaceExactSpecifiers', () => {
  it('returns the distinct sub-path specifiers', () => {
    const context = ctx([
      dep({ policy: 'sub-path', specifier: '@hyperfrontend/logging/node' }),
      dep({ policy: 'sub-path', specifier: '@hyperfrontend/logging/node' }),
      dep({ policy: 'sub-path', specifier: '@hyperfrontend/events/browser' }),
    ])
    expect(collectWorkspaceExactSpecifiers(context)).toEqual(['@hyperfrontend/logging/node', '@hyperfrontend/events/browser'])
  })

  it('ignores whole-surface entries', () => {
    const context = ctx([dep({ policy: 'whole-surface' })])
    expect(collectWorkspaceExactSpecifiers(context)).toEqual([])
  })
})
