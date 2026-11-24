# Statistics service

Serves the npm download history of every published hyperfrontend package. It collects the daily counts from npm on a schedule, holds them in memory, and answers one route that the documentation site reads: the downloads page in the browser, and the refresh that extends the site's committed history.

It is a service on [`@hyperfrontend/server`](../../libs/server/README.md), built by the [`service`](../../libs/workspace/src/executors/service/README.md) executor into one file that runs with `node` alone, and deployed to Railway by the pipeline. It checks the shape of npm's answers with [`@hyperfrontend/json-utils`](../../libs/utils/json/README.md), waits between turns on a timer of [`@hyperfrontend/time-utils`](../../libs/utils/time/README.md), and writes its own lines through [`@hyperfrontend/logging`](../../libs/logging/README.md).

## What it answers

| Request                              | Answer                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `GET /v1/downloads`                  | The whole history: every tracked package npm knows, with one count for each day        |
| `GET /v1/downloads?since=2026-11-17` | The same, holding only that day and the days after it; `400` when it is not a real day |
| `GET /healthz`                       | `ok`, from the moment the service listens                                              |
| `GET /readyz`                        | `200` once the first collection has finished, `503` before                             |

Until the first collection has finished, which takes a minute or two, the history route answers `503` with a `Retry-After` header. An answer may be reused for five minutes. Responses carry the CORS grant for the origins the environment lists and for no other.

```json
{
  "version": 1,
  "frontier": "2026-11-23",
  "collectedAt": "2026-11-24T19:11:51.779Z",
  "revalidationDays": 7,
  "packages": [
    {
      "package": "@hyperfrontend/features",
      "created": "2026-06-28",
      "total": 8697,
      "days": [{ "day": "2026-11-23", "downloads": 257 }]
    }
  ]
}
```

`frontier` is the newest day npm has finished counting. `total` sums every day the package has, whatever `since` asked for: a reader that holds older days of its own compares it with its own sum, and asks for the whole history when the two differ. `revalidationDays` tells a reader that keeps older days of its own how many of the most recent ones to replace.

## How it collects

Once an hour it asks npm which day it has most recently counted: one request. When that day is new, it reads every package's history again, whole, one request at a time with a second between them. It reads the whole history and not only the new day because npm reports a day it has not processed yet as zero and fills it in later, sometimes more than a week later. A collection that fails is logged and leaves the held history as it was; the next turn tries again.

The packages it tracks are the `immutable.packages` list of [`service.config.ts`](service.config.ts), which the `workspace/statistics-packages` lint rule holds to the workspace's publishable libraries. A package npm does not know yet is reported as pending and asked about again on the next turn.

Nothing is stored: the history lives in memory and is collected again when the service starts.

## Environment

| Variable                     | Default   | What it sets                                                                                                                                          |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STATISTICS_ALLOWED_ORIGINS` | required  | The origins a browser may read the service from, separated by commas                                                                                  |
| `PORT`                       | `8080`    | The port it listens on                                                                                                                                |
| `HOST`                       | `0.0.0.0` | The interface it listens on                                                                                                                           |
| `STATISTICS_COLLECT_EVERY`   | `1h`      | The time between two turns of the schedule, such as `30m`                                                                                             |
| `STATISTICS_REQUEST_GAP`     | `1s`      | The pause between two requests to npm, a courtesy to a public API; keep it in production                                                              |
| `STATISTICS_LOG_LEVEL`       | `log`     | How much it writes of its own: `log` writes a collection that brought something new and one that failed; `info` adds the turns that found nothing new |

Started without a variable it requires, or with a malformed one, the service names the variable, starts nothing and exits with code 78.

## Running it

```bash
STATISTICS_ALLOWED_ORIGINS=http://localhost:3000 npx hf run service-statistics:dev
```

That runs it from its sources and collects from npm for real. To build it and run the build:

```bash
npx hf run service-statistics:build
STATISTICS_ALLOWED_ORIGINS=http://localhost:3000 node dist/apps/statistics/main.cjs
```

Beside the runner's own lines it writes one line for each collection that brought something new, and one on standard error for each that failed. With `STATISTICS_LOG_LEVEL=info` it also writes the hourly turns that found nothing new:

```text
started port=8080 release=6e600618...
collection outcome=collected frontier=2026-11-23 packages=23 pending=0 requests=48
collection outcome=unchanged frontier=2026-11-23 packages=23 pending=0 requests=1
```

To point a local documentation site at it, set `NEXT_PUBLIC_STATISTICS_ORIGIN=http://localhost:8080` for the site. The specs never reach npm: they drive the whole service through the runner against a fake one.

```bash
npx hf run service-statistics:test
```

## Deployment

The service is declared in [`.railway/railway.ts`](../../.railway/railway.ts) and named by `metadata.deploy` in [`project.json`](project.json). On `main` the pipeline deploys it after its own tasks have passed, whenever a change can alter its build. Railway starts it with `node dist/apps/statistics/main.cjs`, so a terminate signal reaches the process and it finishes the requests in flight before it exits.
