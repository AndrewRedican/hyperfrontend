# CLI Module

The `cli` module provides a command-line interface for analyzing JavaScript/TypeScript projects. It exposes the library's capabilities through an easy-to-use terminal interface.

## Usage

```bash
# General usage
project-scope <command> [options]

# Get help
project-scope --help
project-scope <command> --help
```

## Commands

### `analyze`

Analyze project structure and technology stack.

```bash
# Analyze current directory
project-scope analyze

# Analyze specific project
project-scope analyze ./my-project

# Output as JSON
project-scope analyze --format json

# Deep analysis with all detections
project-scope analyze --depth deep

# Include only specific analyses
project-scope analyze --include frameworks,buildTools
```

**Options:**
| Option | Description |
|--------|-------------|
| `--format <text\|json\|yaml>` | Output format (default: text) |
| `--depth <basic\|full\|deep>` | Analysis depth |
| `--include <types>` | Analyses to include (comma-separated) |
| `--exclude <types>` | Analyses to exclude (comma-separated) |

### `config`

Inspect configuration files in the project.

```bash
# List all config files
project-scope config

# Filter by type
project-scope config --type typescript
project-scope config --type eslint,prettier
```

### `deps`

Analyze project dependencies.

```bash
# Show dependency summary
project-scope deps

# Show only production dependencies
project-scope deps --type production

# Show dependency graph
project-scope deps --graph
```

### `tree`

Display file tree visualization.

```bash
# Show project structure
project-scope tree

# Limit depth
project-scope tree --depth 3

# Show specific directory
project-scope tree src
```

## Global Options

| Option       | Short | Description                                  |
| ------------ | ----- | -------------------------------------------- |
| `--help`     | `-h`  | Show help information                        |
| `--version`  | `-v`  | Show version                                 |
| `--verbose`  |       | Enable verbose output                        |
| `--json`     |       | Output as JSON (shorthand for --format json) |
| `--no-color` |       | Disable colored output                       |

## Programmatic Usage

The CLI can also be invoked programmatically:

```typescript
import { run } from '@hyperfrontend/project-scope'

// Analyze current directory
const result = run(['analyze'])

// Analyze with options
const result2 = run(['analyze', './my-project', '--format', 'json'])

// Check result
if (result.exitCode === 0) {
  console.log(result.output)
} else {
  console.error(result.error)
}
```

## Adding Custom Commands

Commands implement the `Command` interface:

```typescript
interface Command {
  name: string
  description: string
  execute(args: string[], globalOptions: GlobalOptions): CommandResult
  getHelp(): string
}
```

## Output Formats

### Text (default)

Human-readable formatted output with colors and structure.

### JSON

Machine-readable JSON output for integration with other tools.

### YAML

Human-readable structured output (when available).
