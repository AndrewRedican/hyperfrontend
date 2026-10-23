export default [
  { families: { fixture: { 'no-main': () => import('./no-main-rule') } } },
  { files: ['**/package.json'], rules: { 'fixture/no-main': 'warn' } },
]
