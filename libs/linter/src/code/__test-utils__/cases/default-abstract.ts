/**
 * The `default-abstract.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/default-abstract
 */

export const DEFAULT_ABSTRACT = {
  name: 'default-abstract.ts',
  source: `export default abstract class Shape {}
`,
  tree: `Program 0-39 sourceType="module"
  ExportDefaultDeclaration 0-38 exportKind="value"
    ClassDeclaration 15-38 abstract=true
      Identifier 30-35 name="Shape"
      ClassBody 36-38
`,
}
