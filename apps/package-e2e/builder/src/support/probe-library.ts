import { join } from 'node:path'

/** The result of a child process run inside the consumer, as the shared consumer helper reports it. */
export interface ProbeRun {
  /** The child's exit code, or null when a signal ended it. */
  status: number | null
  /** Everything the child wrote to stdout. */
  stdout: string
  /** Everything the child wrote to stderr. */
  stderr: string
}

/** The slice of the shared consumer handle this module drives. */
export interface ProbeConsumer {
  /** Absolute path of the consumer directory. */
  readonly path: string
  /** Writes a file under the consumer directory and returns its absolute path. */
  write(relativePath: string, content: string): string
  /** Runs a file with plain Node from the consumer directory. */
  node(args: readonly string[]): ProbeRun
}

/** The directory, relative to the consumer, the library is written to and built from. */
export const PROBE_LIBRARY_DIR = 'probe-lib'

/** The output directory, relative to the consumer, the build writes to. */
export const PROBE_LIBRARY_OUT = `${PROBE_LIBRARY_DIR}/out`

/** The format counts a successful build reports. */
export const PROBE_LIBRARY_COUNTS = { esm: 2, cjs: 2, iife: 1, umd: 1 }

/** The files the build has to emit, relative to {@link PROBE_LIBRARY_OUT}. */
export const PROBE_LIBRARY_FILES = [
  'index.mjs',
  'index.cjs',
  'index.d.ts',
  'extra/index.mjs',
  'extra/index.cjs',
  'extra/index.d.ts',
  '_dependencies/tslib/index.mjs',
  '_dependencies/tslib/index.cjs',
  '_shared/shared/index.mjs',
  '_shared/shared/index.cjs',
  'bundle/index.iife.min.js',
  'bundle/index.umd.min.js',
  'package.json',
]

/** The library's sources and its build runner, keyed by path relative to the consumer. */
const SOURCES: Record<string, string> = {
  [`${PROBE_LIBRARY_DIR}/package.json`]: `${JSON.stringify(
    {
      name: 'probe-lib',
      version: '1.0.0',
      description: 'consumer fixture',
      license: 'MIT',
      sideEffects: false,
      dependencies: { tslib: '2.8.1' },
      exports: { '.': './src/index.js', './extra': './src/extra/index.js', './package.json': './package.json' },
    },
    null,
    2
  )}\n`,
  [`${PROBE_LIBRARY_DIR}/tsconfig.lib.json`]: `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        rootDir: 'src',
        declaration: true,
        strict: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['src/**/*.ts'],
    },
    null,
    2
  )}\n`,
  [`${PROBE_LIBRARY_DIR}/src/shared.ts`]:
    '/** Shared helper used by both entries. */\nexport const greet = (name: string): string => `hello ${name}`\n',
  [`${PROBE_LIBRARY_DIR}/src/index.ts`]: [
    "import { __assign } from 'tslib'",
    "import { greet } from './shared'",
    'export { greet }',
    '/** Merges two records through a bundled helper. */',
    'export const merge = <A extends object, B extends object>(a: A, b: B): A & B => __assign({}, a, b) as A & B',
    '/** Version marker. */',
    "export const VERSION = '1.0.0'",
    '',
  ].join('\n'),
  [`${PROBE_LIBRARY_DIR}/src/extra/index.ts`]:
    "import { greet } from '../shared'\n/** Shouts a greeting. */\nexport const shout = (name: string): string => greet(name).toUpperCase()\n",
  [`${PROBE_LIBRARY_DIR}/build.mjs`]: [
    "import { build } from '@hyperfrontend/builder'",
    "import { fileURLToPath } from 'node:url'",
    "const root = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\\\/]$/, '')",
    'const result = await build({',
    '  projectRoot: root,',
    '  workspaceRoot: root,',
    "  outputPath: root + '/out',",
    '  esm: { bundleAllDeps: true },',
    '  cjs: { bundleAllDeps: true },',
    "  iife: { globalName: 'Probe' },",
    "  umd: { globalName: 'Probe' },",
    '})',
    'process.stdout.write(JSON.stringify(result.formatCounts))',
    '',
  ].join('\n'),
}

/**
 * Writes the library into the consumer and builds it with the installed builder, under plain Node.
 *
 * @param consumer - The consumer the builder is installed in.
 * @returns The build child's result; its stdout is the JSON format counts on success.
 */
export function buildProbeLibrary(consumer: ProbeConsumer): ProbeRun {
  for (const [relativePath, content] of Object.entries(SOURCES)) consumer.write(relativePath, content)
  return consumer.node([join(consumer.path, PROBE_LIBRARY_DIR, 'build.mjs')])
}

/**
 * Parses the JSON a runner wrote, surfacing the child's stderr when it exited non-zero.
 *
 * @param run - The child's result.
 * @returns The parsed stdout.
 */
export function jsonOf(run: ProbeRun): unknown {
  if (run.status !== 0) throw new Error(`runner exited ${run.status}: ${run.stderr}`)
  return JSON.parse(run.stdout)
}
