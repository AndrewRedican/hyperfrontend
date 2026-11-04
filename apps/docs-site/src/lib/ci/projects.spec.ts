import { describe, expect, it } from 'vitest'
import { T0, sampleRecord } from './__test-utils__/fixtures'
import { fromRecord } from './execution'
import { groupProjects, layoutChain, worstStatus } from './projects'

const execution = fromRecord(sampleRecord())

describe('layoutChain', () => {
  it('places a task one column right of its deepest need', () => {
    expect(layoutChain(execution.chains[0] as never).nodes.map((node) => [node.task.target, node.column, node.row])).toEqual([
      ['typecheck', 0, 0],
      ['build', 1, 0],
      ['publish', 2, 0],
    ])
  })

  it('draws the needs inside the chain, leaving out those another need implies', () => {
    expect(layoutChain(execution.chains[0] as never).edges).toEqual([
      { from: 'lib-a:typecheck', to: 'lib-a:build' },
      { from: 'lib-a:build', to: 'lib-a:publish' },
    ])
  })

  it('stacks independent tasks in one column', () => {
    expect(layoutChain(execution.chains[1] as never)).toEqual(expect.objectContaining({ columns: 1, rows: 2 }))
  })

  it('keeps needs on other chains aside', () => {
    const chain = execution.chains[0] as (typeof execution.chains)[number]
    const task = chain.tasks[2] as (typeof chain.tasks)[number]
    const altered = {
      ...chain,
      tasks: [chain.tasks[0], chain.tasks[1], { ...task, needs: [...task.needs, 'lib-x:publish'] }],
    } as typeof chain
    expect(layoutChain(altered).nodes[2]?.externalNeeds).toEqual(['lib-x:publish'])
  })
})

describe('groupProjects', () => {
  it('lists each project once with a lane per environment', () => {
    expect(groupProjects(execution).map((group) => [group.project, group.lanes.map((lane) => lane.environment)])).toEqual([
      ['lib-a', ['linux', 'windows']],
      ['lib-b', ['linux']],
    ])
  })

  it('counts the tasks of every lane together', () => {
    expect(groupProjects(execution)[0]).toEqual(
      expect.objectContaining({ total: 5, counts: expect.objectContaining({ success: 5 }), status: 'success' })
    )
  })

  it('spans the project from its first start to its last end', () => {
    expect(groupProjects(execution)[0]).toEqual(expect.objectContaining({ startedAt: T0, endedAt: T0 + 60_000 }))
  })

  it('names the tasks that need attention', () => {
    expect(groupProjects(execution)[1]?.attention.map((task) => task.id)).toEqual(['lib-b:lint'])
  })
})

describe('worstStatus', () => {
  it('picks the status that needs attention most', () => {
    expect(worstStatus(['success', 'running', 'cancelled'])).toBe('cancelled')
  })

  it('succeeds with nothing', () => {
    expect(worstStatus([])).toBe('success')
  })
})
