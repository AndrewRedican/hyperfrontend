# CLI Design

> **Document**: 10-cli-design.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Command-line interface

---

## Overview

The CLI provides direct access to project analysis and VFS operations from the command line:

- Project analysis and reporting
- Configuration inspection
- Dry-run file modifications
- Interactive exploration

---

## Command Structure

```
project-scope <command> [options]

Commands:
  analyze     Analyze project structure and tech stack
  tree        Show file tree with changes
  config      Inspect configuration files
  deps        Analyze dependencies
  validate    Validate project structure

Global Options:
  --help, -h      Show help
  --version, -v   Show version
  --verbose       Enable verbose output
  --json          Output as JSON
  --no-color      Disable colored output
```

---

## Commands

### `analyze` - Project Analysis

```
project-scope analyze [path] [options]

Arguments:
  path              Project path to analyze (default: current directory)

Options:
  --format, -f      Output format: "text" | "json" | "yaml" (default: text)
  --depth, -d       Analysis depth: "basic" | "full" | "deep" (default: full)
  --include, -i     Include specific analyses (comma-separated)
  --exclude, -e     Exclude specific analyses (comma-separated)

Analysis Types (for --include/--exclude):
  frameworks        Detect frameworks (React, Vue, Angular, etc.)
  buildTools        Detect build tools (Vite, Webpack, etc.)
  testing          Detect testing frameworks
  monorepo         Detect monorepo tools
  dependencies     Analyze dependencies
  git              Git repository information
  entryPoints      Discover entry points
  configs          List configuration files

Examples:
  project-scope analyze
  project-scope analyze ./my-project --format json
  project-scope analyze --include frameworks,buildTools
  project-scope analyze --exclude dependencies --depth basic
```

#### Output Example (Text)

```
Project Analysis: my-react-app
==============================

Type:           Application
Workspace:      Standalone

Frameworks:
  • React 18.2.0 (confidence: 95%)
    └─ Next.js 14.0.0

Build Tool:
  • Vite 5.0.0

Testing:
  • Jest 29.0.0
  • Cypress 13.0.0

Entry Points:
  • src/main.tsx (app)
  • src/index.ts (main)

Configurations:
  • tsconfig.json
  • vite.config.ts
  • jest.config.ts
  • .eslintrc.cjs

Dependencies:
  Production:    42
  Development:   31
  Peer:          3
```

#### Output Example (JSON)

```json
{
  "name": "my-react-app",
  "projectType": "application",
  "workspaceType": "standalone",
  "frameworks": [
    {
      "id": "react",
      "name": "React",
      "version": "18.2.0",
      "confidence": 95,
      "metaFrameworks": ["nextjs"]
    }
  ],
  "buildTool": {
    "id": "vite",
    "name": "Vite",
    "version": "5.0.0",
    "confidence": 100
  },
  "testingFrameworks": [
    { "id": "jest", "name": "Jest", "version": "29.0.0" },
    { "id": "cypress", "name": "Cypress", "version": "13.0.0" }
  ],
  "entryPoints": [
    { "path": "src/main.tsx", "type": "app" },
    { "path": "src/index.ts", "type": "main" }
  ]
}
```

---

### `tree` - File Tree

```
project-scope tree [path] [options]

Arguments:
  path              Directory to show (default: current directory)

Options:
  --depth, -d       Maximum depth (default: 3)
  --pattern, -p     Glob pattern to match
  --ignore          Patterns to ignore (comma-separated)
  --dirs-only       Show directories only
  --files-only      Show files only
  --size            Show file sizes
  --modified        Show modification times

Examples:
  project-scope tree
  project-scope tree src --depth 5
  project-scope tree --pattern "*.ts" --ignore "*.spec.ts"
  project-scope tree --dirs-only
```

#### Output Example

```
.
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useForm.ts
│   ├── pages/
│   │   ├── Home.tsx
│   │   └── About.tsx
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── favicon.ico
├── package.json
├── tsconfig.json
└── vite.config.ts

4 directories, 12 files
```

---

### `config` - Configuration Inspection

```
project-scope config [path] [options]

Arguments:
  path              Project path (default: current directory)

Options:
  --type, -t        Filter by config type (tsconfig, eslint, etc.)
  --show-contents   Show file contents
  --validate        Validate configurations

Examples:
  project-scope config
  project-scope config --type tsconfig
  project-scope config --show-contents
  project-scope config --validate
```

#### Output Example

```
Configuration Files
===================

TypeScript:
  • tsconfig.json (root)
  • tsconfig.app.json (extends root)
  • tsconfig.spec.json (extends root)

Linting:
  • .eslintrc.cjs
  • .prettierrc

Build:
  • vite.config.ts

Testing:
  • jest.config.ts
  • cypress.config.ts

Package:
  • package.json

Validation:
  ✓ All configurations valid
```

---

### `deps` - Dependency Analysis

