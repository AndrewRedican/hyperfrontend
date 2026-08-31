import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import type { RuleOptions } from './escape-package-tags'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTypeScriptRuleTester } from '../testing'
import rule, { DEFAULT_PREFIXES, findBarePackageTags, findBareTagsOnLine, findContentStart, measureSpecifier } from './escape-package-tags'

type TestOptions = readonly [RuleOptions?]
type MessageIds = 'unescapedPackageTag'

const ruleTester = createTypeScriptRuleTester()

const PREFIXES = ['@hyperfrontend']

describe('findContentStart', () => {
  it('skips indentation and the leading asterisk with its space', () => {
    expect(findContentStart('   * text')).toBe(5)
  })

  it('skips an asterisk that is not followed by a space', () => {
    expect(findContentStart(' *text')).toBe(2)
  })

  it('returns zero for a line with no indentation or asterisk', () => {
    expect(findContentStart('text')).toBe(0)
  })

  it('returns the length of a line that is only whitespace', () => {
    expect(findContentStart('   ')).toBe(3)
  })

  it('stops at the end of a line that ends with the asterisk', () => {
    expect(findContentStart(' *')).toBe(2)
  })

  it('treats a tab as indentation', () => {
    expect(findContentStart('\t* text')).toBe(3)
  })
})

describe('measureSpecifier', () => {
  it('measures a bare prefix that ends the line', () => {
    expect(measureSpecifier('@hyperfrontend', 0, '@hyperfrontend')).toBe(14)
  })

  it('measures a prefix followed by a package name', () => {
    expect(measureSpecifier('@hyperfrontend/nexus', 0, '@hyperfrontend')).toBe(20)
  })

  it('measures a prefix followed by a package name and sub-path', () => {
    expect(measureSpecifier('@hyperfrontend/versioning/git', 0, '@hyperfrontend')).toBe(29)
  })

  it('keeps a dot inside a sub-path', () => {
    expect(measureSpecifier('@hyperfrontend/clock.feature', 0, '@hyperfrontend')).toBe(28)
  })

  it('rejects a prefix that is only part of a longer word', () => {
    expect(measureSpecifier('@hyperfrontendish', 0, '@hyperfrontend')).toBe(-1)
  })

  it('rejects a prefix continued by a hyphen', () => {
    expect(measureSpecifier('@hyperfrontend-legacy', 0, '@hyperfrontend')).toBe(-1)
  })

  it('drops a trailing full stop', () => {
    expect(measureSpecifier('@hyperfrontend/nexus.', 0, '@hyperfrontend')).toBe(20)
  })

  it('drops a trailing slash', () => {
    expect(measureSpecifier('@hyperfrontend/', 0, '@hyperfrontend')).toBe(14)
  })

  it('stops at a colon', () => {
    expect(measureSpecifier('@hyperfrontend/package:rename', 0, '@hyperfrontend')).toBe(22)
  })

  it('stops at a closing parenthesis', () => {
    expect(measureSpecifier('@hyperfrontend/logging)', 0, '@hyperfrontend')).toBe(22)
  })

  it('measures a match that starts partway through the line', () => {
    expect(measureSpecifier('see @hyperfrontend/nexus now', 4, '@hyperfrontend')).toBe(24)
  })
})

