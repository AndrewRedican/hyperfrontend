/**
 * The `default-async.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/default-async
 */

export const DEFAULT_ASYNC = {
  name: 'default-async.ts',
  source: `export default async function handler() {}
`,
  tree: `Program 0-43 sourceType="module"
  ExportDefaultDeclaration 0-42 exportKind="value"
    FunctionDeclaration 15-42 async=true
      Identifier 30-37 name="handler"
      BlockStatement 40-42
`,
}
