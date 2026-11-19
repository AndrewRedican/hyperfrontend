import { describe, expect, it } from '@hyperfrontend/testing'
import { failureExcerpt, formatDuration, taskLogPath } from './log'

describe('formatDuration', () => {
  it.each([
    [800, '0.8s'],
    [47_000, '47s'],
    [1_097_000, '18m 17s'],
  ])('formats %d ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('taskLogPath', () => {
  it('names the log after the task, without the characters a file name cannot hold everywhere', () => {
    expect(taskLogPath('@scope/app:build:watch', '.hf/logs')).toBe('.hf/logs/__scope__app__build__watch.log')
  })
})

describe('failureExcerpt', () => {
  it('starts at the list of failing tests and stops at the coverage table', () => {
    const log = [
      '▶ suite',
      '  ✔ passes',
      '✖ failing tests:',
      '',
      '✖ breaks (1ms)',
      '  AssertionError',
      'file | line % | branch %',
      '---',
    ].join('\r\n')
    expect(failureExcerpt(log)).toBe('✖ failing tests:\n\n✖ breaks (1ms)\n  AssertionError')
  })

  it('keeps the last lines of any other output', () => {
    expect(failureExcerpt('one\ntwo\nthree\n', 2)).toBe('two\nthree')
  })

  it('keeps no more than the limit of a long list of failing tests', () => {
    expect(failureExcerpt('✖ failing tests:\na\nb\nc', 2)).toBe('✖ failing tests:\na')
  })

  it('answers null for a task that printed nothing', () => {
    expect(failureExcerpt(' \n')).toBeNull()
  })
})
