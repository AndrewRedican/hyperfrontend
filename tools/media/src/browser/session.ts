import type { Browser, BrowserContext, Page } from 'playwright-core'
import type { Determinism, ReadyGate, Viewport } from '../models/capture'
import type { ConsoleMessageRecord, ConsoleRecord } from '../models/report'
import { mediaError } from '../lib/media-error'
import { ExitCode } from '../models/exit-code'
import { applyDeterminism } from './determinism'

/** Everything needed to open one page and get it to the point of being recorded. */
export interface SessionOptions {
  /** Size the page is rendered at. */
  viewport: Viewport
  /** Directory video is written to, or an empty string to record nothing. */
  videoDir: string
  /** Overrides applied before any page script runs. */
  determinism?: Determinism
  /** Document to open. */
  url: string
  /** Condition that says the page is worth recording. */
  ready?: ReadyGate
  /** Ceiling used when the readiness gate names none. */
  readyTimeoutMs: number
}

/** An open page, plus what has been observed about it so far. */
export interface OpenSession {
  /** The browser context, which owns the video file. */
  context: BrowserContext
  /** The open page. */
  page: Page
  /** What the page has said for itself. */
  consoleRecord: ConsoleRecord
  /** Every line the page printed, oldest first, capped so a noisy page cannot exhaust memory. */
  messages: readonly ConsoleMessageRecord[]
  /** When the context was created, which is also when video capture began. */
  openedAtMs: number
  /** When the readiness gate passed. */
  readyAtMs: number
}

/**
 * Open a page, pin it, and wait until it is worth looking at.
 *
 * Console output is counted from before navigation so that an error thrown
 * during boot is still attributed to the run. That count is what lets a scene
 * refuse to encode a recording of a page that was quietly broken.
 *
 * @param browser - A launched browser.
 * @param options - Viewport, determinism, destination and readiness gate.
 * @returns The open page and what has been observed about it.
 * @throws {Error} When the readiness gate never passes.
 */
export async function openSession(browser: Browser, options: SessionOptions): Promise<OpenSession> {
  const context = await browser.newContext({
    viewport: options.viewport,
    ...(options.videoDir === '' ? {} : { recordVideo: { dir: options.videoDir, size: options.viewport } }),
  })
  const openedAtMs = performance.now()
  const page = await context.newPage()
  const consoleRecord: ConsoleRecord = { errors: 0, warnings: 0, pageErrors: 0 }
  const messages: ConsoleMessageRecord[] = []
  const remember = (type: string, text: string): void => {
    if (messages.length < 500) {
      messages.push({ type, text })
    }
  }
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleRecord.errors += 1
    }
    if (message.type() === 'warning') {
      consoleRecord.warnings += 1
    }
    remember(message.type(), message.text())
  })
  page.on('pageerror', (error) => {
    consoleRecord.pageErrors += 1
    remember('pageerror', error.message)
  })

  await applyDeterminism(page, options.determinism)
  await page.goto(options.url, { waitUntil: 'load' })
  if (options.ready !== undefined) {
    const timeout = options.ready.timeoutMs ?? options.readyTimeoutMs
    try {
      await page.waitForSelector(options.ready.selector, { timeout, state: 'attached' })
    } catch {
      await context.close()
      throw mediaError(ExitCode.SceneFailed, `"${options.ready.selector}" never appeared within ${timeout}ms at ${options.url}`)
    }
  }
  return { context, page, consoleRecord, messages, openedAtMs, readyAtMs: performance.now() }
}