```
project-scope deps [path] [options]

Arguments:
  path              Project path (default: current directory)

Options:
  --type, -t        Type: "production" | "development" | "peer" | "all"
  --outdated        Check for outdated packages
  --issues          Show dependency issues
  --graph           Show dependency graph
  --depth, -d       Graph depth (default: 2)

Examples:
  project-scope deps
  project-scope deps --type production
  project-scope deps --outdated
  project-scope deps --graph --depth 3
```

#### Output Example (List)

```
Dependencies
============

Production (42):
  react                 18.2.0
  react-dom             18.2.0
  react-router-dom      6.20.0
  axios                 1.6.0
  ...

Development (31):
  typescript            5.3.0
  vite                  5.0.0
  @types/react          18.2.42
  jest                  29.7.0
  ...

Peer (3):
  react                 ^18.0.0
  react-dom             ^18.0.0
  node                  >=18.0.0
```

#### Output Example (Graph)

```
Dependencies Graph
==================

my-app
├── react@18.2.0
│   ├── react-is@18.2.0
│   └── scheduler@0.23.0
├── react-dom@18.2.0
│   ├── react@18.2.0 (peer)
│   └── scheduler@0.23.0 (peer)
└── axios@1.6.0
    ├── form-data@4.0.0
    └── proxy-from-env@1.1.0
```

---

### `validate` - Project Validation

```
project-scope validate [path] [options]

Arguments:
  path              Project path (default: current directory)

Options:
  --fix             Attempt to fix issues
  --strict          Enable strict validation
  --rules           Comma-separated rules to check

Validation Rules:
  package           Validate package.json
  tsconfig          Validate TypeScript config
  structure         Validate project structure
  deps              Validate dependencies
  exports           Validate package exports

Examples:
  project-scope validate
  project-scope validate --fix
  project-scope validate --strict --rules package,tsconfig
```

#### Output Example

```
Validation Results
==================

✓ package.json is valid
✓ tsconfig.json is valid
✓ Project structure is valid

⚠ Warnings:
  • Missing "engines" field in package.json
  • tsconfig.json: unused "baseUrl" setting

✗ Errors:
  • Missing "exports" field in package.json

Summary: 3 passed, 2 warnings, 1 error
```

---

## Implementation

### CLI Entry Point

```typescript
#!/usr/bin/env node
// bin/project-scope.ts

import { parseArgs } from 'node:util'
import { analyzeCommand } from './commands/analyze'
import { treeCommand } from './commands/tree'
import { configCommand } from './commands/config'
import { depsCommand } from './commands/deps'
import { validateCommand } from './commands/validate'
import { printHelp, printVersion } from './help'

const commands: Record<string, Command> = {
  analyze: analyzeCommand,
  tree: treeCommand,
  config: configCommand,
  deps: depsCommand,
  validate: validateCommand,
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle global flags
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp()
    return
  }

  if (args.includes('--version') || args.includes('-v')) {
    printVersion()
    return
  }

  const commandName = args[0]
  const command = commands[commandName]

  if (!command) {
    console.error(`Unknown command: ${commandName}`)
    console.error('Run "project-scope --help" for usage information.')
    process.exit(1)
  }

  try {
    const exitCode = await command.execute(args.slice(1))
    process.exit(exitCode)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
```

### Command Interface

```typescript
// cli/types.ts

/**
 * CLI command interface.
 */
export interface Command {
  /** Command name */
  name: string
  /** Command description */
  description: string
  /** Execute command */
  execute(args: string[]): Promise<number>
  /** Print command help */
  printHelp(): void
}

/**
 * Global CLI options.
 */
export interface GlobalOptions {
  verbose: boolean
  json: boolean
  noColor: boolean
}

/**
 * Output formatter interface.
 */
export interface Formatter {
  text(data: unknown): string
  json(data: unknown): string
  yaml(data: unknown): string
}
```

### Analyze Command Implementation

```typescript
// cli/commands/analyze.ts
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { analyzeProject } from '../../analyze'
import { formatAnalysisText, formatAnalysisJson } from '../formatters'
import type { Command, GlobalOptions } from '../types'

export const analyzeCommand: Command = {
  name: 'analyze',
  description: 'Analyze project structure and tech stack',

  async execute(args: string[]): Promise<number> {
    const { values, positionals } = parseArgs({
      args,
      options: {
        format: { type: 'string', short: 'f', default: 'text' },
        depth: { type: 'string', short: 'd', default: 'full' },
        include: { type: 'string', short: 'i' },
        exclude: { type: 'string', short: 'e' },
        verbose: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    })

    const projectPath = positionals[0] ? resolve(positionals[0]) : process.cwd()

    // Parse include/exclude
    const include = values.include?.split(',').map((s) => s.trim())
    const exclude = values.exclude?.split(',').map((s) => s.trim())

    // Run analysis
    const result = analyzeProject(projectPath, {
      depth: values.depth as 'basic' | 'full' | 'deep',
      include,
      exclude,
      verbose: values.verbose,
    })

    // Format output
    const format = values.json ? 'json' : (values.format as string)

    switch (format) {
      case 'json':
        console.log(formatAnalysisJson(result))
        break

      case 'yaml':
        console.log(formatAnalysisYaml(result))
        break

      case 'text':
      default:
        console.log(formatAnalysisText(result))
        break
    }

    return 0
  },

  printHelp(): void {
    console.log(`
