/**
 * Consumer E2E tests for the `hf` executable of `@hyperfrontend/workspace`.
 *
 * The packed tarball is installed into a consumer outside this repository, and that consumer is made a workspace: a
 * workspace file, two libraries, and a project of its own that provides an executor and a generator written in
 * TypeScript. Every test runs the installed executable there under plain Node, the way `npx hf` would.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The executor the workspace provides for itself: it imports a sibling without its extension and is typed against the package. */
const HELLO = [
  "import type { ExecutorContext, ExecutorResult } from '@hyperfrontend/workspace'",
  "import { greeting } from './greeting'",
  '',
  'interface HelloOptions {',
  '  name: string',
  '}',
  '',
  'export default async function hello(options: HelloOptions, context: ExecutorContext): Promise<ExecutorResult> {',
  '  process.stdout.write(`${greeting(options.name)} from ${context.projectName} at ${context.projects[context.projectName]?.root}\\n`)',
  '  return { success: true }',
  '}',
  '',
].join('\n')

/** The generator the workspace provides for itself. */
const NOTE = [
  "import type { Tree } from '@hyperfrontend/workspace'",
  "import { greeting } from './greeting'",
  '',
  'interface NoteOptions {',
  '  name: string',
  '}',
  '',
  'export default function note(tree: Tree, options: NoteOptions): void {',
  '  tree.write(`notes/${options.name}.txt`, `${greeting(options.name)}\\n`)',
  '}',
  '',
].join('\n')

/** The lint configuration of the workspace: the projects family of the package, with tag constraints between its libraries. */
const LINT_CONFIG = [
  "import { PROJECTS_FAMILY } from '@hyperfrontend/workspace/lint'",
  '',
  'export default [',
  '  { families: { projects: PROJECTS_FAMILY } },',
  "  { ignores: ['node_modules/', 'out/', '.hf/'] },",
  '  {',
  "    files: ['**/*.ts'],",
  "    rules: { 'projects/module-boundaries': ['error', { depConstraints: [{ sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] }] }] },",
  '  },',
  "  { files: ['**/package.json'], rules: { 'projects/dependency-checks': ['error', { ignoredDependencies: ['@hyperfrontend/testing'] }] } },",
  ']',
  '',
].join('\n')

