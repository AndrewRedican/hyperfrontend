/**
 * The workspace's own rule settings: where documentation comments are required, and the tag
 * constraints of the project graph.
 *
 * @module config/rule-sets
 */

/** Where documentation comments are required, as the workspace configured them. */
export const REQUIRE_JSDOC = {
  contexts: [
    'exported-function',
    'exported-default-function',
    'exported-class',
    'exported-default-class',
    'exported-arrow-variable',
    'exported-function-variable',
    'interface',
    'type-alias',
    'property-signature',
    'method-signature',
    'public-method',
    'public-method-signature',
    'public-property',
    'public-abstract-method',
    'public-abstract-property',
  ],
  checkConstructors: true,
  exemptEmptyConstructors: true,
  checkGetters: true,
  checkSetters: 'no-getter',
}

/** The tag rules of the libraries' dependency graph. */
export const DEPENDENCY_CONSTRAINTS = [
  { sourceTag: 'type:core', onlyDependOnLibsWithTags: [] },
  { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:integration'] },
  { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:feature'] },
  { sourceTag: 'type:protocol', onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:protocol', 'type:integration'] },
  { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:util'] },
  { sourceTag: 'type:integration', onlyDependOnLibsWithTags: ['type:core', 'type:util'] },
  { sourceTag: 'type:demo', onlyDependOnLibsWithTags: [] },
  { sourceTag: 'scope:standalone', onlyDependOnLibsWithTags: [] },
]
