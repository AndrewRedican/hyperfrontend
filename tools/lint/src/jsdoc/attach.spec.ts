import type { Node } from '../code/model.ts'
import type { RuleContext } from '../engine/rule.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../code/children.ts'
import { parseCode } from '../code/parse.ts'
import { DEFAULT_LANGUAGE } from '../config/model.ts'
import { lineMap } from '../text/lines.ts'
import { commentBefore, jsdocOf, reducedNode } from './attach.ts'

/**
 * The first node of a kind in a text, with the context linting the text.
 *
 * @param text - The text linted
 * @param kind - The kind looked for
 * @param extension - The file's extension
 * @returns The context and the node
 */
function find(text: string, kind: string, extension = '.ts'): [RuleContext<unknown, Node>, Node] {
  const parsed = parseCode(text, extension)
  const tree = parsed.tree as Node
  const context: RuleContext<unknown, Node> = {
    file: { path: `/w/a${extension}`, root: '/w', relativePath: `a${extension}`, text, lines: lineMap(text), comments: parsed.comments },
    tree,
    options: undefined,
    settings: {},
    language: DEFAULT_LANGUAGE,
    report: () => undefined,
  }
  const walk = (node: Node): Node | null => {
    if (node.kind === kind) return node
    for (const child of childrenOf(node)) {
      const found = walk(child)
      if (found !== null) return found
    }
    return null
  }
  return [context, walk(tree) as Node]
}

/**
 * The description of the block documenting the first node of a kind, or null.
 *
 * @param text - The text linted
 * @param kind - The kind looked for
 * @returns The description
 */
function described(text: string, kind: string): string | null {
  const [context, node] = find(text, kind)
  return jsdocOf(context, node)?.description ?? null
}

describe('jsdocOf', () => {
  it('finds the block before a function', () => {
    expect(described('/** Adds. */\nfunction f() {}\n', 'FunctionDeclaration')).toBe('Adds. ')
  })

  it('finds the block before the export of a declaration', () => {
    expect(described('/** Exported. */\nexport function f() {}\n', 'FunctionDeclaration')).toBe('Exported. ')
  })

  it('finds the block before the declaration of an arrow function', () => {
    expect(described('/** Arrow. */\nconst f = () => 1\n', 'ArrowFunctionExpression')).toBe('Arrow. ')
  })

  it('finds the block before the export of a declared arrow function', () => {
    expect(described('/** Both. */\nexport const f = () => 1\n', 'ArrowFunctionExpression')).toBe('Both. ')
  })

  it('finds the block right before a parenthesised expression', () => {
    expect(described('app.use(/** Handler. */ (req) => req)\n', 'ArrowFunctionExpression')).toBe('Handler. ')
  })

  it('finds no block for a function expression passed without a comment', () => {
    expect(described('/** Call. */\napp.use(function () {})\n', 'FunctionExpression')).toBeNull()
  })

  it('finds the block before a method', () => {
    expect(described('class C {\n  /** Method. */\n  m() {}\n}\n', 'FunctionExpression')).toBe('Method. ')
  })

  it('finds the block before a property value', () => {
    expect(described('const o = {\n  /** Prop. */\n  m: function () {},\n}\n', 'FunctionExpression')).toBe('Prop. ')
  })

  it('finds the block before a returned function', () => {
    expect(described('function make() {\n  /** Inner. */\n  return () => 1\n}\n', 'ArrowFunctionExpression')).toBe('Inner. ')
  })

  it('finds the block before a decorated class', () => {
    expect(described('/** Decorated. */\n@dec\nclass C {}\n', 'ClassDeclaration')).toBe('Decorated. ')
  })

  it('finds the block before a decorated method', () => {
    expect(described('class C {\n  /** Method. */\n  @dec\n  m() {}\n}\n', 'FunctionExpression')).toBe('Method. ')
  })

  it('finds a block past a line comment', () => {
    expect(described('/** Doc. */\n// note\nfunction f() {}\n', 'FunctionDeclaration')).toBe('Doc. ')
  })

  it('finds no block two lines away', () => {
    expect(described('/** Far. */\n\nfunction f() {}\n', 'FunctionDeclaration')).toBeNull()
  })

  it('finds no block in a plain block comment', () => {
    expect(described('/* Plain. */\nfunction f() {}\n', 'FunctionDeclaration')).toBeNull()
  })

  it('finds no block in a comment opened by three stars', () => {
    expect(described('/*** Three. */\nfunction f() {}\n', 'FunctionDeclaration')).toBeNull()
  })

  it('finds no block before a node with nothing before it', () => {
    expect(described('function f() {}\n', 'FunctionDeclaration')).toBeNull()
  })

  it('finds no block for an expression whose statement has none', () => {
    expect(described('const f = () => 1\n', 'ArrowFunctionExpression')).toBeNull()
  })

  it('finds no block for an expression nested with nothing documented up to the program', () => {
    expect(described('a[(() => 1)()]\n', 'ArrowFunctionExpression')).toBeNull()
  })

  it('finds the block right before an expression in parentheses', () => {
    expect(described('x = (/** Doc. */ () => 1)\n', 'ArrowFunctionExpression')).toBe('Doc. ')
  })

  it('finds no block for an invoked function expression', () => {
    expect(described('/** Top. */\nx = (function () {})()\n', 'FunctionExpression')).toBeNull()
  })

  it('finds the block before an object expression assigned to a variable', () => {
    expect(described('/** Object. */\nconst o = {}\n', 'ObjectExpression')).toBe('Object. ')
  })

  it('finds the block before a type alias', () => {
    expect(described('/** Alias. */\nexport type T = 1\n', 'TSTypeAliasDeclaration')).toBe('Alias. ')
  })

  it('finds no block for a function expression at the start of the file', () => {
    expect(described('(function () {}).call(x)\n', 'FunctionExpression')).toBeNull()
  })

  it('finds no block for an expression whose holders run out at the program', () => {
    expect(described('let x = 1\nif (() => 1) {}\n', 'ArrowFunctionExpression')).toBeNull()
  })

  it('finds no block for such an expression in a file opening with a comment', () => {
    expect(described('/** Lead. */\nlet x = 1\nif (() => 1) {}\n', 'ArrowFunctionExpression')).toBeNull()
  })

  it('finds the block before the parenthesis of an invoked arrow function', () => {
    expect(described('/** Call. */\n(() => 1)()\n', 'ArrowFunctionExpression')).toBe('Call. ')
  })

  it('parses a block once for a program', () => {
    const [context, node] = find('/** Once. */\nfunction f() {}\n', 'FunctionDeclaration')
    expect(jsdocOf(context, node)).toBe(jsdocOf(context, node))
  })

  it('accepts a comment opening on its own line', () => {
    expect(described('/**\n * Lines.\n */\nfunction f() {}\n', 'FunctionDeclaration')).toBe('Lines.')
  })
})

describe('reducedNode', () => {
  it('answers the node itself for a kind that is not reduced', () => {
    const [context, node] = find('const a = 1\n', 'VariableDeclaration')
    expect(reducedNode(context.file, context.tree, node)).toBe(node)
  })
})

describe('commentBefore', () => {
  it('honours a least distance', () => {
    const [context, node] = find('/** Near. */\nfunction f() {}\n', 'FunctionDeclaration')
    expect(commentBefore(context.file, context.tree, node, { minLines: 2, maxLines: 2 })).toBeNull()
  })
})