/** The workspace written into the consumer. */
const WORKSPACE = {
  '.gitignore': 'node_modules\n.hf\n',
  'hf.json': {
    targetDefaults: {
      build: { dependsOn: ['^build'] },
      '@hyperfrontend/workspace:build': { options: { outputPath: 'out/{projectRoot}', rootAssets: ['LICENSE.md', 'SECURITY.md'] } },
    },
  },
  'LICENSE.md': 'A licence.\n',
  'lint.config.ts': LINT_CONFIG,
  'tsconfig.base.json': {
    compilerOptions: { paths: { '@consumer/core': ['packages/core/src/index.ts'], '@consumer/alpha': ['libs/alpha/src/index.ts'] } },
  },
  'packages/core/project.json': {
    name: 'core',
    projectType: 'library',
    tags: ['type:util'],
    targets: {
      typecheck: { executor: '@hyperfrontend/workspace:typecheck' },
      test: { executor: '@hyperfrontend/workspace:test' },
      build: { executor: '@hyperfrontend/workspace:build', options: { esm: {}, cjs: {} } },
      publish: { executor: '@hyperfrontend/workspace:publish' },
      version: { executor: '@hyperfrontend/workspace:version' },
      'version-check': { executor: '@hyperfrontend/workspace:version-check' },
    },
  },
  'packages/core/package.json': {
    name: '@consumer/core',
    version: '1.2.3',
    license: 'MIT',
    exports: { '.': './src/index.js', './package.json': './package.json' },
  },
  'packages/core/README.md': '# @consumer/core\n',
  'packages/core/tsconfig.json': {
    compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', declaration: true, types: ['node'] },
  },
  'packages/core/tsconfig.lib.json': { extends: './tsconfig.json', include: ['src/**/*.ts'], exclude: ['src/**/*.spec.ts'] },
  'packages/core/tsconfig.spec.json': { extends: './tsconfig.json', compilerOptions: { noEmit: true }, include: ['src/**/*.ts'] },
  'packages/core/test.config.ts': [
    "import type { TestConfig } from '@hyperfrontend/testing/runner'",
    '',
    "const config: TestConfig = { environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }], coverageInclude: ['src/**/*.ts'] }",
    '',
    'export default config',
    '',
  ].join('\n'),
  'packages/core/src/index.ts': 'export const double = (value: number): number => value * 2\n',
  'packages/core/src/index.spec.ts': [
    "import { describe, expect, it } from '@hyperfrontend/testing'",
    "import { double } from './index'",
    '',
    "describe('double', () => {",
    "  it('doubles', () => {",
    '    expect(double(2)).toBe(4)',
    '  })',
    '})',
    '',
  ].join('\n'),
  'libs/alpha/src/index.ts': 'export const alpha = 1\n',
  'libs/alpha/project.json': {
    name: 'alpha',
    tags: ['type:app'],
    targets: {
      build: { command: 'node -e "console.log(\'built alpha\')"' },
      echo: { command: 'node -e "console.log(process.argv.slice(1).join(\' \'))" --' },
      projects: { executor: '@hyperfrontend/workspace:run-commands', options: { commands: ['hf show projects'] } },
      hello: { executor: '@consumer/local:hello' },
      broken: { command: 'node -e "process.exit(3)"' },
    },
  },
  'libs/beta/project.json': {
    name: 'beta',
    implicitDependencies: ['alpha'],
    targets: {
      build: { command: 'node -e "console.log(\'built beta\')"' },
      broken: { command: 'node -e "console.log(\'never\')"', dependsOn: ['^broken'] },
    },
  },
  'tools/local/package.json': { name: '@consumer/local', private: true, executors: './executors.json', generators: './generators.json' },
  'tools/local/executors.json': { executors: { hello: { implementation: './src/hello', schema: './src/hello.json' } } },
  'tools/local/generators.json': { generators: { note: { factory: './src/note', schema: './src/note.json' } } },
  'tools/local/tsconfig.json': {
    compilerOptions: { strict: true, noEmit: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', types: ['node'] },
    include: ['src/**/*.ts'],
  },
  'tools/local/src/greeting.ts': 'export const greeting = (name: string): string => `hello ${name}`\n',
  'tools/local/src/hello.ts': HELLO,
  'tools/local/src/hello.json': { properties: { name: { type: 'string', default: 'world' } } },
  'tools/local/src/note.ts': NOTE,
  'tools/local/src/note.json': { properties: { name: { type: 'string', $default: { $source: 'argv', index: 0 } } }, required: ['name'] },
}

const consumer = usePackedConsumer({
  tarball: process.env['HF_E2E_TARBALL'],
  peers: ['typescript@5.7.3', '@types/node@25.3.3', '@hyperfrontend/testing@0.5.1', '@hyperfrontend/linter@0.3.1'],
})

before(() => {
  consumer.writeTree(WORKSPACE)
  execFileSync('git', ['init', '-q'], { cwd: consumer.path })
})

/**
 * Runs the installed executable in the consumer.
 *
 * @param args - The arguments after `hf`
 * @param cwd - The directory it runs from, relative to the consumer
 * @returns What the run reported
 */
function hf(args: readonly string[], cwd?: string): ConsumerRun {
  return consumer.node([join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), ...args], { cwd })
}

/**
 * The lines a run printed on one of its streams.
 *
 * @param text - What the stream took
 * @returns The lines that are not empty
 */
function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line !== '')
}

describe('hf show', () => {
  it('lists the projects of the workspace, from a directory below its root', () => {
    expect(lines(hf(['show', 'projects'], 'libs/alpha').stdout)).toEqual(expect.arrayContaining(['alpha', 'beta', '@consumer/local']))
  })
})

describe('hf run', () => {
  it('hands the arguments after the task to a bare command', () => {
    expect(hf(['run', 'alpha:echo', '--flag=1'])).toEqual(expect.objectContaining({ status: 0, stdout: '--flag=1\n' }))
  })

  it('finds the executables of node_modules/.bin from a run-commands target', () => {
    expect(lines(hf(['run', 'alpha:projects']).stdout)).toEqual(expect.arrayContaining(['alpha', 'beta']))
  })

  it('runs an executor the workspace wrote in TypeScript, with its schema defaults and the context of the task', () => {
    expect(hf(['run', 'alpha:hello']).stdout).toBe('hello world from alpha at libs/alpha\n')
  })

  it('types an option given on the command line by the schema of the executor', () => {
    expect(hf(['run', 'alpha:hello', '--name=there']).stdout).toBe('hello there from alpha at libs/alpha\n')
  })

  it('exits 1 for a task that fails', () => {
    expect(hf(['run', 'alpha:broken']).status).toBe(1)
  })

  it('refuses an executor nothing provides, naming where it looked', () => {
    consumer.write('libs/gamma/project.json', { name: 'gamma', targets: { build: { executor: '@consumer/absent:build' } } })
    expect(hf(['run', 'gamma:build']).stderr).toContain(
      'no workspace project and no installed package provides the executors of @consumer/absent'
    )
  })
})

