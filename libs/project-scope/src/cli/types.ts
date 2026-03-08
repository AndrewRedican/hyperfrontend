/**
 * Output format for CLI commands.
 */
export type OutputFormat = 'text' | 'json' | 'yaml'

/**
 * Global CLI options available to all commands.
 */
export interface GlobalOptions {
  /** Show help information */
  help?: boolean
  /** Show version information */
  version?: boolean
  /** Enable verbose output */
  verbose?: boolean
  /** Output as JSON (shorthand for --format json) */
  json?: boolean
  /** Disable colored output */
  noColor?: boolean
}

/**
 * Command execution result.
 */
export interface CommandResult {
  /** Exit code (0 for success, non-zero for errors) */
  exitCode: number
  /** Output message */
  output?: string
  /** Error message */
  error?: string
}

/**
 * CLI command interface.
 */
export interface Command {
  /** Command name */
  name: string
  /** Command description */
  description: string
  /** Execute command with parsed arguments */
  execute(args: string[], globalOptions: GlobalOptions): CommandResult
  /** Get help text for command */
  getHelp(): string
}

/**
 * CLI configuration.
 */
export interface CliConfig {
  /** CLI name */
  name: string
  /** CLI version */
  version: string
  /** Available commands */
  commands: Record<string, Command>
}
