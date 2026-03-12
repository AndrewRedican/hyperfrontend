import type { VersionFlow, CreateFlowOptions } from './flow'
import type { FlowStep } from './step'
import type { FlowConfig } from './types'
import {
  createFlow,
  addStep,
  removeStep,
  insertStep,
  insertStepAfter,
  insertStepBefore,
  replaceStep,
  withConfig,
  getStep,
  hasStep,
} from './flow'
import { createStep, createSuccessResult } from './step'

function createMockStep(id: string, name = `Step ${id}`): FlowStep {
  return createStep(id, name, async () => createSuccessResult('OK'))
}

function createTestFlow(stepIds: string[] = ['step-1', 'step-2', 'step-3']): VersionFlow {
  return createFlow(
    'test-flow',
    'Test Flow',
    stepIds.map((id) => createMockStep(id))
  )
}

// ============================================================================
// Tests
// ============================================================================

describe('Flow Model', () => {
  describe('createFlow', () => {
    it('creates a flow with required properties', () => {
      const steps = [createMockStep('step-1'), createMockStep('step-2')]
      const flow = createFlow('my-flow', 'My Flow', steps)

      expect(flow.id).toBe('my-flow')
      expect(flow.name).toBe('My Flow')
      expect(flow.steps).toHaveLength(2)
      expect(flow.steps[0].id).toBe('step-1')
      expect(flow.steps[1].id).toBe('step-2')
    })

    it('creates a flow with empty steps', () => {
      const flow = createFlow('empty', 'Empty Flow', [])

      expect(flow.id).toBe('empty')
      expect(flow.steps).toHaveLength(0)
    })

    it('creates a flow with description', () => {
      const flow = createFlow('my-flow', 'My Flow', [], {
        description: 'A custom versioning workflow',
      })

      expect(flow.description).toBe('A custom versioning workflow')
    })

    it('creates a flow with configuration', () => {
      const config: Partial<FlowConfig> = {
        dryRun: true,
        skipGit: true,
        tagFormat: 'v${version}',
      }
      const flow = createFlow('my-flow', 'My Flow', [], { config })

      expect(flow.config.dryRun).toBe(true)
      expect(flow.config.skipGit).toBe(true)
      expect(flow.config.tagFormat).toBe('v${version}')
    })

    it('creates a flow with default empty config', () => {
      const flow = createFlow('my-flow', 'My Flow', [])

      expect(flow.config).toBeDefined()
      expect(flow.config).toEqual({})
    })

    it('creates a flow with all options', () => {
      const options: CreateFlowOptions = {
        description: 'Full options test',
        config: {
          preset: 'conventional',
          skipChangelog: true,
        },
      }
      const flow = createFlow('full', 'Full Options Flow', [createMockStep('s1')], options)

      expect(flow.description).toBe('Full options test')
      expect(flow.config.preset).toBe('conventional')
      expect(flow.config.skipChangelog).toBe(true)
    })
  })

  describe('addStep', () => {
    it('adds a step to the end of a flow', () => {
      const flow = createTestFlow(['step-1', 'step-2'])
      const newStep = createMockStep('step-3')
      const modified = addStep(flow, newStep)

      expect(modified.steps).toHaveLength(3)
      expect(modified.steps[2].id).toBe('step-3')
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['step-1'])
      const newStep = createMockStep('step-2')
      const modified = addStep(flow, newStep)

      expect(modified).not.toBe(flow)
      expect(flow.steps).toHaveLength(1)
      expect(modified.steps).toHaveLength(2)
    })

    it('preserves other flow properties', () => {
      const flow = createFlow('my-flow', 'My Flow', [createMockStep('s1')], {
        description: 'Test',
        config: { dryRun: true },
      })
      const modified = addStep(flow, createMockStep('s2'))

      expect(modified.id).toBe('my-flow')
      expect(modified.name).toBe('My Flow')
      expect(modified.description).toBe('Test')
      expect(modified.config.dryRun).toBe(true)
    })

    it('allows adding multiple steps sequentially', () => {
      let flow = createTestFlow([])
      flow = addStep(flow, createMockStep('a'))
      flow = addStep(flow, createMockStep('b'))
      flow = addStep(flow, createMockStep('c'))

      expect(flow.steps).toHaveLength(3)
      expect(flow.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('removeStep', () => {
    it('removes a step by ID', () => {
      const flow = createTestFlow(['step-1', 'step-2', 'step-3'])
      const modified = removeStep(flow, 'step-2')

      expect(modified.steps).toHaveLength(2)
      expect(modified.steps.map((s) => s.id)).toEqual(['step-1', 'step-3'])
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['step-1', 'step-2'])
      const modified = removeStep(flow, 'step-1')

      expect(modified).not.toBe(flow)
      expect(flow.steps).toHaveLength(2)
      expect(modified.steps).toHaveLength(1)
    })

    it('returns same content if step not found', () => {
      const flow = createTestFlow(['step-1', 'step-2'])
      const modified = removeStep(flow, 'nonexistent')

      expect(modified.steps).toHaveLength(2)
      expect(modified.steps.map((s) => s.id)).toEqual(['step-1', 'step-2'])
    })

    it('removes first step', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const modified = removeStep(flow, 'a')

      expect(modified.steps.map((s) => s.id)).toEqual(['b', 'c'])
    })

    it('removes last step', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const modified = removeStep(flow, 'c')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b'])
    })
  })

  describe('insertStep', () => {
    it('inserts a step at the beginning (index 0)', () => {
      const flow = createTestFlow(['b', 'c'])
      const modified = insertStep(flow, createMockStep('a'), 0)

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('inserts a step in the middle', () => {
      const flow = createTestFlow(['a', 'c'])
      const modified = insertStep(flow, createMockStep('b'), 1)

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('inserts a step at the end', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStep(flow, createMockStep('c'), 2)

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStep(flow, createMockStep('c'), 1)

      expect(modified).not.toBe(flow)
      expect(flow.steps).toHaveLength(2)
      expect(modified.steps).toHaveLength(3)
    })

    it('handles inserting past the end', () => {
      const flow = createTestFlow(['a'])
      const modified = insertStep(flow, createMockStep('b'), 10)

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b'])
    })
  })

  describe('insertStepAfter', () => {
    it('inserts a step after a specific step', () => {
      const flow = createTestFlow(['a', 'c'])
      const modified = insertStepAfter(flow, createMockStep('b'), 'a')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('inserts after the last step', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStepAfter(flow, createMockStep('c'), 'b')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('appends to end if target step not found', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStepAfter(flow, createMockStep('c'), 'nonexistent')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStepAfter(flow, createMockStep('c'), 'a')

      expect(modified).not.toBe(flow)
      expect(flow.steps).toHaveLength(2)
    })

    it('inserts after first step', () => {
      const flow = createTestFlow(['a', 'd'])
      const modified = insertStepAfter(flow, createMockStep('b'), 'a')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'd'])
    })
  })

  describe('insertStepBefore', () => {
    it('inserts a step before a specific step', () => {
      const flow = createTestFlow(['a', 'c'])
      const modified = insertStepBefore(flow, createMockStep('b'), 'c')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('inserts before the first step', () => {
      const flow = createTestFlow(['b', 'c'])
      const modified = insertStepBefore(flow, createMockStep('a'), 'b')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('prepends to beginning if target step not found', () => {
      const flow = createTestFlow(['b', 'c'])
      const modified = insertStepBefore(flow, createMockStep('a'), 'nonexistent')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = insertStepBefore(flow, createMockStep('x'), 'a')

      expect(modified).not.toBe(flow)
      expect(flow.steps).toHaveLength(2)
    })

    it('inserts before last step', () => {
      const flow = createTestFlow(['a', 'c'])
      const modified = insertStepBefore(flow, createMockStep('b'), 'c')

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('replaceStep', () => {
    it('replaces a step by ID', () => {
      const flow = createTestFlow(['a', 'old', 'c'])
      const modified = replaceStep(flow, 'old', createMockStep('new', 'New Step'))

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'new', 'c'])
      expect(modified.steps[1].name).toBe('New Step')
    })

    it('returns unchanged flow if step not found', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const modified = replaceStep(flow, 'nonexistent', createMockStep('x'))

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow(['a', 'b'])
      const modified = replaceStep(flow, 'a', createMockStep('x'))

      expect(modified).not.toBe(flow)
    })

    it('replaces first step', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const modified = replaceStep(flow, 'a', createMockStep('x'))

      expect(modified.steps.map((s) => s.id)).toEqual(['x', 'b', 'c'])
    })

    it('replaces last step', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const modified = replaceStep(flow, 'c', createMockStep('x'))

      expect(modified.steps.map((s) => s.id)).toEqual(['a', 'b', 'x'])
    })
  })

  describe('withConfig', () => {
    it('merges configuration into flow', () => {
      const flow = createFlow('test', 'Test', [], { config: { preset: 'conventional' } })
      const modified = withConfig(flow, { dryRun: true })

      expect(modified.config.preset).toBe('conventional')
      expect(modified.config.dryRun).toBe(true)
    })

    it('overrides existing config values', () => {
      const flow = createFlow('test', 'Test', [], { config: { dryRun: false } })
      const modified = withConfig(flow, { dryRun: true })

      expect(modified.config.dryRun).toBe(true)
    })

    it('returns a new flow (immutable)', () => {
      const flow = createTestFlow()
      const modified = withConfig(flow, { skipGit: true })

      expect(modified).not.toBe(flow)
      expect(flow.config.skipGit).toBeUndefined()
    })

    it('applies multiple config updates', () => {
      let flow = createTestFlow()
      flow = withConfig(flow, { dryRun: true })
      flow = withConfig(flow, { skipTag: true })
      flow = withConfig(flow, { skipChangelog: true })

      expect(flow.config.dryRun).toBe(true)
      expect(flow.config.skipTag).toBe(true)
      expect(flow.config.skipChangelog).toBe(true)
    })

    it('preserves existing config when adding new values', () => {
      const flow = createFlow('test', 'Test', [], {
        config: { preset: 'independent', tagFormat: '${name}@v${version}' },
      })
      const modified = withConfig(flow, { dryRun: true })

      expect(modified.config.preset).toBe('independent')
      expect(modified.config.tagFormat).toBe('${name}@v${version}')
      expect(modified.config.dryRun).toBe(true)
    })
  })

  describe('getStep', () => {
    it('returns a step by ID', () => {
      const flow = createTestFlow(['step-1', 'step-2', 'step-3'])
      const step = getStep(flow, 'step-2')

      expect(step).toBeDefined()
      expect(step?.id).toBe('step-2')
    })

    it('returns undefined if step not found', () => {
      const flow = createTestFlow(['a', 'b', 'c'])
      const step = getStep(flow, 'nonexistent')

      expect(step).toBeUndefined()
    })

    it('gets the first step', () => {
      const flow = createTestFlow(['first', 'second', 'third'])
      const step = getStep(flow, 'first')

      expect(step?.id).toBe('first')
    })

    it('gets the last step', () => {
      const flow = createTestFlow(['first', 'second', 'last'])
      const step = getStep(flow, 'last')

      expect(step?.id).toBe('last')
    })

    it('returns undefined for empty flow', () => {
      const flow = createFlow('empty', 'Empty', [])
      const step = getStep(flow, 'any')

      expect(step).toBeUndefined()
    })
  })

  describe('hasStep', () => {
    it('returns true if step exists', () => {
      const flow = createTestFlow(['a', 'b', 'c'])

      expect(hasStep(flow, 'a')).toBe(true)
      expect(hasStep(flow, 'b')).toBe(true)
      expect(hasStep(flow, 'c')).toBe(true)
    })

    it('returns false if step does not exist', () => {
      const flow = createTestFlow(['a', 'b', 'c'])

      expect(hasStep(flow, 'x')).toBe(false)
      expect(hasStep(flow, 'nonexistent')).toBe(false)
    })

    it('returns false for empty flow', () => {
      const flow = createFlow('empty', 'Empty', [])

      expect(hasStep(flow, 'any')).toBe(false)
    })

    it('is case sensitive', () => {
      const flow = createTestFlow(['Step-A'])

      expect(hasStep(flow, 'Step-A')).toBe(true)
      expect(hasStep(flow, 'step-a')).toBe(false)
      expect(hasStep(flow, 'STEP-A')).toBe(false)
    })
  })

  describe('combined operations', () => {
    it('supports method chaining pattern', () => {
      let flow = createFlow('custom', 'Custom Flow', [])

      // Build up a flow using multiple operations
      flow = addStep(flow, createMockStep('fetch'))
      flow = addStep(flow, createMockStep('analyze'))
      flow = addStep(flow, createMockStep('bump'))
      flow = insertStepAfter(flow, createMockStep('validate'), 'analyze')
      flow = withConfig(flow, { dryRun: true })

      expect(flow.steps.map((s) => s.id)).toEqual(['fetch', 'analyze', 'validate', 'bump'])
      expect(flow.config.dryRun).toBe(true)
    })

    it('supports removing and re-adding steps', () => {
      let flow = createTestFlow(['a', 'b', 'c'])
      flow = removeStep(flow, 'b')
      flow = insertStep(flow, createMockStep('b-new', 'B New'), 1)

      expect(flow.steps.map((s) => s.id)).toEqual(['a', 'b-new', 'c'])
      expect(flow.steps[1].name).toBe('B New')
    })

    it('supports replacing and configuring', () => {
      let flow = createFlow('test', 'Test', [createMockStep('old')], {
        config: { preset: 'conventional' },
      })
      flow = replaceStep(flow, 'old', createMockStep('new'))
      flow = withConfig(flow, { skipGit: true })

      expect(flow.steps[0].id).toBe('new')
      expect(flow.config.preset).toBe('conventional')
      expect(flow.config.skipGit).toBe(true)
    })
  })
})
