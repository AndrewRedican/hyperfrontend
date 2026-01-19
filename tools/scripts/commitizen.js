globalThis.defaultScope = JSON.parse(
  require('node:fs').readFileSync(
    require('node:path').resolve(__dirname, '../../package.json')
  )
).name;
globalThis.scopes = JSON.parse(
  require('node:child_process')
    .execSync('npx nx show projects --json')
    .toString()
)
  .sort()
  .map((s) => s.toLowerCase());
const { prompter, types } = require('cz-conventional-changelog');
module.exports = {
  scopes: globalThis.scopes,
  types,
  prompter
};