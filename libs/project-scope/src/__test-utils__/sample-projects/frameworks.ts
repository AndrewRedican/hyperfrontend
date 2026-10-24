import type { FixtureTree } from './tree'

/**
 * Applications built on a framework, plus projects whose sources import one
 * another in the ways the dependency heuristics trace.
 */
export const FRAMEWORK_FIXTURES: Readonly<Record<string, FixtureTree>> = {
  'angular-app': {
    'angular.json': `{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "angular-app": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src"
    }
  }
}
`,
    'package.json': `{
  "name": "angular-app",
  "version": "1.0.0",
  "dependencies": {
    "@angular/core": "^17.0.0"
  }
}
`,
    'src/main.ts': `import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'

bootstrapApplication(AppComponent)
`,
  },
  'nextjs-app': {
    'package.json': `{
  "name": "nextjs-app",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
`,
    'pages/_app.tsx': `import type { AppProps } from 'next/app'
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
`,
    'pages/about.tsx': `export default function About() {
  return <div>About</div>
}
`,
    'pages/api/hello.ts': `export default function handler(req, res) {
  res.status(200).json({ name: 'API' })
}
`,
    'pages/index.tsx': `export default function Home() {
  return <div>Home</div>
}
`,
  },
  'nextjs-app-router': {
    'app/about/page.tsx': `export default function AboutPage() {
  return <div>About Page</div>
}
`,
    'app/layout.tsx': `export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
`,
    'app/page.tsx': `export default function HomePage() {
  return <div>Home Page</div>
}
`,
    'package.json': `{
  "name": "nextjs-app-router",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
`,
  },
  'sveltekit-app': {
    'package.json': `{
  "name": "sveltekit-app",
  "version": "1.0.0",
  "dependencies": {
    "@sveltejs/kit": "^2.0.0"
  }
}
`,
    'src/routes/+page.svelte': `<h1>Welcome to SvelteKit</h1>
`,
    'src/routes/about/+page.svelte': `<h1>About Page</h1>
`,
    'svelte.config.js': `import adapter from '@sveltejs/adapter-auto'

export default {
  kit: {
    adapter: adapter(),
  },
}
`,
  },
  'circular-deps': {
    'package.json': `{
  "name": "circular-deps-test",
  "version": "1.0.0",
  "description": "Test project with circular dependencies"
}
`,
    'src/a.ts': `import { valueB } from './b'

export const valueA = 'A' + valueB.substring(0, 1)
`,
    'src/b.ts': `import { valueC } from './c'

export const valueB = 'B' + valueC.substring(0, 1)
`,
    'src/c.ts': `import { valueA } from './a'

export const valueC = 'C' + valueA.substring(0, 1)
`,
  },
  'dynamic-imports': {
    'package.json': `{
  "name": "dynamic-imports-test",
  "version": "1.0.0",
  "description": "Test project with dynamic imports"
}
`,
    'src/config.ts': `module.exports = {
  setting: 'value'
}
`,
    'src/helper.ts': `export function helper() {
  return 'helper'
}
`,
    'src/index.ts': `// ES import
import { helper } from './helper'

// Dynamic import
async function loadUtils() {
  const utils = await import('./utils')
  return utils.doSomething()
}

// CommonJS require
const config = require('./config')

// Export from
export * from './types'

console.log(helper, loadUtils, config)
`,
    'src/types.ts': `export interface MyType {
  name: string
}
`,
    'src/utils.ts': `export function doSomething() {
  return 'done'
}
`,
  },
  'directory-imports': {
    'package.json': `{
  "name": "directory-imports-test",
  "version": "1.0.0"
}
`,
    'src/helpers/index.ts': `export function helpers() {
  return 'helpers'
}
`,
    'src/index.ts': `import { utils } from './utils'
import { helpers } from './helpers'

export { utils, helpers }
`,
    'src/utils/index.ts': `export function utils() {
  return 'utils'
}
`,
  },
}