describe('findBareTagsOnLine', () => {
  it('finds a reference that follows whitespace', () => {
    expect(findBareTagsOnLine(' * tests for @hyperfrontend/nexus', PREFIXES)).toEqual([
      { start: 13, end: 33, specifier: '@hyperfrontend/nexus' },
    ])
  })

  it('finds a reference that begins the line text', () => {
    expect(findBareTagsOnLine(' * @hyperfrontend/nexus is the broker', PREFIXES)).toEqual([
      { start: 3, end: 23, specifier: '@hyperfrontend/nexus' },
    ])
  })

  it('includes a backslash escape in the replaced range', () => {
    expect(findBareTagsOnLine(' * wraps \\@hyperfrontend/logging here', PREFIXES)).toEqual([
      { start: 9, end: 32, specifier: '@hyperfrontend/logging' },
    ])
  })

  it('ignores a reference already wrapped in backticks', () => {
    expect(findBareTagsOnLine(' * tests for `@hyperfrontend/nexus`', PREFIXES)).toEqual([])
  })

  it('ignores a reference embedded in quotes', () => {
    expect(findBareTagsOnLine(' * the "@hyperfrontend/features" feature', PREFIXES)).toEqual([])
  })

  it('ignores an at sign that is not a guarded prefix', () => {
    expect(findBareTagsOnLine(' * contact me @example please', PREFIXES)).toEqual([])
  })

  it('ignores a prefix that is only part of a longer word', () => {
    expect(findBareTagsOnLine(' * the @hyperfrontendish thing', PREFIXES)).toEqual([])
  })

  it('finds every reference on the line', () => {
    expect(findBareTagsOnLine(' * @hyperfrontend/a and @hyperfrontend/b', PREFIXES)).toEqual([
      { start: 3, end: 19, specifier: '@hyperfrontend/a' },
      { start: 24, end: 40, specifier: '@hyperfrontend/b' },
    ])
  })

  it('matches the first prefix that applies when several are configured', () => {
    expect(findBareTagsOnLine(' * wraps @nx/devkit', ['@hyperfrontend', '@nx'])).toEqual([{ start: 9, end: 19, specifier: '@nx/devkit' }])
  })

  it('returns nothing for a line without an at sign', () => {
    expect(findBareTagsOnLine(' * plain prose', PREFIXES)).toEqual([])
  })
})

describe('findBarePackageTags', () => {
  it('reports a reference in the description', () => {
    const value = '*\n * tests @hyperfrontend/nexus\n '
    const start = value.indexOf('@hyperfrontend')

    expect(findBarePackageTags(value, PREFIXES)).toEqual([
      { start, end: start + '@hyperfrontend/nexus'.length, specifier: '@hyperfrontend/nexus' },
    ])
  })

  it('stops scanning at the first genuine block tag', () => {
    expect(findBarePackageTags('*\n * intro\n * @module @hyperfrontend/nexus\n ', PREFIXES)).toEqual([])
  })

  it('reports a description line that opens with a guarded prefix', () => {
    expect(findBarePackageTags('*\n * @hyperfrontend/workspace - the plugin\n ', PREFIXES)).toEqual([
      { start: 5, end: 29, specifier: '@hyperfrontend/workspace' },
    ])
  })

  it('ignores references inside a fenced code block', () => {
    const value = '*\n * ```bash\n * nx add @hyperfrontend/package\n * ```\n * after @hyperfrontend/nexus\n '
    const start = value.lastIndexOf('@hyperfrontend')

    expect(findBarePackageTags(value, PREFIXES)).toEqual([
      { start, end: start + '@hyperfrontend/nexus'.length, specifier: '@hyperfrontend/nexus' },
    ])
  })

  it('reports references on several description lines', () => {
    const result = findBarePackageTags('*\n * @hyperfrontend/a\n * and @hyperfrontend/b\n ', PREFIXES)
    expect(result.map((tag) => tag.specifier)).toEqual(['@hyperfrontend/a', '@hyperfrontend/b'])
  })

  it('returns nothing for a description with no references', () => {
    expect(findBarePackageTags('*\n * plain prose\n ', PREFIXES)).toEqual([])
  })
})

describe('DEFAULT_PREFIXES', () => {
  it('guards the hyperfrontend scope', () => {
    expect(DEFAULT_PREFIXES).toEqual(['@hyperfrontend'])
  })
})

