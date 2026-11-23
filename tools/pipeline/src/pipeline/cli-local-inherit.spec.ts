import type { RunResults } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { gitIn, LIBRARIES, runPipeline } from './__test-utils__/command-line'

const fixture = useTempDir({ prefix: 'pipeline-local-inherit-', tree: LIBRARIES })

/**
 * Commits the fixture as the base of a branch, then changes both libraries in the working tree.
 *
 * @returns The base commit
 */
function branch(): string {
  gitIn(fixture.path, 'init', '-q', '-b', 'main')
  gitIn(fixture.path, 'add', '-A')
  gitIn(fixture.path, 'commit', '-q', '-m', 'base')
  fixture.write('libs/a/src/index.ts', 'export const a = 2\n')
  fixture.write('libs/b/src/index.ts', 'export const b = 2\n')
  return gitIn(fixture.path, 'rev-parse', 'HEAD')
}

/**
 * Runs the hook's pipeline over the branch.
 *
 * @param base - The base commit of the branch
 * @param flags - Flags after the usual ones
 * @param env - Environment entries of the run
 * @returns The lines of standard output that say what was inherited and which tasks ended how, trees and durations left out
 */
function push(base: string, flags: readonly string[] = [], env: Readonly<Record<string, string>> = {}): string[] {
  return runPipeline(fixture.path, ['run', '--local', '--base', base, '--environment', 'linux', ...flags], env)
    .stdout.split(/\r?\n/)
    .filter((line) => /^[✓✗] lib-|inherited|^Nothing to run/.test(line))
    .map((line) => line.replace(/ {2}\d[\dms. ]*s {2}\[.*$/, '').replace(/on tree [0-9a-f]{7}/, 'on tree <tree>'))
}

describe('pipeline run --local, a second time', () => {
  it('says on a first run that there is nothing to inherit from, and runs every task', () => {
    expect(push(branch())).toEqual([
      'nothing is inherited on linux: no earlier run left results that name the tree they stand on',
      '✓ lib-a:lint',
      '✓ lib-b:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })

  it('runs the tasks of the library changed since the last run and inherits the rest', () => {
    const base = branch()
    push(base)
    fixture.write('libs/a/src/index.ts', 'export const a = 3\n')
    expect(push(base)).toEqual([
      '2 tasks inherited from a local run on tree <tree>: nothing they read changed since',
      '✓ lib-a:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
    ])
  })

  it('runs nothing when nothing changed since a run that proved everything', () => {
    const base = branch()
    push(base)
    expect(push(base)).toEqual(['5 tasks inherited from a local run on tree <tree>: nothing they read changed since', 'Nothing to run.'])
  })

  it('inherits what a run a failed stage ended had proven, and runs the rest', () => {
    const base = branch()
    push(base, [], { FIXTURE_FAILS: 'lib-a:lint' })
    expect(push(base)).toEqual([
      '1 task inherited from a local run on tree <tree>: nothing it reads changed since',
      '✓ lib-a:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })

  it('hands an inherited outcome on with the run it first came from', () => {
    const base = branch()
    push(base)
    const first = fixture.readJson<RunResults>('.hf/pipeline/results-linux.json')
    fixture.write('libs/a/src/index.ts', 'export const a = 3\n')
    push(base)
    const second = fixture.readJson<RunResults>('.hf/pipeline/results-linux.json')
    expect(second.tasks.find((task) => task.id === 'lib-b:build')?.inherited).toEqual({
      run: null,
      attempt: null,
      sha: null,
      url: null,
      tree: first.tested?.tree,
      node: process.version,
      endedAt: first.tasks.find((task) => task.id === 'lib-b:build')?.endedAt,
    })
  })

  it('runs every task again under --no-inherit', () => {
    const base = branch()
    push(base)
    expect(push(base, ['--no-inherit'])).toEqual(['✓ lib-a:lint', '✓ lib-b:lint', '✓ lib-a:test', '✓ lib-a:build', '✓ lib-b:build'])
  })

  it('runs every task again under --main, since a plan that publishes inherits nothing', () => {
    const base = branch()
    push(base)
    expect(push(base, ['--main'])).toEqual(['✓ lib-a:lint', '✓ lib-b:lint', '✓ lib-a:test', '✓ lib-a:build', '✓ lib-b:build'])
  })

  it('runs every task again when HF_PIPELINE_INHERIT is 0', () => {
    const base = branch()
    push(base)
    expect(push(base, [], { HF_PIPELINE_INHERIT: '0' })).toEqual([
      '✓ lib-a:lint',
      '✓ lib-b:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })

  it("inherits nothing from results a plain run of a plan file left at the same path, whose tree is the plan's", () => {
    const base = branch()
    runPipeline(fixture.path, ['plan', '--base', base])
    runPipeline(fixture.path, ['run', '--environment', 'linux'])
    expect(push(base)).toEqual([
      'nothing is inherited on linux: no earlier run left results that name the tree they stand on',
      '✓ lib-a:lint',
      '✓ lib-b:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })

  it('runs every task when the results of the last run were cut short', () => {
    const base = branch()
    push(base)
    fixture.write('.hf/pipeline/results-linux.json', '{ "environment": "linux", "tasks": [')
    expect(push(base)).toEqual([
      'nothing is inherited on linux: no earlier run left results that name the tree they stand on',
      '✓ lib-a:lint',
      '✓ lib-b:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })

  it('runs every task again when the last run was on another Node.js release', () => {
    const base = branch()
    push(base)
    fixture.write('.hf/pipeline/results-linux.json', { ...fixture.readJson<RunResults>('.hf/pipeline/results-linux.json'), node: 'v0.0.1' })
    expect(push(base)).toEqual([
      `nothing is inherited on linux: its proofs are from Node.js v0.0.1 and this run is on ${process.version}`,
      '✓ lib-a:lint',
      '✓ lib-b:lint',
      '✓ lib-a:test',
      '✓ lib-a:build',
      '✓ lib-b:build',
    ])
  })
})
