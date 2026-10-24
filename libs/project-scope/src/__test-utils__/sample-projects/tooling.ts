import type { FixtureTree } from './tree'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/** An environment file long enough to trip the size limits on displayed configuration. */
const LARGE_ENV = ['# Large configuration file', ...from({ length: 200 }, (_, line) => `CONFIG_LINE_${line}=value_${line}`)].join('\n')

/**
 * Projects that differ in their language and tooling setup: TypeScript and
 * JavaScript configuration, type systems, linters and test runners.
 */
export const TOOLING_FIXTURES: Readonly<Record<string, FixtureTree>> = {
  'typescript-strict': {
    'package.json': `{
  "name": "typescript-strict-project",
  "version": "1.0.0",
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
`,
    'tsconfig.build.json': `{
  "compilerOptions": {
    "outDir": "./dist"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "commonjs"
  }
}
`,
  },
  'tsconfig-extends': {
    'package.json': `{
  "name": "tsconfig-extends-test",
  "version": "1.0.0"
}
`,
    'tsconfig.base.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
`,
    'tsconfig.json': `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
`,
  },
  'invalid-tsconfig': {
    'package.json': `{
  "name": "invalid-tsconfig-project",
  "version": "1.0.0",
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "strict": true,
    // This is an invalid JSON comment that will cause parsing to fail
    "target": "ES2020"
  }
  // Missing closing brace
`,
  },
  'jsconfig-project': {
    'jsconfig.json': `{
  "compilerOptions": {
    "checkJs": true,
    "target": "ES2020"
  },
  "include": ["src/**/*"]
}
`,
    'package.json': `{
  "name": "jsconfig-project-test",
  "version": "1.0.0"
}
`,
    'src/utils.js': `/**
 * @template T
 * @param {T} value The input value
 * @returns {T} The same value
 */
function identity(value) {
  return value
}

module.exports = { identity }
`,
  },
  'jsdoc-project': {
    'package.json': `{
  "name": "jsdoc-project-test",
  "version": "1.0.0",
  "devDependencies": {
    "jsdoc": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
`,
    'src/index.js': `/**
 * @typedef {Object} User
 * @property {string} name - The user's name
 * @property {number} age - The user's age
 */

/**
 * @type {User}
 */
const user = { name: 'John', age: 30 }

/**
 * Add two numbers.
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b
}

module.exports = { user, add }
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "checkJs": true,
    "allowJs": true,
    "target": "ES2020"
  }
}
`,
  },
  'flow-project': {
    '.flowconfig': `[ignore]
.*/node_modules/.*

[include]

[libs]
flow-typed/

[options]
`,
    'flow-typed/lodash.js': `// @flow
declare module 'lodash' {
  declare function get(obj: any, path: string): any;
}
`,
    'package.json': `{
  "name": "flow-project-test",
  "version": "1.0.0",
  "devDependencies": {
    "flow-bin": "^0.220.0",
    "@babel/preset-flow": "^7.0.0"
  }
}
`,
    'src/index.js': `// @flow
export function hello(name: string): string {
  return \`Hello \${name}\`
}
`,
  },
  'vitest-project': {
    'package.json': `{
  "name": "vitest-project",
  "version": "1.0.0",
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
`,
    'vitest.config.ts': `export default {
  test: {},
}
`,
  },
  'biome-project': {
    'biome.json': `{
  "$schema": "https://biomejs.dev/schemas/1.5.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true
  }
}
`,
    'package.json': `{
  "name": "biome-project",
  "version": "1.0.0",
  "devDependencies": {
    "@biomejs/biome": "^1.5.0"
  }
}
`,
  },
  'biome-jsonc-project': {
    'biome.jsonc': `// Biome configuration with comments
{
  "organizeImports": {
    "enabled": true
  }
}
`,
    'package.json': `{
  "name": "biome-jsonc-project",
  "version": "1.0.0"
}
`,
  },
  'config-files': {
    '.env': `# Environment configuration
DATABASE_URL=postgres://localhost/db
API_KEY="secret-key-123"
DEBUG='true'

# Quoted values
EMPTY_VALUE=
SINGLE_QUOTED='single quoted value'
DOUBLE_QUOTED="double quoted value"
`,
    'config.cjs': `module.exports = { key: 'value' }
`,
    'config.ini': `# This is a comment
; Also a comment
globalKey=globalValue

[section1]
key1=value1
key2=value2

[section2]
enabled=true
count=42
`,
    'config.jsonc': `{
  // Single-line comment
  "name": "jsonc-config",
  /* Block comment */
  "version": "1.0.0",
  "settings": {
    // Nested comment
    "enabled": true,
    /* Another
       multi-line
       comment */
    "value": "test",
  },
}
`,
    'config.mjs': `export default { key: 'value' }
`,
    'config.toml': `[package]
name = "test-toml"
version = "1.0.0"
`,
    'config.txt': `plain text content
this is not structured
`,
    'config.yaml': `# YAML config with edge cases
name: test-project
version: 1.0.0
enabled: true
disabled: false
nullValue: null
integer: 42
negativeInt: -10
float: 3.14
negativeFloat: -2.5
quotedString: 'hello world'
singleQuoted: 'single'
`,
    'config.yml': `# Another YAML format with .yml extension
name: test-yml
version: 1.0.0
`,
    'invalid.json': `this is not valid json
{ broken
`,
  },
  'large-config': {
    '.env': LARGE_ENV,
    'package.json': `{"name": "large-config-test", "version": "1.0.0"}`,
  },
}