project-scope analyze [path] [options]

Analyze project structure and tech stack.

Arguments:
  path              Project path (default: current directory)

Options:
  --format, -f      Output format: text, json, yaml (default: text)
  --depth, -d       Analysis depth: basic, full, deep (default: full)
  --include, -i     Include specific analyses (comma-separated)
  --exclude, -e     Exclude specific analyses (comma-separated)
  --verbose         Enable verbose output
  --json            Output as JSON (shortcut for --format json)
`)
  },
}
```

### Output Formatters

```typescript
// cli/formatters/analysis.ts
import type { AnalysisResult, FrameworkInfo, BuildToolInfo } from '../../models'

/**
 * Format analysis result as text.
 */
export function formatAnalysisText(result: AnalysisResult): string {
  const lines: string[] = []

  // Header
  const name = result.name || result.root.split('/').pop() || 'Project'
  lines.push(`Project Analysis: ${name}`)
  lines.push('='.repeat(30))
  lines.push('')

  // Basic info
  lines.push(`Type:           ${formatProjectType(result.projectType)}`)
  lines.push(`Workspace:      ${formatWorkspaceType(result.workspaceType)}`)
  lines.push('')

  // Frameworks
  if (result.frameworks.length > 0) {
    lines.push('Frameworks:')
    for (const framework of result.frameworks) {
      lines.push(`  • ${framework.name} ${framework.version ?? ''} (confidence: ${framework.confidence}%)`)

      if (framework.metaFrameworks?.length) {
        for (const meta of framework.metaFrameworks) {
          lines.push(`    └─ ${meta.name} ${meta.version ?? ''}`)
        }
      }
    }
    lines.push('')
  }

  // Build tool
  if (result.buildTool) {
    lines.push('Build Tool:')
    lines.push(`  • ${result.buildTool.name} ${result.buildTool.version ?? ''}`)
    lines.push('')
  }

  // Testing
  if (result.testingFrameworks?.length) {
    lines.push('Testing:')
    for (const framework of result.testingFrameworks) {
      lines.push(`  • ${framework.name} ${framework.version ?? ''}`)
    }
    lines.push('')
  }

  // Entry points
  if (result.entryPoints?.length) {
    lines.push('Entry Points:')
    for (const entry of result.entryPoints.slice(0, 5)) {
      lines.push(`  • ${entry.path} (${entry.type})`)
    }
    if (result.entryPoints.length > 5) {
      lines.push(`  ... and ${result.entryPoints.length - 5} more`)
    }
    lines.push('')
  }

  // Configurations
  if (result.configurations?.length) {
    lines.push('Configurations:')
    for (const config of result.configurations.slice(0, 8)) {
      lines.push(`  • ${config.path}`)
    }
    if (result.configurations.length > 8) {
      lines.push(`  ... and ${result.configurations.length - 8} more`)
    }
    lines.push('')
  }

  // Dependencies summary
  if (result.dependencies) {
    lines.push('Dependencies:')
    const deps = result.dependencies
    lines.push(`  Production:    ${deps.production?.length ?? 0}`)
    lines.push(`  Development:   ${deps.development?.length ?? 0}`)
    lines.push(`  Peer:          ${deps.peer?.length ?? 0}`)
  }

  return lines.join('\n')
}

/**
 * Format analysis result as JSON.
 */
export function formatAnalysisJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2)
}

function formatProjectType(type: string): string {
  const labels: Record<string, string> = {
    application: 'Application',
    library: 'Library',
    e2e: 'E2E Tests',
    tool: 'Tool',
    plugin: 'Plugin',
    unknown: 'Unknown',
  }
  return labels[type] ?? type
}

function formatWorkspaceType(type: string): string {
  const labels: Record<string, string> = {
    standalone: 'Standalone',
    nx: 'NX Workspace',
    turbo: 'Turborepo',
    lerna: 'Lerna',
    pnpm: 'PNPM Workspace',
    npm: 'NPM Workspace',
    rush: 'Rush',
    monorepo: 'Monorepo',
  }
  return labels[type] ?? type
}
```

---

## Build Configuration

```typescript
// libs/project-scope/project.json (partial)
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/package:build",
      "options": {
        "entryPoints": [
          "src/index.ts",
          "src/cli/index.ts"
        ],
        "bin": {
          "project-scope": "./dist/cli/index.cjs"
        }
      }
    }
  }
}
```

### package.json Bin Field

```json
{
  "name": "@hyperfrontend/project-scope",
  "bin": {
    "project-scope": "./dist/cli/index.cjs"
  }
}
```

---

## Related Documents

- [API Design](./02-api-design.md)
- [Build Configuration](./11-build-configuration.md)
- [Testing Strategy](./09-testing-strategy.md)
