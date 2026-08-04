import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal, TestKey } from '../__test-utils__/mock-terminal'
import { createSessionContext } from '../models/session-context'
import { StepStatus } from '../models/step'
import { normalizeSubject, subjectStep } from './subject'

describe('normalizeSubject', () => {
  it('strips a trailing period and trims edges', () => {
    expect(normalizeSubject('  add login.  ')).toBe('add login')
  })

  it('leaves internal periods intact', () => {
    expect(normalizeSubject('add v1.2 support')).toBe('add v1.2 support')
  })

  it('returns empty when input is whitespace-only', () => {
    expect(normalizeSubject('   ')).toBe('')
  })
})

describe('subjectStep', () => {
  it('writes the normalized subject into the draft on submit', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    term.input.enqueueKeys(['h', 'i', '.', TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.subject).toBe('hi')
    term.destroy()
  })

  it('returns cancelled on Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = subjectStep.run(ctx)
    term.input.enqueueKeys([TestKey.CtrlC])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('omits the header budget from the prompt label when headerMaxLength is null', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ headerMaxLength: null, input: term.input, output: term.output }))

    const pending = subjectStep.run(ctx)
    term.input.enqueueKeys(['x', TestKey.Enter])
    await pending

    expect(ctx.draft.subject).toBe('x')
    term.destroy()
  })

  it('accepts a subject pasted as a single multi-character chunk', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    // why: one chunk with many printable characters is a paste, not keystrokes
    term.input.enqueueKeys(['add resize support', TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.subject).toBe('add resize support')
    term.destroy()
  })

  it('collapses newlines in a bracketed paste into spaces without submitting', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'fix' }

    const pending = subjectStep.run(ctx)
    term.input.enqueuePaste('handle wide\nterminals')
    term.input.enqueueKeys([TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.subject).toBe('handle wide terminals')
    term.destroy()
  })

  it('repaints the prompt when the terminal resizes mid-prompt', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    term.input.enqueueKeys(['h'])
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    const before = term.output.getWrittenData().length
    term.output.resize(40)
    await new Promise((resolve) => setImmediate(resolve))

    // why: the resize repaint re-renders the label and the preserved value
    expect(term.output.getWrittenData().slice(before)).toContain('Subject')

    term.input.enqueueKeys(['i', TestKey.Enter])
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    expect(ctx.draft.subject).toBe('hi')
    term.destroy()
  })
})
