/**
 * Consumer E2E tests for the generators of `@hyperfrontend/workspace`.
 *
 * An empty repository outside this one is made a workspace by the installed `hf`, and every step a consumer takes from
 * there runs through it: libraries generated, built, tested, linted and selected by a change, one made publishable and
 * tested as a package, then renamed and moved. Nothing a generator writes may name this repository.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({
  tarball: process.env['HF_E2E_TARBALL'],
  peers: ['typescript@5.7.3', '@types/node@25.3.3', '@hyperfrontend/testing@0.5.1', '@hyperfrontend/linter@0.3.1', 'prettier@3.8.0'],
})

/**
 * Runs the installed executable in the consumer.
 *
 * @param args - The arguments after `hf`
 * @returns What the run reported
 */
function hf(args: readonly string[]): ConsumerRun {
  return consumer.node([join(consumer.path, 'node_modules', '@hyperfrontend', 'workspace', 'bin', 'hf.mjs'), ...args], { timeout: 600_000 })
}

/**
 * Runs git in the consumer with a fixed identity.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Consumer', '-c', 'user.email=consumer@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: consumer.path,
    encoding: 'utf8',
  }).trim()
}

/**
 * A file of the consumer.
 *
 * @param path - The file, relative to the consumer
 * @returns Its text
 */
function read(path: string): string {
  return readFileSync(join(consumer.path, path), 'utf8')
}

/**
 * A JSON file of the consumer.
 *
 * @param path - The file, relative to the consumer
 * @returns Its value
 */
function readJson<Value>(path: string): Value {
  return JSON.parse(read(path)) as Value
}

/**
 * Every file under a directory of the consumer, outside `node_modules`.
 *
 * @param directory - The directory, relative to the consumer
 * @returns The files, relative to the consumer
 */
function filesUnder(directory: string): string[] {
  return readdirSync(join(consumer.path, directory), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.parentPath.includes('node_modules'))
    .map((entry) => join(entry.parentPath, entry.name).slice(consumer.path.length + 1))
}

/**
 * The text with every package name of this repository's scope removed, so what is left names this repository only
 * where a generator leaked it.
 *
 * @param text - A generated file's text
 * @returns The text without `@hyperfrontend/<name>` package names
 */
function withoutPackageNames(text: string): string {
  return text.replace(/@hyperfrontend\/[a-z0-9-]+/g, '')
}

before(() => {
  // why: npm wrote the consumer's manifest for the install; the scope the generators read comes from the name the repository gives itself
  consumer.write('package.json', { ...readJson<Record<string, unknown>>('package.json'), name: '@acme/monorepo', license: 'MIT' })
  git('init', '-q')
})

describe('hf generate workspace', () => {
  it('writes the root configuration the engine reads into the empty repository', () => {
    hf(['generate', 'workspace'])
    expect(
      ['hf.json', 'tsconfig.base.json', 'lint.base.config.ts', '.hfignore', '.gitignore'].filter(
        (file) => !existsSync(join(consumer.path, file))
      )
    ).toEqual([])
  })

  it('refuses to run twice', () => {
    expect(hf(['generate', 'workspace']).stderr).toContain('hf.json already exists')
  })
})

describe('hf generate library', () => {
  it('writes a library under the repository scope', () => {
    hf(['generate', 'library', 'alpha', '--description=Alpha.'])
    expect(readJson('libs/alpha/package.json')).toEqual(expect.objectContaining({ name: '@acme/alpha', private: true, license: 'MIT' }))
  })

  it('prints what a second library would change under --dry-run, and writes nothing', () => {
    const run = hf(['generate', 'library', 'beta', '--dry-run'])
    expect({
      listed: run.stdout.includes('CREATE libs/beta/project.json'),
      written: existsSync(join(consumer.path, 'libs', 'beta')),
    }).toEqual({
      listed: true,
      written: false,
    })
  })

  it('names nothing of this repository in what it prints', () => {
    const run = hf(['generate', 'library', 'beta', '--dry-run'])
    expect(withoutPackageNames(run.stdout + run.stderr)).not.toMatch(/hyperfrontend/i)
  })

  it('shows the edge from a library that imports another', () => {
    hf(['generate', 'library', 'beta'])
    writeFileSync(join(consumer.path, 'libs', 'alpha', 'src', 'index.ts'), 'export const alpha = (value: number): number => value + 1;\n')
    writeFileSync(
      join(consumer.path, 'libs', 'beta', 'src', 'index.ts'),
      'import { alpha } from "@acme/alpha";\n\nexport const beta = alpha(1);\n'
    )
    expect(hf(['graph', 'explain', 'beta']).stdout).toContain('→ project:alpha')
  })
})

