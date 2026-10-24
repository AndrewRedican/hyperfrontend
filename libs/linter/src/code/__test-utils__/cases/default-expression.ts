/**
 * The `default-expression.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/default-expression
 */

export const DEFAULT_EXPRESSION = {
  name: 'default-expression.ts',
  source: `export default a + b
`,
  tree: `Program 0-21 sourceType="module"
  ExportDefaultDeclaration 0-20 exportKind="value"
    BinaryExpression 15-20 operator="+"
      Identifier 15-16 name="a"
      Identifier 19-20 name="b"
`,
}
