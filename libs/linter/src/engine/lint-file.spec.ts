import type { EffectiveConfig } from '../config/model'
import type { JsonTreeNode } from '../languages/json'
import type { RuleModule } from './rule'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../config/model'
import { lintFile } from './lint-file'

/** Reports every `main` property, with a fix that drops its value. */
const NO_MAIN: RuleModule<unknown, JsonTreeNode> = {
  id: 'test/no-main',
  language: 'json',
  fixable: true,
  create: (context) => ({
    property(node) {
      if (node.kind === 'property' && node.key.value === 'main' && node.value.kind !== 'null') {
        context.report({
          start: node.start,
          end: node.end,
          message: 'No main',
          fix: { start: node.value.start, end: node.value.end, text: 'null' },
        })
      }
    },
  }),
}

/** Reports every number, with two suggestions. */
const NO_NUMBERS: RuleModule<unknown, JsonTreeNode> = {
  id: 'test/no-numbers',
  language: 'json',
  fixable: false,
  create: (context) => ({
    number(node) {
      context.report({
        start: node.start,
        end: node.end,
        message: `No ${context.file.text.slice(node.start, node.end)}`,
        suggestions: [
          { message: 'zero', fix: { start: node.start, end: node.end, text: '0' } },
          { message: 'one', fix: { start: node.start, end: node.end, text: '1' } },
        ],
      })
    },
  }),
}

/** A rule whose listener throws. */
const THROWS_IN_LISTENER: RuleModule<unknown, JsonTreeNode> = {
  id: 'test/throws-in-listener',
  language: 'json',
  fixable: false,
  create: () => ({
    document() {
      throw new Error('boom')
    },
  }),
}

/** A rule whose setup throws. */
const THROWS_IN_CREATE: RuleModule<unknown, JsonTreeNode> = {
  id: 'test/throws-in-create',
  language: 'json',
  fixable: false,
  create: () => {
    throw new Error('bang')
  },
}

/** A code rule, which never runs on JSON. */
const CODE_RULE: RuleModule<unknown, JsonTreeNode> = {
  id: 'test/code',
  language: 'code',
  fixable: false,
  create: () => ({ document: () => undefined }),
}

const config = (ids: readonly string[], severity: 1 | 2 = 2): EffectiveConfig => ({
  rules: createMap(ids.map((id) => [id, { severity, options: undefined }] as const)),
  settings: {},
  language: DEFAULT_LANGUAGE,
})
const rules = createMap<string, RuleModule>([
  ['test/no-main', NO_MAIN as RuleModule],
  ['test/no-numbers', NO_NUMBERS as RuleModule],
  ['test/code', CODE_RULE as RuleModule],
])
const input = (text: string, path = '/w/p/package.json'): Parameters<typeof lintFile>[0] => ({
  path,
  root: '/w/p',
  relativePath: 'package.json',
  text,
})

