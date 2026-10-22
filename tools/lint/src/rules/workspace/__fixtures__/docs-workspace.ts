/**
 * A disposable workspace for the documentation-link rules: two publishable libraries with
 * entries, symbols, members and bundle globals, a utilities library, the site's pages, a guide,
 * an article, a root document and committed media.
 *
 * @module rules/workspace/__fixtures__/docs-workspace
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** A publishable library's project file, with bundle globals. */
const PUBLISHABLE = JSON.stringify({
  projectType: 'library',
  targets: {
    build: {
      options: {
        iife: [
          { globalName: 'AlphaGlobal' },
          { entry: './sub', globalName: 'AlphaSub' },
          { entry: 'x' },
          { entry: './gone', globalName: 'AlphaGone' },
        ],
        umd: { globalName: 'AlphaUmd', entry: '.' },
      },
    },
    publish: {},
  },
})

/** The site's pages, workspace-relative. */
const APP = 'apps/docs-site/src/app'

/** The files of the workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'nx.json': '{}',
  'package.json': JSON.stringify({ name: 'ws', repository: { url: 'git+https://github.com/org/repo.git' } }),
  'ARCHITECTURE.md': '# Architecture\n\n## Layers\n',
  'libs/alpha/project.json': PUBLISHABLE,
  'libs/alpha/package.json': JSON.stringify({
    name: '@ws/alpha',
    exports: {
      '.': './src/index.js',
      './package.json': './package.json',
      './sub': { import: './src/sub/index.js' },
      './deep/inner': { default: './src/deep/inner/index.ts' },
      './dir': './src/dir',
      './data': './data.json',
      './glob/*': './x.js',
      './gone': './src/gone/index.js',
      './odd': { types: './src/odd.d.ts' },
      bare: './y.js',
    },
  }),
  'libs/alpha/README.md': '# Alpha\n\n## Usage\n\n## Usage\n',
  'libs/alpha/ARCHITECTURE.md': '# Design\n',
  'libs/alpha/src/index.ts': [
    "export * from './things'",
    "export * as space from './things'",
    "export { renamed as aliased, plain } from './more'",
    "export { 'quoted' as quotedName } from './more'",
    "import { hidden } from './more'",
    'export { hidden }',
    'export const config = defineConfig({ mode: "fast", ...spread, method() {}, key: 1, get size() { return 1 }, [computed]: "v" })',
    'export declare const shape: Shape',
    'export const literal = { a: 1 } as const',
    'export const nothing = 1, [destructured] = []',
    'export default function main() {}',
    'export default class {}',
    'export declare function declared(): void',
    'export namespace Space {}',
    'export interface Shape { width: number; area(): number; [key: string]: unknown; ["computed"]: 1; 2: number }',
    "export type Union = { left: 1 } | { right: 2; ['c']: 3 } | 'tag' | ({ inner: 1 } & { other: 2 }) | number",
    "export enum Color { Red = 'red', Blue = 2, 'Quoted' }",
    'export class Widget {\n  size = 1\n  private secret = 2\n  #hash = 3\n  run() {}\n  handler = () => {}\n  typed: () => void = () => {}\n  protected guarded = 1\n  static count = 0;\n  [index: string]: unknown\n  get value() { return 1 }\n  constructor() {}\n}',
    'export const createWidget = () => new Widget()',
    'export interface Other { width: number }',
  ].join('\n'),
  'libs/alpha/src/things.ts':
    "export const thing = 1\nexport function sharedName() {}\nexport * from './cycle'\nexport * from 'external'\nexport * from './absent'\n",
  'libs/alpha/src/cycle.ts': "export * from './things'\n",
  'libs/alpha/src/more/index.ts':
    'export const renamed = 1\nexport const plain = 2\nexport const quoted = 3\nexport const hidden = 4\nconst listed = 5\nexport { listed }\n',
  'libs/alpha/src/sub/index.ts':
    'export function subOnly() {}\nexport function sharedName() {}\nexport interface Options { level: number }\nexport function both() {}\n',
  'libs/alpha/src/sub/README.md': '# Sub\n',
  'libs/alpha/src/deep/inner/index.ts': 'export function sharedName() {}\n',
  'libs/alpha/src/dir/index.ts': 'export const fromDir = 1\nexport function both() {}\n',
  'libs/alpha/src/lib/extra/README.md': '# Extra\n',
  'libs/alpha/src/local.ts': 'function onlyHere() {}\nclass OnlyClass {}\nexport function twice() {}\n',
  'libs/alpha/src/other.ts': 'function twice() {}\nconst variableOnly = 1\n',
  'libs/alpha/src/skip.spec.ts': 'function inSpec() {}\n',
  'libs/alpha/src/__fixtures__/x.ts': 'function inFixture() {}\n',
  'libs/alpha/src/.hidden/x.ts': 'function inHidden() {}\n',
  'libs/alpha/src/view.tsx': 'function inTsx() {}\n',
  'libs/alpha/src/broken.ts': 'const = \n',
  'libs/utils/beta/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  'libs/utils/beta/package.json': JSON.stringify({ name: '@ws/beta-utils', exports: { '.': './src/index.js' } }),
  'libs/utils/beta/src/index.ts':
    'export function betaOnly() {}\nexport function sharedName() {}\nexport const settings = { level: 1 }\nexport interface Options { level: number }\nexport interface BetaOpts { betaKey: string }\n',
  'libs/utils/beta/README.md': '# Beta\n',
  'libs/nameless/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  'libs/nameless/package.json': '{}',
  'plugins/plug/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  'plugins/plug/package.json': JSON.stringify({ name: '@ws/plug' }),
  [`${APP}/docs/libraries/alpha/page.tsx`]: '',
  [`${APP}/docs/libraries/alpha/sub/page.tsx`]: '',
  [`${APP}/docs/libraries/alpha/extra/page.tsx`]: '',
  [`${APP}/docs/libraries/alpha/dir/page.tsx`]: '',
  [`${APP}/docs/libraries/alpha/architecture/page.tsx`]: '',
  [`${APP}/docs/libraries/utils/beta/page.tsx`]: '',
  [`${APP}/architecture/page.tsx`]: '',
  [`${APP}/docs/contributing/page.tsx`]: '',
  'apps/docs-site/content/guides/start/guide.md': '# Start\n\n## Install\n',
  'apps/docs-site/content/articles/story.md': '# Story\n',
  'libs/gamma/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  'libs/gamma/package.json': JSON.stringify({ name: '@hyperfrontend/gamma', exports: { '.': './src/index.js' } }),
  'libs/gamma/src/index.ts': 'export const gamma = 1\n',
  'libs/gamma/README.md': '# Gamma\n\n## Compatibility\n',
  'libs/delta/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  'libs/delta/package.json': JSON.stringify({ name: '@hyperfrontend/delta' }),
  'libs/epsilon/project.json': JSON.stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
  [`${APP}/docs/libraries/gamma/page.tsx`]: '',
  'assets/media/banner-gamma/banner.png': '',
  'assets/media/runtimes-gamma/runtimes.gif': '',
  'assets/media/hero-gamma/hero.webp': '',
  'assets/media/empty-scene/notes.txt': '',
  'assets/media/not-a-scene': '',
}

/**
 * Creates the workspace in a temporary directory.
 *
 * @returns The root
 */
export function createDocsWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'lint-docs-'))
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}