const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'accepts a reference wrapped in backticks',
    code: '/**\n * Tests for `@hyperfrontend/nexus`.\n */\nexport const a = 1',
  },
  {
    name: 'accepts a reference as the value of a block tag',
    code: '/**\n * The broker.\n *\n * @module @hyperfrontend/nexus\n */\nexport const a = 1',
  },
  {
    name: 'accepts a reference inside a fenced example',
    code: '/**\n * Adds the plugin.\n *\n * @example Install\n * ```bash\n * nx add @hyperfrontend/package\n * ```\n */\nexport const a = 1',
  },
  {
    name: 'accepts a quoted reference',
    code: '/**\n * Host integration for the "@hyperfrontend/features" feature.\n */\nexport const a = 1',
  },
  {
    name: 'ignores line comments',
    code: '// why: @hyperfrontend/nexus is fine here\nexport const a = 1',
  },
  {
    name: 'ignores non-JSDoc block comments',
    code: '/* @hyperfrontend/nexus */\nexport const a = 1',
  },
  {
    name: 'ignores a scope that is not configured',
    code: '/**\n * Wraps @nx/devkit here.\n */\nexport const a = 1',
    options: [{ prefixes: ['@hyperfrontend'] }],
  },
]

const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'wraps a bare reference in a description',
    code: '/**\n * ESM E2E tests for @hyperfrontend/versioning\n */\nexport const a = 1',
    output: '/**\n * ESM E2E tests for `@hyperfrontend/versioning`\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'replaces a backslash escape with backticks',
    code: '/**\n * Entry point for the \\@hyperfrontend/package Nx plugin.\n */\nexport const a = 1',
    output: '/**\n * Entry point for the `@hyperfrontend/package` Nx plugin.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'wraps a description line that opens with the scope',
    code: '/**\n * @hyperfrontend/workspace - Nx plugin for reports.\n */\nexport const a = 1',
    output: '/**\n * `@hyperfrontend/workspace` - Nx plugin for reports.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'wraps the whole specifier including the sub-path',
    code: '/**\n * Uses @hyperfrontend/versioning/git internally.\n */\nexport const a = 1',
    output: '/**\n * Uses `@hyperfrontend/versioning/git` internally.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'leaves trailing sentence punctuation outside the backticks',
    code: '/**\n * Driven by @hyperfrontend/builder.\n */\nexport const a = 1',
    output: '/**\n * Driven by `@hyperfrontend/builder`.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'wraps a bare scope with no package name',
    code: '/**\n * Everything in @hyperfrontend is scoped.\n */\nexport const a = 1',
    output: '/**\n * Everything in `@hyperfrontend` is scoped.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'wraps every reference on a line',
    code: '/**\n * Bridges @hyperfrontend/nexus and @hyperfrontend/features.\n */\nexport const a = 1',
    output: '/**\n * Bridges `@hyperfrontend/nexus` and `@hyperfrontend/features`.\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }, { messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'wraps references across several description lines',
    code: '/**\n * Reads @hyperfrontend/a\n * and writes @hyperfrontend/b\n */\nexport const a = 1',
    output: '/**\n * Reads `@hyperfrontend/a`\n * and writes `@hyperfrontend/b`\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag' }, { messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'honours a custom prefix list',
    code: '/**\n * Wraps @nx/devkit here.\n */\nexport const a = 1',
    output: '/**\n * Wraps `@nx/devkit` here.\n */\nexport const a = 1',
    options: [{ prefixes: ['@nx'] }],
    errors: [{ messageId: 'unescapedPackageTag' }],
  },
  {
    name: 'reports the specifier in the message',
    code: '/**\n * Tests for @hyperfrontend/nexus\n */\nexport const a = 1',
    output: '/**\n * Tests for `@hyperfrontend/nexus`\n */\nexport const a = 1',
    errors: [{ messageId: 'unescapedPackageTag', line: 2, column: 14 }],
  },
]

ruleTester.run('escape-package-tags', rule, {
  valid: validCases,
  invalid: invalidCases,
})
