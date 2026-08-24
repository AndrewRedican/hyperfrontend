#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { logger } from '@hyperfrontend/logging'

logger.setLogLevel('log')

const WORKSPACE_ROOT = resolve(__dirname, '../../..')
const DOCS_SITE_ROOT = resolve(__dirname, '..')

/**
 * Mirror the workspace media directory into the site's public directory.
 *
 * The committed copy lives in the workspace `assets/` directory so it sits
 * beside the other repository-facing artwork and is referenced from a single
 * place. Next only serves what is under `public/`, so the files are copied in
 * at build time rather than committed twice. The destination is removed first
 * so a deleted asset does not linger in a deployment.
 */
function copyMedia(): void {
  const source = join(WORKSPACE_ROOT, 'assets', 'media')
  const target = join(DOCS_SITE_ROOT, 'public', 'media')
  rmSync(target, { recursive: true, force: true })
  if (!existsSync(source)) {
    logger.log('No assets/media directory, nothing to copy')
    return
  }
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  logger.log(`Copied ${source} to ${target}`)
}

copyMedia()
