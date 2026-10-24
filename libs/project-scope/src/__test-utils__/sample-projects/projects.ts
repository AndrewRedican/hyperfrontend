import type { FixtureTree } from './tree'

/**
 * Standalone projects: one package each, varying in which markers, manifests and
 * configuration files they carry.
 */
export const PROJECT_FIXTURES: Readonly<Record<string, FixtureTree>> = {
  'minimal-project': {
    '.gitkeep': `# Minimal test fixture - placeholder
`,
    'package.json': `{
  "name": "minimal-test-project",
  "version": "1.0.0",
  "description": "A minimal test project",
  "main": "src/main.js",
  "scripts": {
    "test": "jest",
    "build": "tsc"
  },
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
`,
    'src/index.ts': `export * from './main'
export * from './utils'
`,
    'src/main.ts': `export const hello = 'world'
`,
    'src/utils.ts': `/**
 * Add two numbers together.
 *
 * @param a - First operand
 * @param b - Second operand
 * @returns Sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
`,
  },
  'bare-package': {
    'package.json': `{
  "name": "bare-package",
  "version": "1.0.0",
  "description": "Package without source files or entry points"
}
`,
  },
  'entry-file-only': {
    'index.ts': `export const main = () => {}
`,
    'package.json': `{
  "name": "entry-file-only",
  "version": "1.0.0"
}
`,
  },
  'no-markers-project': {
    'package.json': `{
  "name": "no-markers-project",
  "version": "1.0.0"
}
`,
    'src/index.ts': `export const hello = 'world'
`,
  },
  'no-src-project': {
    'app.ts': `import { main } from './index'
console.log(main())
`,
    'index.ts': `export function main() {
  return 'hello'
}
`,
    'package.json': `{
  "name": "no-src-project",
  "version": "1.0.0"
}
`,
  },
  'project-json-only': {
    'package.json': `{
  "name": "project-json-only",
  "version": "1.0.0"
}
`,
    'project.json': `{
  "name": "project-json-only"
}
`,
  },
  'cli-tool': {
    'bin/cli.js': `#!/usr/bin/env node
console.log('CLI tool')
`,
    'package.json': `{
  "name": "@scope/my-cli-tool",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./bin/cli.js"
  },
  "description": "A CLI tool test fixture"
}
`,
  },
  'utils-lib': {
    'lib/helpers.js': `module.exports = { helper: () => {} }
`,
    'package.json': `{
  "name": "my-utils-lib",
  "version": "1.0.0",
  "exports": {
    ".": "./src/index.js"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
`,
    'src/index.js': `module.exports = { util: () => {} }
`,
  },
  'library-with-bin-string': {
    'package.json': `{
  "name": "lib-with-bin-string",
  "version": "1.0.0",
  "bin": "./bin/cli.js",
  "devDependencies": {}
}
`,
    'src/index.ts': `export const main = () => {}
`,
  },
  'library-with-exports': {
    'package.json': `{
  "name": "library-with-exports",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "browser": "dist/browser.js",
  "bin": {
    "lib-cli": "bin/cli.js",
    "lib-tool": "bin/tool.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./utils": "./dist/utils.js",
    "./helpers": {
      "import": "./dist/helpers.mjs",
      "require": "./dist/helpers.cjs"
    }
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
`,
    'src/index.ts': `export const hello = 'world'
`,
  },
  'library-with-jest': {
    'package.json': `{
  "name": "library-with-jest",
  "version": "1.0.0",
  "main": "./src/index.js",
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
`,
    'src/index.js': `module.exports = { util: () => {} }
`,
  },
  'plugin-project': {
    'package.json': `{
  "name": "@scope/plugin-webpack",
  "version": "1.0.0",
  "main": "src/index.js",
  "description": "A plugin test fixture"
}
`,
    'src/index.js': `module.exports = {}
`,
  },
  'e2e-project': {
    'cypress.config.ts': `{}
`,
    'cypress/e2e/spec.cy.ts': `describe('e2e tests', () => {
  it('should work', () => {})
})
`,
    'package.json': `{
  "name": "my-project-e2e",
  "version": "1.0.0",
  "devDependencies": {
    "cypress": "^13.0.0"
  }
}
`,
  },
  'docker-app': {
    Dockerfile: `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "src/server.js"]
`,
    'package.json': `{
  "name": "app-with-docker",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.0.0"
  }
}
`,
    'src/server.js': `const express = require('express')
const app = express()
app.listen(3000)
`,
  },
  'backend-only': {
    'package.json': `{
  "name": "backend-only-app",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.0.0"
  }
}
`,
    'src/server.js': `const express = require('express')
const app = express()
app.listen(3000)
`,
  },
  'frontend-app': {
    'package.json': `{
  "name": "my-frontend-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}
`,
    'src/pages/index.tsx': `export function Page() {
  return <div>Hello</div>
}
`,
  },
  empty: {
    '.gitkeep': `# Empty directory test fixture
`,
  },
}
