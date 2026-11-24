import type { ServiceDefinition } from '@hyperfrontend/server'
import type { History } from './collector/collect'
import { createLogger } from '@hyperfrontend/logging'
import { cors, defineService, health, readiness, route, router, startService } from '@hyperfrontend/server'
import { asDuration, asPort, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'
import config from '../service.config'
import { createNpmClient } from './collector/client'
import { collect } from './collector/collect'
import { MIN_REQUEST_GAP_MS, NpmStatsError } from './collector/model'
import { answerDownloads } from './downloads'
import { asLogLevel } from './log-level'
import { asOrigins } from './origins'
import { pause, runOnSchedule } from './schedule'

/** Time one request to npm may take before it is given up as unanswered, in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000

/** What the service hands its transport with every request. */
export interface TransportInit {
  /** Aborts when the service is asked to stop or the request has run out of time */
  signal: AbortSignal
}

/** What the service takes from the process it runs in, so a spec can stand in for each. */
export interface StatisticsDeps {
  /** The transport requests to npm go through */
  fetch: (url: string, init: TransportInit) => Promise<Response>
  /** The current time in milliseconds since the epoch */
  now: () => number
  /** Writes one whole line of the service's own to its standard output */
  write: (line: string) => void
  /** Writes one whole line of the service's own to its standard error */
  writeError: (line: string) => void
}

/** The variables the service reads, by group. */
const shape = {
  http: {
    // why: port 0 is allowed so that a spec can let the operating system pick a free port
    PORT: optional(asPort({ allowZero: true }), 8080),
    HOST: optional(asText(), '0.0.0.0'),
  },
  site: {
    STATISTICS_ALLOWED_ORIGINS: required(asOrigins()),
  },
  collector: {
    // why: npm counts a day once, some hours after the UTC midnight that ends it, so an hourly probe of one request finds the new day within the hour it appears
    STATISTICS_COLLECT_EVERY: optional(asDuration(), 3_600_000),
    STATISTICS_REQUEST_GAP: optional(asDuration(), MIN_REQUEST_GAP_MS),
  },
  log: {
    // why: at `log` a collection that brought something new and one that failed are written, and the hourly turn that found nothing new, an `info` line, is not
    STATISTICS_LOG_LEVEL: optional(asLogLevel(), 'log'),
  },
}

/** The environment the service reads: where it listens, which sites may read it from a browser, and how it paces itself against npm. */
export const environment = defineEnvironment(shape)

/**
 * What a failed collection is called in the service's log.
 *
 * @param error - Whatever the collection threw
 * @returns The collector's own classification, or `fault` for anything it did not classify
 */
function failureKind(error: unknown): string {
  return error instanceof NpmStatsError ? error.kind : 'fault'
}

/**
 * Define the statistics service: the history of npm downloads of the tracked packages, collected on a schedule and served to the site.
 *
 * The service listens at once and collects in the background, so the
 * platform's health probe is answered from the first moment while the
 * readiness probe and the history route wait for the first collection. One
 * collection runs at a time, on the schedule the environment sets. A failed
 * one is logged and leaves the held history as it was; the next turn tries
 * again. Its own lines go through a logger at the level the environment sets. Asked to stop, the service ends its schedule, lets the collection in
 * flight unwind, and only then closes its listener.
 *
 * @param deps - See {@link StatisticsDeps}
 * @returns The service as the runner runs it
 *
 * @example
 * ```typescript
 * void runService(defineStatistics({ fetch: (url, init) => fetch(url, init), now: dateNow, write: toStandardOutput, writeError: toStandardError }))
 * ```
 */
export function defineStatistics(deps: StatisticsDeps): ServiceDefinition<typeof shape> {
  return defineService({
    environment,
    // why: a built service refuses to boot unless the section it runs with is the one it was built with, so the section of the configuration is handed over whole
    immutable: config.immutable,
    start: async (values, context) => {
      let held: History | null = null
      // why: a failure goes to standard error at the level nothing but `none` silences, and the two outcomes that are not failures go to standard output at a level each
      const logger = createLogger(deps.writeError, undefined, deps.write, deps.write)
      logger.setLogLevel(values.log.STATISTICS_LOG_LEVEL)
      const client = createNpmClient({
        fetch: (url) => deps.fetch(url, { signal: AbortSignal.any([context.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) }),
        sleep: (ms) => pause(ms, context.signal),
        minGapMs: values.collector.STATISTICS_REQUEST_GAP,
      })

      const collectOnce = async (): Promise<void> => {
        const before = client.requestCount
        try {
          const collection = await collect({ packages: config.immutable.packages, client, now: deps.now(), held })
          held = collection.history
          const line = `collection outcome=${collection.outcome} frontier=${held.frontier} packages=${held.packages.size} pending=${collection.pending.length} requests=${client.requestCount - before}\n`
          if (collection.outcome === 'collected') logger.log(line)
          else logger.info(line)
        } catch (error) {
          // why: a collection cut short by the stop it was asked for has not failed, and the runner's own lines say why the service is ending
          if (context.signal.aborted) return
          logger.error(
            `collection outcome=failed kind=${failureKind(error)} requests=${client.requestCount - before}\n  ${String(error)}\n`
          )
        }
      }

      const handle = await startService(
        {
          port: values.http.PORT,
          host: values.http.HOST,
          steps: [
            health(),
            readiness({ checks: { collected: () => held !== null } }),
            cors({ origins: values.site.STATISTICS_ALLOWED_ORIGINS }),
            router({
              downloads: route('GET', '/v1/downloads', (request) => answerDownloads(held, request.query.get('since'))),
            }),
          ],
        },
        { report: context.report }
      )
      const schedule = runOnSchedule({ task: collectOnce, everyMs: values.collector.STATISTICS_COLLECT_EVERY, signal: context.signal })
      return {
        port: handle.port,
        close: async (): Promise<void> => {
          await schedule
          await handle.close()
        },
      }
    },
  })
}
