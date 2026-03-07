const _fs = require('node:fs')
const _path = require('node:path')
const _cp = require('node:child_process')

/**
 * Reads all project.json files in the __fixtures__ directory and extracts the project names.
 * This is used to filter out fixture projects from the list of scopes when generating commit messages.
 *
 * @returns A Set of project names found in the fixture project.json files.
 */
function getFixtureProjectNames() {
  const fixturesDir = _path.resolve(__dirname, '../../libs/project-scope/__fixtures__')
  const projectJsonPaths = _cp.execSync(`find "${fixturesDir}" -name "project.json"`).toString().trim().split('\n').filter(Boolean)
  return new Set(
    projectJsonPaths
      .map((f) => {
        try {
          return JSON.parse(_fs.readFileSync(f, 'utf8')).name
        } catch {
          return null
        }
      })
      .filter(Boolean)
  )
}

const _fixtureProjects = getFixtureProjectNames()

globalThis.defaultScope = JSON.parse(_fs.readFileSync(_path.resolve(__dirname, '../../package.json'))).name
globalThis.scopes = JSON.parse(_cp.execSync('npx nx show projects --json').toString())
  .filter((s) => !_fixtureProjects.has(s))
  .sort()
  .map((s) => s.toLowerCase())
const { prompter, types } = require('cz-conventional-changelog')
module.exports = {
  scopes: globalThis.scopes,
  types,
  prompter,
}
