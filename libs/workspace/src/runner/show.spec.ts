import type { ProjectRecord } from '../graph/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { showProjects } from './show'

/** Two projects, one with a build target. */
const PROJECTS = [
  { name: 'lib-b', configuration: { targets: { build: {} } } },
  { name: 'lib-a', configuration: { targets: {} } },
] as unknown as ProjectRecord[]

describe('showProjects', () => {
  it('lists every project, sorted', () => {
    expect(showProjects(['projects'], PROJECTS)).toBe('lib-a\nlib-b')
  })

  it('lists the projects with a target as JSON', () => {
    expect(showProjects(['projects', '--with-target=build', '--json'], PROJECTS)).toBe('["lib-b"]')
  })

  it('refuses another subject', () => {
    expect(() => showProjects(['targets'], PROJECTS)).toThrow('hf show lists projects alone, got targets')
  })

  it('refuses no subject', () => {
    expect(() => showProjects([], PROJECTS)).toThrow('hf show lists projects alone, got nothing')
  })

  it('refuses an unknown argument', () => {
    expect(() => showProjects(['projects', '--all'], PROJECTS)).toThrow('unknown argument --all')
  })
})
