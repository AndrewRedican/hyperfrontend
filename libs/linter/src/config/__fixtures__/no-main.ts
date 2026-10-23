import rule from './no-main-rule'

export default [{ families: { fixture: { 'no-main': rule } } }, { files: ['**/package.json'], rules: { 'fixture/no-main': 'error' } }]