describe('the tasks of a generated library', () => {
  before(() => {
    consumer.write(
      'libs/alpha/src/index.spec.ts',
      'import { describe, expect, it } from "@hyperfrontend/testing";\nimport { alpha } from "./index";\n\ndescribe("alpha", () => {\n  it("adds one", () => {\n    expect(alpha(1)).toBe(2);\n  });\n});\n'
    )
  })

  it.each(['typecheck', 'test', 'lint'])('runs %s on the library and exits 0', (target) => {
    const run = hf(['run', `alpha:${target}`])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 0, output: expect.any(String) })
  })

  it('builds every library into the output path the workspace configures', () => {
    const run = hf(['run-many', '-t', 'build', '--all'])
    expect({
      status: run.status,
      alpha: existsSync(join(consumer.path, 'dist', 'libs', 'alpha', 'package.json')),
      beta: existsSync(join(consumer.path, 'dist', 'libs', 'beta', 'package.json')),
    }).toEqual({ status: 0, alpha: true, beta: true })
  })

  it('selects the tests of a changed library and of the one that imports it', () => {
    git('add', '-A')
    git('commit', '--quiet', '--no-verify', '-m', 'feat: two libraries')
    writeFileSync(
      join(consumer.path, 'libs', 'alpha', 'src', 'index.ts'),
      'export const alpha = (value: number): number => value + 1; // changed\n'
    )
    const run = hf(['affected', '-t', 'test', '--base=HEAD'])
    expect(run.stdout + run.stderr).toContain('hf affected: 2 tasks selected')
  })

  it('leaves generated code formatted', () => {
    expect(hf(['format', '--check', '--all'])).toEqual(expect.objectContaining({ status: 0 }))
  })
})

describe('hf generate make-publishable', () => {
  it('plans a browser suite for each browser bundle format', () => {
    const run = hf(['generate', 'make-publishable', 'alpha', '--formats=esm,cjs,iife,umd', '--dry-run'])
    expect(['iife', 'umd'].filter((format) => !run.stdout.includes(`CREATE e2e/alpha/src/${format}.spec.ts`))).toEqual([])
  })

  it('gives the library the targets, the manifest fields and the e2e project a published package needs', () => {
    // why: the embedded builder's browser-bundle worker fails inside an installed package (follow-up F15), so the package tested here ships the module formats alone
    hf(['generate', 'make-publishable', 'alpha', '--formats=esm,cjs'])
    expect({
      targets: Object.keys(readJson<{ targets: Record<string, unknown> }>('libs/alpha/project.json').targets),
      manifest: readJson('libs/alpha/package.json'),
      e2e: filesUnder('e2e/alpha').sort(),
    }).toEqual({
      targets: ['version', 'version-check', 'build', 'publish', 'typecheck', 'test'],
      manifest: expect.objectContaining({
        name: '@acme/alpha',
        sideEffects: false,
        engines: expect.any(Object),
        keywords: ['alpha', 'acme', 'typescript'],
      }),
      e2e: [
        'e2e/alpha/package.json',
        'e2e/alpha/project.json',
        'e2e/alpha/src/cjs.spec.ts',
        'e2e/alpha/src/esm.spec.ts',
        'e2e/alpha/tsconfig.json',
      ],
    })
  })

  it('names this repository nowhere in what the generators wrote', () => {
    const files = [
      'hf.json',
      'tsconfig.base.json',
      'lint.base.config.ts',
      '.hfignore',
      ...filesUnder('libs/alpha'),
      ...filesUnder('e2e/alpha'),
    ]
    expect(files.filter((file) => /hyperfrontend/i.test(withoutPackageNames(read(file))))).toEqual([])
  })

  it('builds the package in every format', () => {
    const run = hf(['run', 'alpha:build'])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 0, output: expect.any(String) })
  })

  it('packs the build, installs it into the e2e project and runs its suites', () => {
    const run = hf(['run', 'e2e-alpha:e2e'])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({
      status: 0,
      output: expect.stringMatching(/✔ @acme\/alpha CJS[\s\S]*✔ @acme\/alpha ESM/),
    })
  })
})

describe('hf generate rename and move', () => {
  it('renames the library everywhere, the e2e project included', () => {
    hf(['generate', 'rename', 'alpha', 'gamma'])
    writeFileSync(
      join(consumer.path, 'libs', 'beta', 'src', 'index.ts'),
      'import { alpha } from "@acme/gamma";\n\nexport const beta = alpha(1);\n'
    )
    expect({
      pkg: readJson<{ name: string }>('libs/alpha/package.json').name,
      e2e: readJson<{ name: string; implicitDependencies: string[] }>('e2e/alpha/project.json'),
      alias: readJson<{ compilerOptions: { paths: Record<string, string[]> } }>('tsconfig.base.json').compilerOptions.paths['@acme/gamma'],
      edge: hf(['graph', 'explain', 'beta']).stdout.includes('→ project:gamma'),
    }).toEqual({
      pkg: '@acme/gamma',
      e2e: expect.objectContaining({ name: 'e2e-gamma', implicitDependencies: ['gamma'] }),
      alias: ['libs/alpha/src/index.ts'],
      edge: true,
    })
  })

  it('moves the library, keeping the graph and the alias consistent', () => {
    hf(['generate', 'move', 'gamma', 'packages', '--newName=gamma'])
    expect({
      moved:
        existsSync(join(consumer.path, 'packages', 'gamma', 'project.json')) &&
        !existsSync(join(consumer.path, 'libs', 'alpha', 'project.json')),
      alias: readJson<{ compilerOptions: { paths: Record<string, string[]> } }>('tsconfig.base.json').compilerOptions.paths['@acme/gamma'],
      edge: hf(['graph', 'explain', 'beta']).stdout.includes('→ project:gamma'),
      typechecks: hf(['run', 'beta:typecheck']).status,
    }).toEqual({ moved: true, alias: ['packages/gamma/src/index.ts'], edge: true, typechecks: 0 })
  })
})