describe('hf run-many', () => {
  it('runs a prerequisite before the task that depends on it, each through the installed executable', () => {
    expect(lines(hf(['run-many', '-t', 'build', '-p', 'beta']).stdout)).toEqual(['built alpha', 'built beta'])
  })

  it('skips the dependents of a task that fails and exits 1', () => {
    const run = hf(['run-many', '-t', 'broken', '-p', 'beta'])
    expect({ status: run.status, ranBeta: run.stdout.includes('never') }).toEqual({ status: 1, ranBeta: false })
  })
})

describe('hf generate', () => {
  it('prints what a generator the workspace wrote would change, and writes nothing, under --dry-run', () => {
    const run = hf(['generate', 'note', 'draft', '--dry-run'])
    expect({ stdout: run.stdout, written: existsSync(join(consumer.path, 'notes', 'draft.txt')) }).toEqual({
      stdout: 'CREATE notes/draft.txt\n',
      written: false,
    })
  })

  it('writes what the generator changed', () => {
    hf(['generate', 'note', 'memo'])
    expect(readFileSync(join(consumer.path, 'notes', 'memo.txt'), 'utf8')).toBe('hello memo\n')
  })

  it('refuses a generator nothing lists, naming the ones there are', () => {
    expect(hf(['generate', 'nope']).stderr).toContain('no generator nope: @consumer/local:note')
  })
})

describe('hf graph', () => {
  it('explains a project by what it depends on', () => {
    expect(hf(['graph', 'explain', 'beta']).stdout).toContain('→ project:alpha')
  })
})

describe('the executors of the package', () => {
  it('type checks a library of the workspace', () => {
    expect(hf(['run', 'core:typecheck']).status).toBe(0)
  })

  it('fails the type check of a library with a type error', () => {
    consumer.write('packages/core/src/broken.ts', 'export const broken: number = "text"\n')
    const run = hf(['run', 'core:typecheck'])
    rmSync(join(consumer.path, 'packages', 'core', 'src', 'broken.ts'))
    expect({ status: run.status, reported: run.stdout.includes('TS2322') }).toEqual({ status: 1, reported: true })
  })

  it('lints a library through the inferred lint target and the linter the workspace installs', () => {
    expect(hf(['run', 'core:lint'])).toEqual(expect.objectContaining({ status: 0 }))
  })

  it('fails the lint of a library that imports a project its tags do not allow, naming the constraint', () => {
    consumer.write('packages/core/src/crossing.ts', "import { alpha } from '@consumer/alpha'\n\nexport const crossing = alpha\n")
    const run = hf(['run', 'core:lint'])
    rmSync(join(consumer.path, 'packages', 'core', 'src', 'crossing.ts'))
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 1, output: expect.stringContaining('type:util') })
  })

  it('fails the lint of a library whose manifest does not declare a package it imports, naming the package', () => {
    consumer.write('packages/core/src/typed.ts', "import ts from 'typescript'\n\nexport const version = ts.version\n")
    const run = hf(['run', 'core:lint'])
    rmSync(join(consumer.path, 'packages', 'core', 'src', 'typed.ts'))
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 1, output: expect.stringContaining('typescript') })
  })

  it('runs the suites of a library on the test runtime the workspace installs', () => {
    expect(hf(['run', 'core:test'])).toEqual(expect.objectContaining({ status: 0, stdout: expect.stringContaining('doubles') }))
  })

  it('fails the test of a library whose spec fails', () => {
    consumer.write(
      'packages/core/src/failing.spec.ts',
      "import { expect, it } from '@hyperfrontend/testing'\nit('fails', () => {\n  expect(1).toBe(2)\n})\n"
    )
    const run = hf(['run', 'core:test'])
    rmSync(join(consumer.path, 'packages', 'core', 'src', 'failing.spec.ts'))
    expect(run.status).toBe(1)
  })

  it('builds a library into the output path the workspace configures, with a manifest a consumer can install', () => {
    hf(['run', 'core:build'])
    expect(JSON.parse(readFileSync(join(consumer.path, 'out', 'packages', 'core', 'package.json'), 'utf8'))).toEqual(
      expect.objectContaining({ name: '@consumer/core', version: '1.2.3', exports: expect.objectContaining({ '.': expect.any(Object) }) })
    )
  })

  it('copies the root assets that exist into the built package, and skips the one that does not', () => {
    expect(consumer.listFiles('out/packages/core').filter((file) => file.endsWith('.md'))).toEqual(
      expect.arrayContaining(['LICENSE.md', 'README.md'])
    )
  })

  it('previews the publish of the build output', () => {
    expect(hf(['run', 'core:publish', '--dryRun']).status).toBe(0)
  })
})

