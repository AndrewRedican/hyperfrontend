#!/usr/bin/env node
/**
 * Documentation Generation Script
 *
 * This script generates documentation content from:
 * 1. TypeDoc API documentation (JSON format)
 * 2. README.md files from each library
 * 3. ARCHITECTURE.md files
 *
 * Output is written to apps/docs-site/.generated/
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const WORKSPACE_ROOT = path.resolve(__dirname, '../../..')
const OUTPUT_DIR = path.resolve(__dirname, '../.generated')
const DOCS_OUTPUT = path.join(OUTPUT_DIR, 'docs')
const API_OUTPUT = path.join(OUTPUT_DIR, 'api')

interface LibraryConfig {
  name: string
  packageName: string
  slug: string
  srcPath: string
  entryPoints: string[]
  category: 'core' | 'supporting' | 'utils' | 'plugin'
}

const LIBRARIES: LibraryConfig[] = [
  // Core libraries
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    srcPath: 'libs/nexus',
    entryPoints: ['src/index.ts'],
    category: 'core',
  },
  {
    name: 'Network Protocol',
    packageName: '@hyperfrontend/network-protocol',
    slug: 'network-protocol',
    srcPath: 'libs/network-protocol',
    entryPoints: ['src/index.ts'],
    category: 'core',
  },
  {
    name: 'Cryptography',
    packageName: '@hyperfrontend/cryptography',
    slug: 'cryptography',
    srcPath: 'libs/cryptography',
    entryPoints: ['src/browser/index.ts', 'src/node/index.ts', 'src/common/index.ts'],
    category: 'core',
  },
  // Supporting libraries
  {
    name: 'State Machine',
    packageName: '@hyperfrontend/state-machine',
    slug: 'state-machine',
    srcPath: 'libs/state-machine',
    entryPoints: ['src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Logging',
    packageName: '@hyperfrontend/logging',
    slug: 'logging',
    srcPath: 'libs/logging',
    entryPoints: ['src/index.ts'],
    category: 'supporting',
  },
  {
    name: 'Web Worker',
    packageName: '@hyperfrontend/web-worker',
    slug: 'web-worker',
    srcPath: 'libs/web-worker',
    entryPoints: ['src/index.ts'],
    category: 'supporting',
  },
  // Utils sub-packages
  {
    name: 'Data Utils',
    packageName: '@hyperfrontend/data-utils',
    slug: 'data-utils',
    srcPath: 'libs/utils/data',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Function Utils',
    packageName: '@hyperfrontend/function-utils',
    slug: 'function-utils',
    srcPath: 'libs/utils/function',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Immutable API',
    packageName: '@hyperfrontend/immutable-api',
    slug: 'immutable-api',
    srcPath: 'libs/utils/immutable-api',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'List Utils',
    packageName: '@hyperfrontend/list-utils',
    slug: 'list-utils',
    srcPath: 'libs/utils/list',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Random Generator',
    packageName: '@hyperfrontend/random-generator',
    slug: 'random-generator',
    srcPath: 'libs/utils/random-generator',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'String Utils',
    packageName: '@hyperfrontend/string-utils',
    slug: 'string-utils',
    srcPath: 'libs/utils/string',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'Time Utils',
    packageName: '@hyperfrontend/time-utils',
    slug: 'time-utils',
    srcPath: 'libs/utils/time',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  {
    name: 'UI Utils',
    packageName: '@hyperfrontend/ui-utils',
    slug: 'ui-utils',
    srcPath: 'libs/utils/ui',
    entryPoints: ['src/index.ts'],
    category: 'utils',
  },
  // Plugin
  {
    name: 'Features Plugin',
    packageName: '@hyperfrontend/features',
    slug: 'features',
    srcPath: 'plugins/features',
    entryPoints: ['src/index.ts'],
    category: 'plugin',
  },
]

/**
 * Create a directory if it doesn't exist
 *
 * @param dir - The directory path to create
 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Extract README.md content from a library
 *
 * @param lib - The library configuration
 * @returns An object with the content and whether it exists
 */
function extractReadme(lib: LibraryConfig): { content: string; exists: boolean } {
  const readmePath = path.join(WORKSPACE_ROOT, lib.srcPath, 'README.md')

  if (!fs.existsSync(readmePath)) {
    console.log(`  ⚠ No README.md found for ${lib.name}`)
    return { content: '', exists: false }
  }

  const content = fs.readFileSync(readmePath, 'utf-8')
  return { content, exists: true }
}

/**
 * Extract ARCHITECTURE.md content from a library if it exists
 *
 * @param lib - The library configuration
 * @returns An object with the content and whether it exists
 */
