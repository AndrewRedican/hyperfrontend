import type { ProjectRecord, Reason } from '@hyperfrontend/workspace/graph'
import { describe, expect, it } from '@hyperfrontend/testing'
import { rebuiltProjects } from './rebuilt-projects'

const OWNERS: Readonly<Record<string, { name: string; root: string }>> = {
  'libs/features/src/index.ts': { name: 'lib-features', root: 'libs/features' },
  'libs/builder/src/build.ts': { name: 'lib-builder', root: 'libs/builder' },
  'assets/media/features/banner.json': { name: '@hyperfrontend/workspace', root: '.' },
}

const graph = { projectOf: (file: string): ProjectRecord | null => (OWNERS[file] as ProjectRecord | undefined) ?? null }

/**
 * A reason the graph gives for selecting a build.
 *
 * @param rule - The rule that fired
 * @param file - The changed file the reason starts from
 * @returns The reason, with no trace and no message
 */
function because(rule: Reason['rule'], file: string): Reason {
  return { rule, file, path: [], message: '' }
}

describe('rebuiltProjects', () => {
  it('names a project whose build a change in another project selected', () => {
    expect(
      rebuiltProjects(graph, [{ task: 'lib-features:build', reasons: [because('reachable-from-entry', 'libs/builder/src/build.ts')] }])
    ).toEqual(['lib-features'])
  })

  it('leaves out a project whose build only its own files selected', () => {
    expect(
      rebuiltProjects(graph, [{ task: 'lib-features:build', reasons: [because('changed-input', 'libs/features/src/index.ts')] }])
    ).toEqual([])
  })

  it('leaves out a project whose build only a global configuration change selected', () => {
    expect(rebuiltProjects(graph, [{ task: 'lib-features:build', reasons: [because('global-config', 'package-lock.json')] }])).toEqual([])
  })

  it('leaves out a project whose build only a file of the workspace root selected', () => {
    expect(
      rebuiltProjects(graph, [{ task: 'lib-features:build', reasons: [because('changed-input', 'assets/media/features/banner.json')] }])
    ).toEqual([])
  })

  it('names a project selected for a global configuration change and for a change in another project', () => {
    expect(
      rebuiltProjects(graph, [
        {
          task: 'lib-features:build',
          reasons: [because('global-config', 'package-lock.json'), because('changed-input', 'libs/builder/src/build.ts')],
        },
      ])
    ).toEqual(['lib-features'])
  })

  it('reads the project name before the last colon of the task', () => {
    expect(
      rebuiltProjects(graph, [{ task: '@scope/app:build', reasons: [because('changed-input', 'libs/builder/src/build.ts')] }])
    ).toEqual(['@scope/app'])
  })
})
