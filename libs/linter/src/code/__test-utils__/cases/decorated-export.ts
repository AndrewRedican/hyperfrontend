/**
 * The `decorated-export.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/decorated-export
 */

export const DECORATED_EXPORT = {
  name: 'decorated-export.ts',
  source: `@sealed
export class Decorated {}
@sealed
class Plain {}
`,
  tree: `Program 0-57 sourceType="module"
  ExportNamedDeclaration 8-33 exportKind="value"
    ClassDeclaration 15-33
      Decorator 0-7
        Identifier 1-7 name="sealed"
      Identifier 21-30 name="Decorated"
      ClassBody 31-33
  ClassDeclaration 34-56
    Decorator 34-41
      Identifier 35-41 name="sealed"
    Identifier 48-53 name="Plain"
    ClassBody 54-56
`,
}
