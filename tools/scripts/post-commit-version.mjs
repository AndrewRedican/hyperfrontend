#!/usr/bin/env node

/**
 * Post-commit hook for automatic version management.
 *
 * This script runs after each commit and:
 * 1. Checks if the last commit was already a release commit (skip if so)
 * 2. Gets affected library projects
 * 3. Runs idempotent version check for each affected library
 * 4. If any versions changed, amends the commit to include them
 *
 * Idempotency: Running this multiple times produces the same result.
 * If a library is already at the correct version, no changes are made.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
}

/**
 * Executes a command and returns the output.
 * @param command - The command to execute.
 * @param options - Optional settings.
 * @param options.ignoreError - If true, returns empty string on error instead of throwing.
 * @returns The trimmed output of the command.
 * @throws {Error} Will throw an error if the command fails and ignoreError is not set.
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    }).trim()
  } catch {
    if (options.ignoreError) {
      return ''
    }
    throw error
  }
}

/**
 * Logs a message with optional color.
 * @param message - The message to log.
 * @param color - Optional color code to apply to the message.
 */
function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`)
}

/**
 * Main entry point.
 */
async function main() {
  // Check if this is a version/release commit (skip to avoid recursion)
  const lastCommitMsg = exec('git log -1 --pretty=%B')
  if (lastCommitMsg.startsWith('chore(') && lastCommitMsg.includes('release version')) {
    log('○ Skipping version check for release commit', colors.dim)
    return
  }

  // Check if we're in a rebase or merge
  const gitDir = exec('git rev-parse --git-dir')
  if (existsSync(`${gitDir}/rebase-merge`) || existsSync(`${gitDir}/rebase-apply`) || existsSync(`${gitDir}/MERGE_HEAD`)) {
    log('○ Skipping version check during rebase/merge', colors.dim)
    return
  }

  // Get affected projects since the previous commit
  let affected
  try {
    affected = exec('npx nx show projects --affected --base=HEAD~1 --head=HEAD', { ignoreError: true })
  } catch {
    log('○ Could not determine affected projects', colors.dim)
    return
  }

  if (!affected) {
    log('○ No affected projects', colors.dim)
    return
  }

  const projects = affected.split('\n').filter(Boolean)

  // Filter to only library projects (lib-* or plugin-*)
  const libs = projects.filter((p) => p.startsWith('lib-') || p.startsWith('plugin-'))

  if (libs.length === 0) {
    log('○ No library projects affected', colors.dim)
    return
  }

  log(`\n${colors.blue}📦 Checking versions for: ${libs.join(', ')}${colors.reset}`)

  let hasChanges = false
  const updatedLibs = []

  for (const lib of libs) {
    try {
      const result = exec(`npx nx version ${lib} --skipCommit --skipTag`, { ignoreError: true })

      if (result.includes('version updated')) {
        hasChanges = true
        updatedLibs.push(lib)
        log(`  ✓ ${lib}: version updated`, colors.green)
      } else if (result.includes('already versioned') || result.includes('no commits')) {
        log(`  ○ ${lib}: already versioned`, colors.dim)
      } else {
        log(`  ○ ${lib}: no changes needed`, colors.dim)
      }
    } catch {
      log(`  ⚠ ${lib}: version check failed`, colors.yellow)
    }
  }

  if (hasChanges) {
    try {
      // Stage the version changes
      exec('git add libs/*/package.json libs/*/CHANGELOG.md plugins/*/package.json plugins/*/CHANGELOG.md 2>/dev/null || true')

      // Amend the commit to include version changes
      exec('git commit --amend --no-edit')

      log(`\n${colors.green}✓ Version changes included in commit${colors.reset}`)
      log(`  Updated: ${updatedLibs.join(', ')}`, colors.dim)
    } catch {
      log(`\n${colors.yellow}⚠ Could not amend commit with version changes${colors.reset}`)
      log('  You may need to commit version changes manually', colors.dim)
    }
  } else {
    log(`\n○ All libraries already versioned`, colors.dim)
  }
}

main().catch((error) => {
  console.error('Post-commit version check failed:', error.message)
  // Don't fail the commit, just warn
  process.exit(0)
})
