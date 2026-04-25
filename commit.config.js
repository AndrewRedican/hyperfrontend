/**
 * Dogfood configuration for `cz` (interactive commit author) and `cl`
 * (commit-msg validator), both shipped by `@hyperfrontend/versioning`.
 *
 * @see libs/versioning/src/commits/author/models/session-config.ts
 * @see libs/versioning/src/commits/validate/models/ruleset.ts
 * @type {import('@hyperfrontend/versioning/commits/author').PartialSessionConfig}
 */
module.exports = {
  types: [
    { name: 'feat', description: 'A new feature' },
    { name: 'fix', description: 'A bug fix' },
    { name: 'docs', description: 'Documentation only changes' },
    { name: 'style', description: 'Changes that do not affect code meaning (whitespace, formatting)' },
    { name: 'refactor', description: 'A code change that neither fixes a bug nor adds a feature' },
    { name: 'perf', description: 'A code change that improves performance' },
    { name: 'test', description: 'Adding missing tests or correcting existing tests' },
    { name: 'build', description: 'Changes that affect the build system or external dependencies' },
    { name: 'ci', description: 'Changes to CI configuration files and scripts' },
    { name: 'chore', description: 'Other changes that do not modify src or test files' },
    { name: 'revert', description: 'Reverts a previous commit' },
  ],

  scopeOptional: false,
  scopeMulti: false,
  scopeFilter: ({ path }) => !path.includes('/libs/project-scope/__fixtures__/'),

  headerMaxLength: 72,

  validateRuleset: {
    'type-enum': ['error', { types: ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'] }],
    'subject-empty': ['error'],
    'subject-case': ['off'],
    'header-max-length': ['warn', { maxLength: 72 }],
    'imperative-mood': ['warn'],
  },
}