describe('the release flow', () => {
  /**
   * Runs git in the consumer with a fixed identity.
   *
   * @param args - The git arguments
   * @returns What git printed, trimmed
   */
  function git(...args: string[]): string {
    return execFileSync(
      'git',
      ['-c', 'user.name=Consumer', '-c', 'user.email=consumer@example.com', '-c', 'commit.gpgsign=false', ...args],
      {
        cwd: consumer.path,
        encoding: 'utf8',
      }
    ).trim()
  }

  before(() => {
    // why: the version flow commits as the repository's own identity, which a runner need not be able to work out
    git('config', 'user.name', 'Consumer')
    git('config', 'user.email', 'consumer@example.com')
    git('config', 'commit.gpgsign', 'false')
    // why: the package has never been published, so its first release is the configured first version; starting below it makes the bump visible in the manifest
    consumer.write('packages/core/package.json', {
      name: '@consumer/core',
      version: '0.0.0',
      license: 'MIT',
      exports: { '.': './src/index.js', './package.json': './package.json' },
    })
    git('add', '-A')
    git('commit', '--quiet', '--no-verify', '-m', 'feat(core): add the core library')
  })

  it('fails the version check of a library whose commits call for a release it does not have, naming the remedy', () => {
    const run = hf(['run', 'core:version-check'])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({
      status: 1,
      output: expect.stringMatching(/version-mismatch[\s\S]*npx hf run core:version/),
    })
  })

  it('versions the library from its commits, writes its changelog, and commits the bump', () => {
    const run = hf(['run', 'core:version'])
    const manifest = JSON.parse(readFileSync(join(consumer.path, 'packages', 'core', 'package.json'), 'utf8')) as { version: string }
    expect({
      status: run.status,
      version: manifest.version,
      changelog: readFileSync(join(consumer.path, 'packages', 'core', 'CHANGELOG.md'), 'utf8').includes('0.1.0'),
      subject: git('log', '-1', '--format=%s'),
      clean: git('status', '--porcelain', '--', 'packages/core'),
    }).toEqual({ status: 0, version: '0.1.0', changelog: true, subject: 'chore(core): release version 0.1.0', clean: '' })
  })

  it('passes the version check once the bump is in place', () => {
    const run = hf(['run', 'core:version-check', '--skipIfVersionCommit=false'])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({
      status: 0,
      output: expect.stringContaining('matches expected'),
    })
  })
})

describe('hf alone', () => {
  it('prints its usage for --help and exits 0', () => {
    expect(hf(['--help'])).toEqual(expect.objectContaining({ status: 0, stdout: expect.stringContaining('Usage: hf <command> [options]') }))
  })

  it('reports a command it does not own while no other package provides hf', () => {
    expect(hf(['frobnicate'])).toEqual(
      expect.objectContaining({ status: 1, stderr: expect.stringContaining('hf: unknown command frobnicate') })
    )
  })
})

describe('hf beside a features package', () => {
  before(() =>
    consumer.writeTree({
      'node_modules/@hyperfrontend/features/package.json': {
        name: '@hyperfrontend/features',
        version: '0.0.0',
        exports: { './cli': './cli.cjs' },
      },
      'node_modules/@hyperfrontend/features/cli.cjs': [
        'exports.runFeaturesCli = (invocation) => {',
        "  invocation.stdout.write(`features ran ${invocation.argv.join(' ')} handedOver=${invocation.handedOver}\\n`)",
        '  return Promise.resolve(0)',
        '}',
        '',
      ].join('\n'),
    })
  )

  it('passes a command it does not own to the features command line, marked as handed over', () => {
    expect(hf(['build', '--protocol', 'v4'], 'libs/alpha')).toEqual(
      expect.objectContaining({ status: 0, stdout: 'features ran build --protocol v4 handedOver=true\n' })
    )
  })

  it('follows its usage with the features usage', () => {
    expect(hf(['--help']).stdout).toMatch(/Usage: hf <command> \[options\][\s\S]*features ran --help handedOver=true\n$/)
  })

  it('keeps the commands it owns', () => {
    expect(hf(['run', 'alpha:echo', '--kept=1']).stdout).toBe('--kept=1\n')
  })
})

