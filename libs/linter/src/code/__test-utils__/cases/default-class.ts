/**
 * The `default-class.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/default-class
 */

export const DEFAULT_CLASS = {
  name: 'default-class.ts',
  source: `@decorator
export default class {}
`,
  tree: `Program 0-35 sourceType="module"
  ExportDefaultDeclaration 11-34 exportKind="value"
    ClassDeclaration 26-34
      Decorator 0-10
        Identifier 1-10 name="decorator"
      ClassBody 32-34
`,
}
