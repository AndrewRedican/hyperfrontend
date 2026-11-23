/**
 * Consumer E2E tests for the generators of `@hyperfrontend/workspace`.
 *
 * An empty repository outside this one is made a workspace by the installed `hf`, and every step a consumer takes from
 * there runs through it: libraries generated, built, tested, linted and selected by a change, one made publishable and
 * tested as a package, then renamed and moved, and an application and a service generated and checked as written.
 * Nothing a generator writes may name this repository.
 */

import type { ConsumerRun } from '@hyperfrontend/testing/consumer'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({
  tarball: process.env['HF_E2E_TARBALL'],
  peers: [
    'typescript@5.7.3',
    '@types/node@25.3.3',
    '@hyperfrontend/testing@0.5.1',
    '@hyperfrontend/linter@0.3.1',
    'prettier@3.8.0',
    'jsdom@26.1.0',
    '@hyperfrontend/server@0.2.0',
  ],
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
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(consumer.path.length + 1)
        .split(sep)
        .join('/')
    )
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

/** The repository the consumer's root manifest states, which a build writes into each package with the library's directory. */
const REPOSITORY = { type: 'git', url: 'git+https://example.com/acme/monorepo.git' }

before(() => {
  // why: npm wrote the consumer's manifest for the install; the scope the generators read comes from the name the repository gives itself
  consumer.write('package.json', {
    ...readJson<Record<string, unknown>>('package.json'),
    name: '@acme/monorepo',
    license: 'MIT',
    repository: REPOSITORY,
  })
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
    // why: a description formatting rewrites, so the README a later step must recognise is not the text the generator wrote
    hf(['generate', 'library', 'alpha', '--description=Reads *.ts files.'])
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

  it('runs the tasks a change selects in the stages the command line names, in the order it names them', () => {
    // why: the tests of both libraries pass, so the second stage starts; what the lints of this fixture find does not matter here
    const run = hf(['affected', '-t', 'test', '-t', 'lint', '--base=HEAD'])
    expect(run.stderr.split(/\r?\n/).filter((line) => /^stage \d of /.test(line))).toEqual([
      'stage 1 of 2: test (2 tasks)',
      'stage 2 of 2: lint (2 tasks)',
    ])
  })

  it('leaves generated code formatted', () => {
    expect(hf(['format', '--check', '--all'])).toEqual(expect.objectContaining({ status: 0 }))
  })
})

describe('hf generate make-publishable', () => {
  it('gives the library the targets, the manifest fields and the e2e project a published package needs', () => {
    hf(['generate', 'make-publishable', 'alpha', '--formats=esm,cjs,iife,umd'])
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
        'e2e/alpha/src/iife.spec.ts',
        'e2e/alpha/src/umd.spec.ts',
        'e2e/alpha/tsconfig.json',
      ],
    })
  })

  it('replaces the README the library was created with, which formatting had rewritten, by one that says how to install the package', () => {
    expect(read('libs/alpha/README.md')).toContain('npm install @acme/alpha')
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

  it("states the root manifest's repository in the built manifest, with the library's directory, though the library states none", () => {
    expect({
      stated: readJson<{ repository?: unknown }>('libs/alpha/package.json').repository,
      built: readJson<{ repository?: unknown }>('dist/libs/alpha/package.json').repository,
    }).toEqual({ stated: undefined, built: { ...REPOSITORY, directory: 'libs/alpha' } })
  })

  it('packs the build, installs it into the e2e project and runs its suites', () => {
    const run = hf(['run', 'e2e-alpha:e2e'])
    expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({
      status: 0,
      output: expect.stringMatching(
        /✔ @acme\/alpha CJS[\s\S]*✔ @acme\/alpha ESM[\s\S]*✔ @acme\/alpha IIFE bundle[\s\S]*✔ @acme\/alpha UMD bundle/
      ),
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

describe('the renames and moves hf generate refuses', () => {
  it('refuses a package name another library holds, renaming nothing', () => {
    const run = hf(['generate', 'rename', 'beta', 'delta', '--packageName=@acme/gamma'])
    expect({ refusal: run.stderr, name: readJson<{ name: string }>('libs/beta/project.json').name }).toEqual({
      refusal: expect.stringContaining("Package name already in use: '@acme/gamma' is the package at packages/gamma"),
      name: 'beta',
    })
  })

  it("refuses a move into the library's own directory, leaving the library where it is", () => {
    const run = hf(['generate', 'move', 'gamma', 'packages/gamma', '--newName=inner'])
    expect({ refusal: run.stderr, kept: existsSync(join(consumer.path, 'packages', 'gamma', 'project.json')) }).toEqual({
      refusal: expect.stringContaining('Destination lies inside the project: packages/gamma/inner'),
      kept: true,
    })
  })
})

describe('hf generate application and service', () => {
  it('writes an application that states its kind, with the typecheck and test targets', () => {
    hf(['generate', 'application', 'web', '--description=The site.'])
    expect(readJson('apps/web/project.json')).toEqual(
      expect.objectContaining({ name: 'web', projectType: 'application', targets: { typecheck: {}, test: {} } })
    )
  })

  it('writes a service outside the applications directory, with a configuration its type check covers', () => {
    hf(['generate', 'service', 'api', '--directory=services'])
    expect({
      project: readJson('services/api/project.json'),
      include: readJson<{ include: string[] }>('services/api/tsconfig.lib.json').include,
      configured: existsSync(join(consumer.path, 'services', 'api', 'service.config.ts')),
    }).toEqual({
      project: expect.objectContaining({
        name: 'api',
        projectType: 'service',
        targets: {
          build: { executor: '@hyperfrontend/workspace:service' },
          dev: { command: 'node --import @hyperfrontend/workspace/hooks "{projectRoot}/src/main.ts"' },
          typecheck: {},
          test: {},
        },
      }),
      include: ['src/**/*.ts', 'service.config.ts'],
      configured: true,
    })
  })

  it('reads the service as an application, though it sits outside the applications directory', () => {
    expect(hf(['graph', 'explain', 'api']).stdout).toContain('api (app, services/api)')
  })

  it.each(['web:typecheck', 'web:test', 'web:lint', 'api:typecheck', 'api:test', 'api:lint'])(
    'runs %s as generated and exits 0',
    (task) => {
      const run = hf(['run', task])
      expect({ status: run.status, output: run.stdout + run.stderr }).toEqual({ status: 0, output: expect.any(String) })
    }
  )

  it('names this repository nowhere in what the two generators wrote', () => {
    const files = [...filesUnder('apps/web'), ...filesUnder('services/api')]
    expect(files.filter((file) => /hyperfrontend/i.test(withoutPackageNames(read(file))))).toEqual([])
  })
})
