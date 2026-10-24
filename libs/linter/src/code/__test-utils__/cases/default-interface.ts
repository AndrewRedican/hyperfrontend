/**
 * The `default-interface.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/default-interface
 */

export const DEFAULT_INTERFACE = {
  name: 'default-interface.ts',
  source: `export default interface Shape {
  sides: number
}
`,
  tree: `Program 0-51 sourceType="module"
  ExportDefaultDeclaration 0-50 exportKind="value"
    TSInterfaceDeclaration 15-50
      Identifier 25-30 name="Shape"
      TSInterfaceBody 31-50
        TSPropertySignature 35-48
          Identifier 35-40 name="sides"
          TSTypeAnnotation 40-48
            TSNumberKeyword 42-48
`,
}
