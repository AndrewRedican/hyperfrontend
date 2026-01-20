const { scopes, types } = require('./tools/scripts/commitizen.js')

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', scopes],
    'type-enum': [2, 'always', types],
    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
    'header-max-length': [0, 'always'],
  },
}
