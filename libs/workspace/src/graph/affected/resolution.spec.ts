import type { WorkspaceFile } from '../inputs'
import type { ProjectRecord } from '../model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { targetResolution } from './resolution'

/** A library whose targets take the workspace defaults. */
const library = {
  name: 'lib-a',
  root: 'libs/a',
  configuration: { name: 'lib-a', targets: { build: {}, test: {} } },
} as unknown as ProjectRecord

/** The same library with its own build inputs. */
const configured = {
  ...library,
  configuration: { name: 'lib-a', targets: { build: { inputs: ['{projectRoot}/src/**/*'] }, test: {} } },
} as unknown as ProjectRecord

/** A workspace file with a production input and build defaults reading it. */
const file: WorkspaceFile = {
  namedInputs: { production: ['default', '!{projectRoot}/**/*.spec.ts'], docs: ['{projectRoot}/docs/**/*'] },
  targetDefaults: {
    build: { inputs: ['production', '^production', { projects: 'lib-tooling', input: 'production' }], executor: '@fixture/tooling:build' },
    test: { inputs: ['default', '^production'] },
  },
}

/**
 * The file with one named input replaced.
 *
 * @param name - The named input
 * @param patterns - Its new patterns
 * @returns The file
 */
function withInput(name: string, patterns: readonly string[]): WorkspaceFile {
  return { ...file, namedInputs: { ...file.namedInputs, [name]: patterns } }
}

describe('targetResolution', () => {
  it('resolves the same text under the same file', () => {
    expect(targetResolution(file, library, 'build')).toBe(targetResolution({ ...file }, library, 'build'))
  })

  it('resolves differently when the defaults of the target change', () => {
    const changed: WorkspaceFile = { ...file, targetDefaults: { ...file.targetDefaults, build: { inputs: ['production'] } } }
    expect(targetResolution(changed, library, 'build')).not.toBe(targetResolution(file, library, 'build'))
  })

  it('resolves differently when a named input the target reads changes', () => {
    expect(targetResolution(withInput('production', ['default']), library, 'build')).not.toBe(targetResolution(file, library, 'build'))
  })

  it('resolves differently when the named input of a dependency input changes', () => {
    expect(targetResolution(withInput('production', ['default']), library, 'test')).not.toBe(targetResolution(file, library, 'test'))
  })

  it('resolves the same when a named input the target does not read changes', () => {
    expect(targetResolution(withInput('docs', ['{projectRoot}/guide.md']), library, 'build')).toBe(targetResolution(file, library, 'build'))
  })

  it('expands the input naming other projects', () => {
    expect(targetResolution(file, library, 'build')).toContain('"of":["lib-tooling"]')
  })

  it("reads the project's own inputs before the defaults", () => {
    expect(targetResolution(file, configured, 'build')).toContain('"patterns":["{projectRoot}/src/**/*"],"of":"self"')
  })

  it('expands every input form: a dependency object, a projects list, a fileset and the task itself', () => {
    const forms = {
      ...library,
      configuration: {
        name: 'lib-a',
        targets: {
          build: {
            inputs: [
              { input: 'docs', dependencies: true },
              { dependencies: true },
              { projects: ['lib-b', 'lib-c'], input: 'docs' },
              { projects: 'lib-b' },
              { projects: 'self', input: 'docs' },
              { fileset: '{workspaceRoot}/notes/**/*' },
            ],
          },
        },
      },
    } as unknown as ProjectRecord
    expect(targetResolution(file, forms, 'build')).toContain(
      '"inputs":[{"patterns":["{projectRoot}/docs/**/*"],"of":"dependencies"},{"patterns":["{projectRoot}/**/*"],"of":"dependencies"},{"patterns":["{projectRoot}/docs/**/*"],"of":["lib-b","lib-c"]},{"patterns":["{projectRoot}/**/*"],"of":["lib-b"]},{"patterns":["{projectRoot}/docs/**/*"],"of":"self"},{"patterns":["{workspaceRoot}/notes/**/*"],"of":"self"}]'
    )
  })

  it('resolves differently when the entry keyed by the executor the project names changes', () => {
    const named = {
      ...library,
      configuration: { name: 'lib-a', targets: { test: { executor: '@fixture/tooling:test' } } },
    } as unknown as ProjectRecord
    const keyed: WorkspaceFile = { ...file, targetDefaults: { ...file.targetDefaults, '@fixture/tooling:test': { inputs: ['docs'] } } }
    expect({
      naming: targetResolution(keyed, named, 'test') === targetResolution(file, named, 'test'),
      silent: targetResolution(keyed, library, 'test') === targetResolution(file, library, 'test'),
    }).toEqual({ naming: false, silent: true })
  })

  it("leaves the defaults out where the project's own target is not the same target", () => {
    const other = {
      ...library,
      configuration: { name: 'lib-a', targets: { build: { executor: '@other:build' } } },
    } as unknown as ProjectRecord
    expect(targetResolution(file, other, 'build')).toContain('"defaults":null')
  })

  it('resolves a target the project does not configure from the defaults alone', () => {
    expect(targetResolution(file, library, 'lint')).toContain('"defaults":null,"byExecutor":null,"own":null')
  })

  it('resolves a project without a configuration from the defaults alone', () => {
    expect(targetResolution(file, { ...library, configuration: null } as unknown as ProjectRecord, 'build')).toContain('"own":null')
  })

  it('falls back to the implicit pair where neither names inputs', () => {
    expect(targetResolution({}, library, 'build')).toContain(
      '"inputs":[{"patterns":["{projectRoot}/**/*"],"of":"self"},{"patterns":["{projectRoot}/**/*"],"of":"dependencies"}]'
    )
  })
})