describe('the contract types', () => {
  it('type an executor and a generator of the workspace under the TypeScript compiler', () => {
    const run = consumer.node([join(consumer.path, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tools/local'])
    expect({ status: run.status, output: run.stdout }).toEqual({ status: 0, output: '' })
  })
})

/** The features command line as the stub provides it: it reports what it was asked and whether the call was handed over. */
const FEATURES_CLI = [
  'exports.runFeaturesCli = (invocation) => {',
  "  invocation.stdout.write(`features ran ${invocation.argv.join(' ')} handedOver=${invocation.handedOver}\\n`)",
  '  return Promise.resolve(0)',
  '}',
  '',
].join('\n')

/**
 * The features executable as the stub provides it: the decision the published one makes, written out. A first word
 * that is no flag and none of its own commands goes to the workspace command line resolved from the directory the
 * command ran in; everything else runs here.
 */
const FEATURES_BIN = [
  '#!/usr/bin/env node',
  "'use strict'",
  "const { createRequire } = require('node:module')",
  "const { join } = require('node:path')",
  "const { pathToFileURL } = require('node:url')",
  "const { runFeaturesCli } = require('../cli.cjs')",
  '',
  'const argv = process.argv.slice(2)',
  "const own = ['init', 'build', 'dev', 'serve']",
  'const invocation = { argv, cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr }',
  '',
  'async function main() {',
  '  const first = argv[0]',
  "  if (first !== undefined && !first.startsWith('-') && !own.includes(first)) {",
  '    let file = null',
  '    try {',
  "      file = createRequire(join(process.cwd(), 'package.json')).resolve('@hyperfrontend/workspace/cli')",
  '    } catch {}',
  '    if (file !== null) {',
  '      const { runWorkspaceCli } = await import(pathToFileURL(file).href)',
  '      return runWorkspaceCli({ ...invocation, handedOver: true })',
  '    }',
  '  }',
  '  return runFeaturesCli(invocation)',
  '}',
  '',
  'main().then((code) => {',
  '  process.exitCode = code',
  '})',
  '',
].join('\n')

describe('hf linked beside a features package', () => {
  // why: no published @hyperfrontend/features carries the handover yet, so a package standing in for it is installed beside the tarball; it declares the same bin and makes the same decision, so npm links one of the two and the test asks both commands of whichever that was
  const features = createTempDir({
    prefix: 'hf-features-stub-',
    tree: {
      'package.json': {
        name: '@hyperfrontend/features',
        version: '0.0.0',
        bin: { hf: './bin/hf.cjs' },
        exports: { './cli': './cli.cjs' },
      },
      'cli.cjs': FEATURES_CLI,
      'bin/hf.cjs': FEATURES_BIN,
    },
  })
  const linked = usePackedConsumer({ tarball: process.env['HF_E2E_TARBALL'], peers: [features.path] })

  before(() => {
    linked.writeTree({
      'hf.json': {},
      'libs/alpha/project.json': { name: 'alpha', targets: { echo: { command: 'node -e 0' } } },
    })
  })

  /**
   * The file npm linked as `hf`, read from the symbolic link it makes on POSIX or from the shim it writes on Windows.
   *
   * @returns The bin file of whichever package npm linked
   */
  function linkedBin(): string {
    const bin = join(linked.path, 'node_modules', '.bin')
    const shim = join(bin, 'hf')
    if (process.platform !== 'win32') return join(bin, readlinkSync(shim))
    const target = /"\$basedir\/(\.\.\/[^"]+)"/.exec(readFileSync(shim, 'utf8'))
    if (target === null) throw new Error(`the hf shim at ${shim} names no bin file`)
    return join(bin, target[1] as string)
  }

  it('links one hf for the two packages', () => {
    expect(linkedBin()).toMatch(/@hyperfrontend[\\/](features|workspace)[\\/]/)
  })

  it('reaches the features command line for a features command', () => {
    expect(linked.node([linkedBin(), 'build', '--help'])).toEqual(
      expect.objectContaining({ status: 0, stdout: 'features ran build --help handedOver=true\n' })
    )
  })

  it('reaches the workspace command line for a workspace command', () => {
    const run = linked.node([linkedBin(), 'show', 'projects'])
    expect({ status: run.status, projects: lines(run.stdout) }).toEqual({ status: 0, projects: expect.arrayContaining(['alpha']) })
  })
})
