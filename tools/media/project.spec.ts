import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'

/** One target as the project file declares it, as far as these checks read it. */
interface Target {
  /** The executor that runs it. */
  executor?: string
  /** Whether Nx may replay a cached run instead of running it. */
  cache?: boolean
  /** Targets that run first. */
  dependsOn?: readonly unknown[]
  /** What the executor is handed. */
  options?: { command?: string }
}

/** The project file, as far as these checks read it. */
interface Project {
  /** Every target, by name. */
  targets: Record<string, Target>
}

const project = parse(readFileSync(resolve(fileURLToPath(import.meta.url), '../project.json'), 'utf8')) as Project

/** The targets that drive a browser or an encoder and write assets. */
const GENERATING = ['media', 'shot', 'preview']

describe('the recorder project', () => {
  it('generates media only through targets someone runs by hand', () => {
    expect(entries(project.targets).filter(([, target]) => target.options?.command?.includes('src/cli/main.ts') === true)).toEqual(
      expect.arrayContaining(GENERATING.map((name) => [name, expect.objectContaining({ executor: 'nx:run-commands', cache: false })]))
    )
  })

  it('has no build target for a package build to depend on', () => {
    expect(keys(project.targets).filter((name) => ['build', 'prebuild', 'prepack', 'publish'].includes(name))).toEqual([])
  })

  it('never runs a generating target because another target ran', () => {
    expect(entries(project.targets).filter(([, target]) => target.dependsOn !== undefined)).toEqual([])
  })

  it('never caches a generating run, because two runs of one scene differ', () => {
    expect(GENERATING.map((name) => [name, project.targets[name]?.cache])).toEqual(GENERATING.map((name) => [name, false]))
  })
})
