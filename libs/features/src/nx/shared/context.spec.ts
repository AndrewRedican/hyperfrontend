import { resolveProjectCwd } from './context'

describe('resolveProjectCwd', () => {
  it('joins the workspace root with the project root', () => {
    expect(
      resolveProjectCwd({
        root: '/ws',
        projectName: 'lib-a',
        projectsConfigurations: { projects: { 'lib-a': { root: 'libs/a' } } },
      })
    ).toBe('/ws/libs/a')
  })

  it('throws when no project name is present', () => {
    expect(() => resolveProjectCwd({ root: '/ws' })).toThrow('An executing project name is required.')
  })

  it('throws when the project configuration is missing', () => {
    expect(() => resolveProjectCwd({ root: '/ws', projectName: 'lib-a', projectsConfigurations: { projects: {} } })).toThrow(
      'Could not find project configuration for lib-a.'
    )
  })
})
