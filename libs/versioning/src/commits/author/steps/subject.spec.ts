import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { Keys } from '@hyperfrontend/testing/process'
import { createTestConfig } from '../__test-utils__/base-config'
import { createMockTerminal } from '../__test-utils__/mock-terminal'
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
  it('completes the step on submit', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('h', 'i', '.', Keys.Enter)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('writes the normalized subject into the draft on submit', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('h', 'i', '.', Keys.Enter)
    await pending

    expect(ctx.draft.subject).toBe('hi')
    term.destroy()
  })

  it('returns cancelled on Ctrl-C', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys(Keys.CtrlC)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Cancelled })
    term.destroy()
  })

  it('omits the header budget from the prompt label when headerMaxLength is null', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ headerMaxLength: null, input: term.input, output: term.output }))

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('x', Keys.Enter)
    await pending

    expect(ctx.draft.subject).toBe('x')
    term.destroy()
  })

  it('completes the step for a subject pasted as a single chunk', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    // why: one chunk with many printable characters is a paste, not keystrokes
    await term.input.sendKeys('add resize support', Keys.Enter)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('accepts a subject pasted as a single multi-character chunk', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    // why: one chunk with many printable characters is a paste, not keystrokes
    await term.input.sendKeys('add resize support', Keys.Enter)
    await pending

    expect(ctx.draft.subject).toBe('add resize support')
    term.destroy()
  })

  it('completes the step after a bracketed paste and Enter', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'fix' }

    const pending = subjectStep.run(ctx)
    await term.input.paste('handle wide\nterminals')
    await term.input.sendKeys(Keys.Enter)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('collapses newlines in a bracketed paste into spaces without submitting', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'fix' }

    const pending = subjectStep.run(ctx)
    await term.input.paste('handle wide\nterminals')
    await term.input.sendKeys(Keys.Enter)
    await pending

    expect(ctx.draft.subject).toBe('handle wide terminals')
    term.destroy()
  })

  it('repaints the prompt when the terminal resizes mid-prompt', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('h')
    await flushPromises()
    await flushPromises()

    const before = term.output.text().length
    term.output.resize(40)
    await flushPromises()

    // why: the resize repaint re-renders the label and the preserved value
    expect(term.output.text().slice(before)).toContain('Subject')

    await term.input.sendKeys('i', Keys.Enter)
    await pending
    term.destroy()
  })

  it('completes the step after a mid-prompt resize', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('h')
    await flushPromises()
    await flushPromises()

    term.output.resize(40)
    await flushPromises()

    await term.input.sendKeys('i', Keys.Enter)
    const result = await pending

    expect(result).toEqual({ status: StepStatus.Done })
    term.destroy()
  })

  it('preserves the typed value across a mid-prompt resize', async () => {
    const term = createMockTerminal()
    const ctx = createSessionContext(createTestConfig({ input: term.input, output: term.output }))
    ctx.draft = { type: 'feat' }

    const pending = subjectStep.run(ctx)
    await term.input.sendKeys('h')
    await flushPromises()
    await flushPromises()

    term.output.resize(40)
    await flushPromises()

    await term.input.sendKeys('i', Keys.Enter)
    await pending

    expect(ctx.draft.subject).toBe('hi')
    term.destroy()
  })
})
