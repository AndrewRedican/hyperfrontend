import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { readResolvedTarget } from './resolved-target'

const EXECUTOR = '@fixture/tools:bundle'

/**
 * A `project.json` with one build target.
 *
 * @param name - What the project is called
 * @param build - The build target as the project writes it
 * @returns The text of the file
 */
function project(name: string, build: unknown): string {
  return stringify({ name, targets: { build } })
}

describe('readResolvedTarget', () => {
  // why: a directory per test, since the project reader keeps what it read of a directory
  const workspace = useTempDir({ prefix: 'lint-resolved-target-' })

  /**
   * Reads the build target of the project at `apps/hello`.
   *
   * @returns The resolved target, or null
   */
  function build(): ReturnType<typeof readResolvedTarget> {
    return readResolvedTarget(workspace.path, workspace.resolve('apps', 'hello'), 'build')
  }

  it('reads a target as the project writes it, where the workspace has no configuration', () => {
    workspace.write('apps/hello/project.json', project('hello', { executor: EXECUTOR, options: { outputPath: 'out/hello' } }))
    expect(build()).toEqual({ executor: EXECUTOR, options: { outputPath: 'out/hello' } })
  })

  it("replaces the tokens of the target's options", () => {
    workspace.write(
      'apps/hello/project.json',
      project('hello', { executor: EXECUTOR, options: { outputPath: 'dist/{projectRoot}/{projectName}' } })
    )
    expect(build()?.options).toEqual({ outputPath: 'dist/apps/hello/hello' })
  })

  it('merges the defaults the workspace gives the executor', () => {
    workspace.writeTree({
      'hf.json': stringify({ targetDefaults: { [EXECUTOR]: { options: { outputPath: 'build/{projectRoot}' } } } }),
      'apps/hello/project.json': project('hello', { executor: EXECUTOR }),
    })
    expect(build()?.options).toEqual({ outputPath: 'build/apps/hello' })
  })

  it('takes the executor from the default the workspace gives the target by name', () => {
    workspace.writeTree({
      'hf.json': stringify({ targetDefaults: { build: { executor: EXECUTOR } } }),
      'apps/hello/project.json': project('hello', {}),
    })
    expect(build()?.executor).toBe(EXECUTOR)
  })

  it('writes the root of a project at the workspace root as a dot', () => {
    workspace.write('project.json', project('root', { executor: EXECUTOR, options: { outputPath: 'dist/{projectRoot}' } }))
    expect(readResolvedTarget(workspace.path, workspace.path, 'build')?.options).toEqual({ outputPath: 'dist/.' })
  })

  it.each([
    ['holds no project', {}],
    ['holds a project with no name', { 'apps/hello/project.json': stringify({ targets: { build: {} } }) }],
    ['holds a project that writes no such target', { 'apps/hello/project.json': stringify({ name: 'hello', targets: { test: {} } }) }],
    ['holds a project whose target is no object', { 'apps/hello/project.json': stringify({ name: 'hello', targets: { build: null } }) }],
  ])('answers null where the directory %s', (_, tree) => {
    workspace.writeTree(tree)
    expect(build()).toBeNull()
  })

  it('reads a workspace configuration that is not JSON as an empty one, as the runner does', () => {
    workspace.writeTree({ 'hf.json': '{ // a comment\n}', 'apps/hello/project.json': project('hello', { executor: EXECUTOR }) })
    expect(build()).toEqual({ executor: EXECUTOR, options: {} })
  })

  it('reads a workspace configuration saved with a byte order mark', () => {
    workspace.writeTree({
      'hf.json': `\uFEFF${stringify({ targetDefaults: { [EXECUTOR]: { options: { outputPath: 'build/{projectRoot}' } } } })}`,
      'apps/hello/project.json': project('hello', { executor: EXECUTOR }),
    })
    expect(build()?.options).toEqual({ outputPath: 'build/apps/hello' })
  })

  it('answers null where the runner refuses the workspace configuration', () => {
    workspace.writeTree({
      'hf.json': stringify({ targetDefaults: { 'build*': { executor: EXECUTOR } } }),
      'apps/hello/project.json': project('hello', { executor: EXECUTOR }),
    })
    expect(build()).toBeNull()
  })
})
