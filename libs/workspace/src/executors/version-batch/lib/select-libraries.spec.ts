import { describe, expect, it } from '@hyperfrontend/testing'
import { selectLibraries } from './select-libraries'

const isVersionable = (project: string): boolean => project.startsWith('lib-')

describe('selectLibraries', () => {
  it('versions the affected libraries when nothing is forced', () => {
    expect(selectLibraries(undefined, undefined, ['lib-a', 'lib-b'], isVersionable)).toEqual({ ok: true, libraries: ['lib-a', 'lib-b'] })
  })

  it('refuses a forced bump that names no libraries', () => {
    expect([selectLibraries(undefined, 'patch', ['lib-a'], isVersionable), selectLibraries([], 'patch', ['lib-a'], isVersionable)]).toEqual(
      [
        { ok: false, reason: expect.stringContaining('names the libraries it applies to') },
        { ok: false, reason: expect.stringContaining('names the libraries it applies to') },
      ]
    )
  })

  it('refuses named libraries without a forced bump', () => {
    expect(selectLibraries(['lib-a'], undefined, [], isVersionable)).toEqual({
      ok: false,
      reason: expect.stringContaining('only meaningful with --releaseAs'),
    })
  })

  it('refuses a name that is not a versionable project', () => {
    expect(selectLibraries(['lib-a', 'docs-site', 'tool-x'], 'patch', [], isVersionable)).toEqual({
      ok: false,
      reason: 'Not versionable: docs-site, tool-x. Name projects that declare a version target.',
    })
  })

  it('versions the named libraries, once each and in order, ignoring affected detection', () => {
    expect(selectLibraries(['lib-b', 'lib-a', 'lib-b'], 'patch', ['lib-c'], isVersionable)).toEqual({
      ok: true,
      libraries: ['lib-a', 'lib-b'],
    })
  })
})
