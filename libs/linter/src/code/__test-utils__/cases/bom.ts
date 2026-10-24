/**
 * The `bom.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/bom
 */

export const BOM = {
  name: 'bom.ts',
  source: `\ufeffconst bom = 1
`,
  tree: `Program 1-15 sourceType="module"
  VariableDeclaration 1-14 kind=const
    VariableDeclarator 7-14
      Identifier 7-10 name="bom"
      Literal 13-14 raw="1"
`,
}