describe('lintFile', () => {
  it('answers nothing for a file of no known language', () => {
    expect(lintFile(input('x', '/w/p/a.png'), { config: config(['test/no-main']), rules, fix: false })).toEqual({
      messages: [],
      output: null,
    })
  })

  it('reports a parse failure as one fatal message', () => {
    expect(lintFile(input('{"a": }'), { config: config(['test/no-main']), rules, fix: false }).messages).toEqual([
      expect.objectContaining({
        ruleId: null,
        fatal: true,
        severity: 2,
        message: 'Parsing error: Unexpected character }',
        line: 1,
        column: 7,
      }),
    ])
  })

  it('reports what a rule reports, with positions', () => {
    expect(lintFile(input('{\n  "main": "x"\n}'), { config: config(['test/no-main']), rules, fix: false }).messages).toEqual([
      {
        ruleId: 'test/no-main',
        severity: 2,
        message: 'No main',
        line: 2,
        column: 3,
        endLine: 2,
        endColumn: 14,
        fatal: false,
        fix: { start: 12, end: 15, text: 'null' },
        suggestions: [],
      },
    ])
  })

  it('reports a problem without a range with null ends', () => {
    const pointed: RuleModule<unknown, JsonTreeNode> = {
      id: 'test/pointed',
      language: 'json',
      fixable: false,
      create: (context) => ({ document: () => context.report({ start: 0, message: 'Here' }) }),
    }
    expect(
      lintFile(input('{}'), { config: config(['test/pointed']), rules: createMap([['test/pointed', pointed as RuleModule]]), fix: false })
        .messages
    ).toEqual([expect.objectContaining({ line: 1, column: 1, endLine: null, endColumn: null })])
  })

  it('carries the configured severity', () => {
    expect(lintFile(input('{"main": 1}'), { config: config(['test/no-main'], 1), rules, fix: false }).messages[0]?.severity).toBe(1)
  })

  it('skips a rule of another language', () => {
    expect(lintFile(input('{"main": 1}'), { config: config(['test/code']), rules, fix: false }).messages).toEqual([])
  })

  it('skips a configured rule whose module is missing', () => {
    expect(lintFile(input('{"main": 1}'), { config: config(['test/unknown']), rules, fix: false }).messages).toEqual([])
  })

  it('orders the messages of several rules by position', () => {
    expect(
      lintFile(input('{"a": 2, "main": 1}'), { config: config(['test/no-main', 'test/no-numbers']), rules, fix: false }).messages.map(
        (message) => message.ruleId
      )
    ).toEqual(['test/no-numbers', 'test/no-main', 'test/no-numbers'])
  })

  it('reports suggestions without applying them', () => {
    expect(lintFile(input('[7]'), { config: config(['test/no-numbers']), rules, fix: true })).toMatchObject({
      messages: [{ message: 'No 7', suggestions: [{ message: 'zero' }, { message: 'one' }] }],
      output: null,
    })
  })

  it('drops a problem a directive suppresses', () => {
    expect(
      lintFile(input('{\n  // lint-disable-next-line test/no-main\n  "main": "x"\n}'), {
        config: config(['test/no-main']),
        rules,
        fix: false,
      }).messages
    ).toEqual([])
  })

  it('hands each listener the ancestors of its node', () => {
    const depths: number[] = []
    const ANCESTORS: RuleModule<unknown, JsonTreeNode> = {
      id: 'test/ancestors',
      language: 'json',
      fixable: false,
      create: () => ({ property: (_node, parents) => depths.push(parents.length) }),
    }
    lintFile(input('{"a": 1}'), { config: config([ANCESTORS.id]), rules: createMap([[ANCESTORS.id, ANCESTORS as RuleModule]]), fix: false })
    expect(depths).toEqual([2])
  })

  it('names the rule whose listener threw', () => {
    const throwing = createMap([[THROWS_IN_LISTENER.id, THROWS_IN_LISTENER as RuleModule]])
    expect(() => lintFile(input('{}'), { config: config([THROWS_IN_LISTENER.id]), rules: throwing, fix: false })).toThrow(
      'Rule test/throws-in-listener: boom'
    )
  })

  it('names the rule whose setup threw', () => {
    const throwing = createMap([[THROWS_IN_CREATE.id, THROWS_IN_CREATE as RuleModule]])
    expect(() => lintFile(input('{}'), { config: config([THROWS_IN_CREATE.id]), rules: throwing, fix: false })).toThrow(
      'Rule test/throws-in-create: bang'
    )
  })

  it('counts positions without a byte order mark', () => {
    expect(lintFile(input('\uFEFF{"main": "x"}'), { config: config(['test/no-main']), rules, fix: false }).messages[0]?.column).toBe(2)
  })

  it('keeps the byte order mark on fixed output', () => {
    expect(lintFile(input('\uFEFF{"main": "x"}'), { config: config(['test/no-main']), rules, fix: true }).output).toBe(
      '\uFEFF{"main": null}'
    )
  })

  it('keeps a problem a directive for another rule leaves', () => {
    expect(
      lintFile(input('{\n  // lint-disable-next-line no-var\n  "main": "x"\n}'), {
        config: config(['test/no-main']),
        rules,
        fix: false,
      }).messages.map((message) => message.message)
    ).toContain('No main')
  })

  it('applies a fix and reports what remains', () => {
    expect(
      lintFile(input('{"main": "x", "b": 2}'), { config: config(['test/no-main', 'test/no-numbers']), rules, fix: true })
    ).toMatchObject({
      messages: [{ ruleId: 'test/no-numbers', message: 'No 2' }],
      output: '{"main": null, "b": 2}',
    })
  })

  it('leaves the output null when fixing changes nothing', () => {
    expect(lintFile(input('{"b": 2}'), { config: config(['test/no-main']), rules, fix: true }).output).toBeNull()
  })

  it('stops after ten passes of a fix that keeps reporting', () => {
    const endless: RuleModule<unknown, JsonTreeNode> = {
      id: 'test/endless',
      language: 'json',
      fixable: true,
      create: (context) => ({
        number(node) {
          context.report({
            start: node.start,
            end: node.end,
            message: 'again',
            fix: { start: node.start, end: node.end, text: `${context.file.text.slice(node.start, node.end)}0` },
          })
        },
      }),
    }
    const outcome = lintFile(input('[1]'), {
      config: config(['test/endless']),
      rules: createMap([['test/endless', endless as RuleModule]]),
      fix: true,
    })
    expect({ messages: outcome.messages.length, output: outcome.output }).toEqual({ messages: 1, output: '[10000000000]' })
  })
})
