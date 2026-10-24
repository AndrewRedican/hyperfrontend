/**
 * The `esm.mjs` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/esm
 */

export const ESM = {
  name: 'esm.mjs',
  source: `import { readFileSync } from 'node:fs'
export const text = readFileSync('x', 'utf8')
await Promise.resolve()
`,
  tree: `Program 0-109 sourceType="module"
  ImportDeclaration 0-38 importKind="value"
    ImportSpecifier 9-21 importKind="value"
      Identifier 9-21 name="readFileSync"
      Identifier 9-21 name="readFileSync"
    Literal 29-38 raw="'node:fs'"
  ExportNamedDeclaration 39-84 exportKind="value"
    VariableDeclaration 46-84 kind=const
      VariableDeclarator 52-84
        Identifier 52-56 name="text"
        CallExpression 59-84
          Identifier 59-71 name="readFileSync"
          Literal 72-75 raw="'x'"
          Literal 77-83 raw="'utf8'"
  ExpressionStatement 85-108
    AwaitExpression 85-108
      CallExpression 91-108
        MemberExpression 91-106
          Identifier 91-98 name="Promise"
          Identifier 99-106 name="resolve"
`,
}
