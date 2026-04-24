#!/usr/bin/env node
/**
 * Builds the `cz` and `cl` bin entries for `@hyperfrontend/versioning`.
 *
 * The main library build (`@hyperfrontend/package:build`) discovers entries by
 * scanning for `index.ts` files, which intentionally excludes `src/bin/*.ts`.
 * This script handles the bin entries separately so we can:
 *   1. Bundle each `src/bin/<name>.ts` with its workspace dependencies
 *   2. Emit a single CJS file per bin at `dist/libs/versioning/bin/<name>.js`
 *      (CJS avoids the MODULE_TYPELESS_PACKAGE_JSON warning that would fire on
 *      an ESM `.js` without a matching `"type": "module"` in the dist
 *      package.json — the lib itself still publishes ESM + CJS dual exports.)
 *   3. Prepend `#!/usr/bin/env node` so the file is directly executable
 *   4. Append a thin bootstrap that wires `runCz` / `runCl` to `process.*`
 *   5. chmod the output to 0o755 so the npm `bin` symlink is invokable
 *
 * Runs as a post-step of the main library build — see `project.json`.
 */
import { rollup } from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { chmodSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const thisFile = fileURLToPath(import.meta.url)
const scriptsDir = dirname(thisFile)
const projectRoot = dirname(scriptsDir)
const workspaceRoot = dirname(dirname(projectRoot))
const distPath = join(workspaceRoot, 'dist', 'libs', 'versioning')
const binDistPath = join(distPath, 'bin')

/**
 * @type {ReadonlyArray<{ name: string, runner: string }>}
 *
 * `runner` is the exported function inside the source file (`runCz` / `runCl`)
 * that the appended bootstrap wires to `process.argv` + `process.exit`.
 */
const BINS = [
  { name: 'cz', runner: 'runCz' },
  { name: 'cl', runner: 'runCl' },
]

/**
 * Builds the bootstrap footer appended to each bin. Calls the exported runner
 * with `process.argv.slice(2)` + `process.cwd()` + `process.stderr`, maps the
 * returned exit code to `process.exit`, and surfaces unexpected rejections.
 *
 * @param {string} runner - Name of the exported entry function
 * @returns {string} Bootstrap snippet suitable for `output.footer`
 */
function buildFooter(runner) {
  return [
    `${runner}({ argv: process.argv.slice(2), cwd: process.cwd(), stderr: process.stderr }).then(`,
    '  (code) => { process.exit(code) },',
    '  (error) => {',
    `    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\\n')`,
    '    process.exit(1)',
    '  }',
    ');',
  ].join('\n')
}

mkdirSync(binDistPath, { recursive: true })

for (const bin of BINS) {
  const inputFile = join(projectRoot, 'src', 'bin', `${bin.name}.ts`)
  const outputFile = join(binDistPath, `${bin.name}.js`)

  const bundle = await rollup({
    input: inputFile,
    plugins: [
      json(),
      nodeResolve({ extensions: ['.ts', '.js'], preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: join(projectRoot, 'tsconfig.lib.json'),
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        compilerOptions: {
          baseUrl: workspaceRoot,
          outDir: binDistPath,
        },
      }),
    ],
    onwarn(warning, defaultHandler) {
      if (warning.plugin === 'typescript' && warning.message && warning.message.includes('TS2307')) return
      if (warning.code === 'EMPTY_BUNDLE') return
      defaultHandler(warning)
    },
  })

  await bundle.write({
    file: outputFile,
    format: 'cjs',
    exports: 'named',
    banner: '#!/usr/bin/env node',
    footer: buildFooter(bin.runner),
    sourcemap: false,
  })

  await bundle.close()

  chmodSync(outputFile, 0o755)
  console.log(`  Built bin: ${bin.name}.js`)
}
