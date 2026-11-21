import { describe, expect, it } from '@hyperfrontend/testing'
import { checkHooks, checkLocalHooks, defineHooks, defineLocalHooks, stepNames } from './config'

/** A step that could run. */
const STEP = { name: 'lint', run: ['hf', 'affected', '-t', 'lint'] }

describe('checkHooks', () => {
  it('answers the configuration it was given', () => {
    const config = { 'pre-push': [{ ...STEP, env: { CI: '1' }, failText: 'no', stageFixed: false, passArgs: true }], push: [] }
    expect(checkHooks(config)).toBe(config)
  })

  it.each([
    ['nothing', null, 'the hooks are an object with a list of steps per hook'],
    ['a list', [], 'the hooks are an object with a list of steps per hook'],
    ['a text', 'pre-push', 'the hooks are an object with a list of steps per hook'],
    [
      'a hook it does not configure',
      { 'post-merge': [] },
      'post-merge is not a hook this configures; the hooks are pre-commit, commit-msg, pre-push, push',
    ],
    ['steps that are not a list', { 'pre-push': STEP }, 'pre-push takes a list of steps'],
    ['a step that is not an object', { 'pre-push': ['lint'] }, 'pre-push: every step needs a name'],
    ['a step without a name', { 'pre-push': [{ run: ['hf'] }] }, 'pre-push: every step needs a name'],
    ['a step whose name a skip could not spell', { 'pre-push': [{ ...STEP, name: 'a,b' }] }, 'pre-push: every step needs a name'],
    ['a field a step does not take', { 'pre-push': [{ ...STEP, parallel: true }] }, 'pre-push: step lint has no field parallel'],
    ['a step without a program', { 'pre-push': [{ name: 'lint' }] }, 'pre-push: step lint needs run'],
    ['a program written as a line', { 'pre-push': [{ ...STEP, run: 'hf lint' }] }, 'pre-push: step lint needs run'],
    ['an empty program', { 'pre-push': [{ ...STEP, run: [] }] }, 'pre-push: step lint needs run'],
    ['a program with no name', { 'pre-push': [{ ...STEP, run: [''] }] }, 'pre-push: step lint needs run'],
    [
      'variables that are not an object',
      { 'pre-push': [{ ...STEP, env: ['CI=1'] }] },
      'pre-push: step lint: env holds variables as strings',
    ],
    ['a variable that is not a text', { 'pre-push': [{ ...STEP, env: { CI: 1 } }] }, 'pre-push: step lint: env holds variables as strings'],
    ['a failure text that is not a text', { 'pre-push': [{ ...STEP, failText: 1 }] }, 'pre-push: step lint: failText is a string'],
    [
      'a stageFixed that is not a flag',
      { 'pre-push': [{ ...STEP, stageFixed: 'yes' }] },
      'pre-push: step lint: stageFixed is true or false',
    ],
    ['a passArgs that is not a flag', { 'pre-push': [{ ...STEP, passArgs: 1 }] }, 'pre-push: step lint: passArgs is true or false'],
    ['a name used twice in a hook', { 'pre-push': [STEP, STEP] }, 'pre-push names the step lint twice'],
  ])('refuses %s', (_, value, message) => {
    expect(() => checkHooks(value)).toThrow(message)
  })
})

describe('checkLocalHooks', () => {
  it('answers the preferences it was given', () => {
    const local = { skip: ['pipeline'] }
    expect(checkLocalHooks(local)).toBe(local)
  })

  it('takes a file that skips nothing', () => {
    expect(checkLocalHooks({})).toEqual({})
  })

  it.each([
    ['nothing', undefined, 'the local hooks are an object'],
    ['a skip that is not a list', { skip: 'pipeline' }, 'skip takes a list of step names'],
  ])('refuses %s', (_, value, message) => {
    expect(() => checkLocalHooks(value)).toThrow(message)
  })
})

describe('defineHooks', () => {
  it('answers the hooks it was given', () => {
    expect(defineHooks({ 'pre-commit': [STEP] })).toEqual({ 'pre-commit': [STEP] })
  })

  it('refuses hooks that could not run', () => {
    expect(() => defineHooks({ 'pre-commit': [{ name: 'lint', run: [] }] })).toThrow('needs run')
  })
})

describe('defineLocalHooks', () => {
  it('answers the preferences it was given', () => {
    expect(defineLocalHooks({ skip: ['lint'] })).toEqual({ skip: ['lint'] })
  })
})

describe('stepNames', () => {
  it('names every step plainly and by its hook', () => {
    expect([...stepNames({ 'pre-commit': [STEP], push: [{ name: 'version', run: ['hf'] }] })]).toEqual([
      'lint',
      'pre-commit:lint',
      'version',
      'push:version',
    ])
  })
})
