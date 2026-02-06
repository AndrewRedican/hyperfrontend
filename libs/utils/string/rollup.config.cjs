/**
 * Custom Rollup configuration for isomorphic library builds.
 *
 * This config supports multiple entry points (browser/node) with dual output
 * formats (ESM/CJS). Uses Babel for transpilation and tsc for declarations.
 */
const { resolve } = require('path')
const { execSync } = require('child_process')
const nodeResolve = require('@rollup/plugin-node-resolve')
const { babel } = require('@rollup/plugin-babel')
const { copyFileSync, existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } = require('fs')

const projectRoot = __dirname
const outputPath = resolve(projectRoot, '../../../dist/libs/utils/string')

// Flag to ensure post-build only runs once
let postBuildDone = false

// Plugin to copy assets and generate declarations after build
const postBuildPlugin = () => ({
  name: 'post-build',
  writeBundle: {
    sequential: true,
    order: 'post',
    handler() {
      if (postBuildDone) return
      postBuildDone = true

      // Ensure output directory exists
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true })
      }

      // Generate TypeScript declarations using tsc
      console.log('Generating TypeScript declarations...')
      const tsconfigPath = resolve(projectRoot, 'tsconfig.lib.json')
      execSync(`npx tsc --project ${tsconfigPath} --emitDeclarationOnly --declaration --declarationMap --outDir ${outputPath}`, {
        stdio: 'inherit',
        cwd: projectRoot,
      })

      // Move declarations to correct locations (flatten the nested structure)
      // tsc outputs to libs/utils/string/src/... because rootDir is workspace root
      const nestedDeclarations = resolve(outputPath, 'libs/utils/string/src')
      if (existsSync(nestedDeclarations)) {
        // Copy lib declarations (shared code referenced by browser/node)
        const libSrc = resolve(nestedDeclarations, 'lib')
        const libDest = resolve(outputPath, 'lib')
        if (existsSync(libSrc)) {
          cpSync(libSrc, libDest, { recursive: true, force: true })
        }

        // Move browser declarations
        const browserSrc = resolve(nestedDeclarations, 'browser')
        const browserDest = resolve(outputPath, 'browser')
        if (existsSync(browserSrc)) {
          cpSync(browserSrc, browserDest, { recursive: true, force: true })
        }

        // Move node declarations
        const nodeSrc = resolve(nestedDeclarations, 'node')
        const nodeDest = resolve(outputPath, 'node')
        if (existsSync(nodeSrc)) {
          cpSync(nodeSrc, nodeDest, { recursive: true, force: true })
        }

        // Clean up the nested directory
        rmSync(resolve(outputPath, 'libs'), { recursive: true, force: true })
      }

      // Copy README
      const readmeSrc = resolve(projectRoot, 'README.md')
      if (existsSync(readmeSrc)) {
        copyFileSync(readmeSrc, resolve(outputPath, 'README.md'))
      }

      // Copy LICENSE from workspace root
      const licenseSrc = resolve(projectRoot, '../../../LICENSE.md')
      if (existsSync(licenseSrc)) {
        copyFileSync(licenseSrc, resolve(outputPath, 'LICENSE.md'))
      }

      // Generate package.json with proper exports (no main/module/types since there's no root export)
      const srcPkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf-8'))
      const distPkg = {
        ...srcPkg,
        exports: {
          './package.json': './package.json',
          './browser': {
            types: './browser/index.d.ts',
            import: './browser/index.esm.js',
            require: './browser/index.cjs.js',
          },
          './node': {
            types: './node/index.d.ts',
            import: './node/index.esm.js',
            require: './node/index.cjs.js',
          },
        },
      }
      writeFileSync(resolve(outputPath, 'package.json'), JSON.stringify(distPkg, null, 2))

      console.log('Build complete!')
    },
  },
})

/** @param {string} name Entry point name (browser or node) */
const createEntryConfig = (name, isLast = false) => ({
  input: resolve(projectRoot, `src/${name}/index.ts`),
  output: [
    {
      file: resolve(outputPath, `${name}/index.esm.js`),
      format: 'esm',
      sourcemap: true,
    },
    {
      file: resolve(outputPath, `${name}/index.cjs.js`),
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [
    nodeResolve({ extensions: ['.ts', '.js'] }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.js'],
      presets: ['@babel/preset-typescript'],
    }),
    ...(isLast ? [postBuildPlugin()] : []),
  ],
})

module.exports = [createEntryConfig('browser'), createEntryConfig('node', true)]
