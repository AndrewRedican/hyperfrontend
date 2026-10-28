import type { Node } from '../code/model'
import type { LanguageSettings } from '../config/model'
import type { RuleContext } from '../engine/rule'
import { extname } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../code/parse'
import { DEFAULT_LANGUAGE } from '../config/model'
import { ANALYSIS_CASES } from './__test-utils__/analysis-cases'
import { dumpScopes } from './__test-utils__/dump'
import { analyzeScopes, findVariable, scopeAnalysisOf, scopeOf } from './analysis'

/** One fixture: a recorded source and how it is read. */
interface Fixture {
  /** Which fixture to read. */
  readonly file: keyof typeof ANALYSIS_CASES
  /** How it is read, where it differs from the default. */
  readonly language?: Partial<LanguageSettings>
}

const FIXTURE_FILES: readonly Fixture[] = [
  { file: 'values.ts' },
  { file: 'declarations.ts' },
  { file: 'types.ts' },
  { file: 'export-assignment.ts' },
  { file: 'export-expression.ts' },
  { file: 'default-class.ts' },
  { file: 'elements.tsx' },
  { file: 'pragma.tsx', language: { jsxPragma: 'h', jsxFragmentName: 'Frag' } },
  { file: 'no-pragma.tsx', language: { jsxPragma: null } },
  { file: 'undeclared-pragma.tsx', language: { jsxPragma: 'h', jsxFragmentName: 'Frag' } },
  { file: 'script.ts', language: { sourceType: 'script' } },
  { file: 'strict-script.ts', language: { sourceType: 'script' } },
  { file: 'commonjs.cjs', language: { sourceType: 'commonjs' } },
]

/**
 * Parses a fixture's text as a program.
 *
 * @param file - Which fixture to read
 * @param language - How it is read
 * @returns The program's tree
 */
function program(file: keyof typeof ANALYSIS_CASES, language: LanguageSettings): Node {
  return parseCode(ANALYSIS_CASES[file].source, extname(file), language.sourceType).tree as Node
}

describe('analyzeScopes', () => {
  for (const fixture of FIXTURE_FILES) {
    it(`analyses ${fixture.file} as the reference scope manager does`, () => {
      const language = { ...DEFAULT_LANGUAGE, ...fixture.language }
      // why: the recorded dumps were written through a console, which drops the trailing space of a line listing nothing.
      const expected = ANALYSIS_CASES[fixture.file].scopes
        .trimEnd()
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
      const actual = dumpScopes(analyzeScopes(program(fixture.file, language), language)).map((line) => line.trimEnd())
      expect(actual.join('\n')).toBe(expected.join('\n'))
    })
  }

  it('declares the configured globals in the global scope, writable as configured', () => {
    const language = { ...DEFAULT_LANGUAGE, globals: { window: 'readonly' as const, onload: 'writable' as const } }
    const { global } = analyzeScopes(parseCode('window.x = 1\n', '.ts').tree as Node, language)
    expect([global.set.get('window')?.writable, global.set.get('onload')?.writable, global.set.get('Object')?.writable]).toEqual([
      false,
      true,
      false,
    ])
  })

  it('resolves a write to a configured global', () => {
    const language = { ...DEFAULT_LANGUAGE, globals: { counter: 'writable' as const } }
    const { global } = analyzeScopes(parseCode('counter = 1\n', '.ts').tree as Node, language)
    expect(global.set.get('counter')?.references.map((ref) => [ref.isWrite(), ref.init])).toEqual([[true, false]])
  })

  it('lists the variables a declaration declares', () => {
    const tree = parseCode('const { a, b: [c] } = o\nfunction f(p) {}\n', '.ts').tree as Node
    const analysis = analyzeScopes(tree, DEFAULT_LANGUAGE)
    const [declaration, fn] = tree.body as Node[]
    expect([
      analysis.declaredVariables(declaration as Node).map((v) => v.name),
      analysis.declaredVariables(fn as Node).map((v) => v.name),
    ]).toEqual([
      ['a', 'c'],
      ['f', 'p'],
    ])
  })

  it('answers the global scope for a node outside any tree', () => {
    const analysis = analyzeScopes(parseCode('a\n', '.ts').tree as Node, DEFAULT_LANGUAGE)
    expect(scopeOf(analysis, { kind: 'Identifier', start: 0, end: 0, parent: null }).kind).toBe('global')
  })

  it('declares nothing for a node that declares nothing', () => {
    const tree = parseCode('a\n', '.ts').tree as Node
    expect(analyzeScopes(tree, DEFAULT_LANGUAGE).declaredVariables(tree)).toEqual([])
  })
})

describe('scopeAnalysisOf', () => {
  const context = (tree: Node): RuleContext<unknown, Node> => ({
    file: { path: '/w/a.ts', root: '/w', relativePath: 'a.ts', text: '', lines: { starts: [0], text: '' }, comments: [] },
    tree,
    options: undefined,
    settings: {},
    language: DEFAULT_LANGUAGE,
    report: () => undefined,
  })

  it('builds the analysis once per program', () => {
    const tree = parseCode('const a = 1\n', '.ts').tree as Node
    expect(scopeAnalysisOf(context(tree))).toBe(scopeAnalysisOf(context(tree)))
  })

  it('builds a separate analysis for another program', () => {
    const first = parseCode('const a = 1\n', '.ts').tree as Node
    const second = parseCode('const a = 1\n', '.ts').tree as Node
    expect(scopeAnalysisOf(context(first))).not.toBe(scopeAnalysisOf(context(second)))
  })
})

describe('scopeOf', () => {
  const tree = parseCode('const f = function g() { return 1 }\nclass C { m() {} }\n', '.ts').tree as Node
  const analysis = analyzeScopes(tree, DEFAULT_LANGUAGE)

  it('answers the global scope for the program', () => {
    expect(scopeOf(analysis, tree).kind).toBe('global')
  })

  it('answers the module scope for a top-level statement', () => {
    expect(scopeOf(analysis, (tree.body as Node[])[0] as Node).kind).toBe('module')
  })

  it('answers the function scope, not the name scope, for a named function expression', () => {
    const declarator = ((tree.body as Node[])[0] as Node).declarations?.[0] as Node
    expect(scopeOf(analysis, declarator.init as Node).kind).toBe('function')
  })

  it('answers the innermost scope for a node inside a method', () => {
    const method = (((tree.body as Node[])[1] as Node).body as Node).body as Node[]
    expect(scopeOf(analysis, ((method[0] as Node).value as Node).body as Node).kind).toBe('function')
  })
})

describe('findVariable', () => {
  const tree = parseCode('const a = 1\nfunction f() { return a }\n', '.ts').tree as Node
  const analysis = analyzeScopes(tree, DEFAULT_LANGUAGE)
  const inner = analysis.scopes[analysis.scopes.length - 1]

  it('finds a variable declared in an enclosing scope', () => {
    expect(findVariable(inner as never, 'a')?.name).toBe('a')
  })

  it('answers null for a name no scope in reach declares', () => {
    expect(findVariable(inner as never, 'b')).toBeNull()
  })
})

describe('analyzeScopes on a script of many unresolved references', () => {
  it('leaves more references through the global scope than one call accepts as arguments', () => {
    const language = { ...DEFAULT_LANGUAGE, sourceType: 'script' as const }
    const tree = parseCode('g();'.repeat(200000), '.js', 'script').tree as Node
    expect(analyzeScopes(tree, language).global.through).toHaveLength(200000)
  })
})