function extractArchitecture(lib: LibraryConfig): { content: string; exists: boolean } {
  const archPath = path.join(WORKSPACE_ROOT, lib.srcPath, 'ARCHITECTURE.md')

  if (!fs.existsSync(archPath)) {
    return { content: '', exists: false }
  }

  const content = fs.readFileSync(archPath, 'utf-8')
  return { content, exists: true }
}

/**
 * Run TypeDoc to generate API documentation JSON for a library
 *
 * @param lib - The library configuration
 * @returns True if TypeDoc succeeded, false otherwise
 */
function generateTypeDoc(lib: LibraryConfig): boolean {
  const libPath = path.join(WORKSPACE_ROOT, lib.srcPath)
  const entryPoints = lib.entryPoints.map((ep) => path.join(libPath, ep))

  // Check if all entry points exist
  const missingEntryPoints = entryPoints.filter((ep) => !fs.existsSync(ep))
  if (missingEntryPoints.length > 0) {
    console.log(`  ⚠ Missing entry points for ${lib.name}: ${missingEntryPoints.join(', ')}`)
    return false
  }

  const outputPath = path.join(API_OUTPUT, lib.slug, 'api.json')
  ensureDir(path.dirname(outputPath))

  try {
    const cmd = [
      'npx typedoc',
      '--json',
      outputPath,
      '--excludePrivate',
      '--excludeInternal',
      '--excludeNotDocumented false',
      ...entryPoints,
    ].join(' ')

    console.log(`  → Running TypeDoc for ${lib.name}`)
    execSync(cmd, { cwd: WORKSPACE_ROOT, stdio: 'pipe' })
    return true
  } catch {
    console.log(`  ⚠ TypeDoc failed for ${lib.name}`)
    return false
  }
}

interface LibraryDoc {
  name: string
  packageName: string
  slug: string
  category: string
  readme: string | null
  architecture: string | null
  hasApi: boolean
}

/**
 * Main documentation generation function that processes all libraries
 */
function generateDocs() {
  console.log('📚 Generating documentation...\n')

  // Ensure output directories exist
  ensureDir(OUTPUT_DIR)
  ensureDir(DOCS_OUTPUT)
  ensureDir(API_OUTPUT)

  const libraryDocs: LibraryDoc[] = []

  for (const lib of LIBRARIES) {
    console.log(`📦 Processing ${lib.name}...`)

    // Extract README
    const readme = extractReadme(lib)

    // Extract Architecture doc (if exists)
    const architecture = extractArchitecture(lib)

    // Generate TypeDoc API
    const hasApi = generateTypeDoc(lib)

    // Save README content
    if (readme.exists) {
      const readmeOutput = path.join(DOCS_OUTPUT, lib.slug, 'readme.md')
      ensureDir(path.dirname(readmeOutput))
      fs.writeFileSync(readmeOutput, readme.content)
    }

    // Save Architecture content
    if (architecture.exists) {
      const archOutput = path.join(DOCS_OUTPUT, lib.slug, 'architecture.md')
      ensureDir(path.dirname(archOutput))
      fs.writeFileSync(archOutput, architecture.content)
    }

    libraryDocs.push({
      name: lib.name,
      packageName: lib.packageName,
      slug: lib.slug,
      category: lib.category,
      readme: readme.exists ? `${lib.slug}/readme.md` : null,
      architecture: architecture.exists ? `${lib.slug}/architecture.md` : null,
      hasApi,
    })

    console.log('')
  }

  // Extract root architecture document
  console.log('📐 Processing root ARCHITECTURE.md...')
  const rootArchPath = path.join(WORKSPACE_ROOT, 'ARCHITECTURE.md')
  if (fs.existsSync(rootArchPath)) {
    const archContent = fs.readFileSync(rootArchPath, 'utf-8')
    fs.writeFileSync(path.join(DOCS_OUTPUT, 'architecture.md'), archContent)
    console.log('  ✓ Root architecture document extracted\n')
  }

  // Extract CONTRIBUTING.md
  console.log('📝 Processing CONTRIBUTING.md...')
  const contributingPath = path.join(WORKSPACE_ROOT, 'CONTRIBUTING.md')
  if (fs.existsSync(contributingPath)) {
    const contributingContent = fs.readFileSync(contributingPath, 'utf-8')
    fs.writeFileSync(path.join(DOCS_OUTPUT, 'contributing.md'), contributingContent)
    console.log('  ✓ Contributing guide extracted\n')
  }

  // Write manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    libraries: libraryDocs,
    rootDocs: {
      architecture: fs.existsSync(path.join(DOCS_OUTPUT, 'architecture.md')),
      contributing: fs.existsSync(path.join(DOCS_OUTPUT, 'contributing.md')),
    },
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))

  console.log('✅ Documentation generation complete!')
  console.log(`   Output: ${OUTPUT_DIR}`)
}

// Run if executed directly
if (require.main === module) {
  generateDocs()
}

export { generateDocs, LIBRARIES }
