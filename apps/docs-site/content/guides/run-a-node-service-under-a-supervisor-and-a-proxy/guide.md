# How to run a Node.js service under a supervisor and a proxy

You will hand a service to whatever runs it in production (a container platform, systemd or a process manager) so that it can start the service, know when to send it traffic, stop it without cutting a request, and tell from the exit code whether starting it again will help. The proxy in front gets the same treatment: its idle timeout and its forwarding header agree with the service. After that a deploy stops showing up as failed requests, and a bad configuration shows up as one named variable instead of a restart loop.

A service that works from a terminal was started by you and stopped with Ctrl+C. In production a supervisor starts it, probes it and ends it with a signal and a deadline, and a proxy holds connections to it. Each of those has a setting with a counterpart inside the service, and a mismatch stays invisible until a deploy or a quiet minute: the signal that never arrives, the kill that lands in the middle of a request, the idle connection the two sides close at different moments. [`@hyperfrontend/server`](/docs/libraries/server) gives a supervisor fixed things to act on through [`runService`](/docs/libraries/server#api-runService): one started line, two probe steps, three exit codes and a stop with a bound. The steps below match each to the setting on the other side.

The examples deploy the service of the package's [Quick Start](/docs/libraries/server#quick-start), compiled to `dist/main.js`, with one route added to it that takes three seconds to answer, so that a request can be in flight when the stop arrives:

```ts
// service.ts
import { setTimeout as sleep } from 'node:timers/promises'

// in the start function, and listed in the router beside `greet`
const slow = route('GET', '/slow', async () => {
  await sleep(3000)
  return jsonResponse(200, { waited: 3000 })
})
```

Every transcript comes from Node.js 24 on Linux, in a shell that exports the service's variables.

## 1. Start it with `node` and nothing in between

Make the supervisor's start command the Node.js binary and the main file:

```bash
node dist/main.js
```

The runner acts on the signals that reach its own process, so the service has to be the process the supervisor signals. A package script, such as `"start": "node dist/main.js"`, puts npm and a shell in front of it. With npm 11, a terminate signal sent to the script ends npm at once and never reaches the service:

```bash
npm run start > service.log &
npm=$!
sleep 2
kill -TERM $npm
wait $npm
echo "npm exited with $?"
curl -s localhost:8080/hello/world
```

```text
npm exited with 143
{"message":"Hello, world"}
```

The supervisor is told that its child died of the signal while the service runs on, never asked to stop and still holding its port, so the next start fails with `EADDRINUSE`. In a container the wrapper is the first process, and when it exits the kernel kills what is left without running a handler. A shell in front does the same as npm: in a Dockerfile, write the [exec form](https://docs.docker.com/reference/dockerfile/#shell-and-exec-form), `CMD ["node", "dist/main.js"]`.

## 2. Wait for the started line

When the start function has resolved, the runner writes one line on standard output: [`started port=8080`](/docs/libraries/server/architecture#lines). Wherever a script has to know that the process is up (a deploy step, a smoke test, a parent process), wait for that line instead of sleeping, and take the port from it:

```bash
node dist/main.js > service.log &
service=$!
until grep -q '^started' service.log; do
  kill -0 $service 2>/dev/null || exit 1
  sleep 0.1
done
sed -n -E 's/^started port=([0-9]+).*$/\1/p' service.log
```

```text
8080
```

The loop gives up when the process is gone, which is how a start that failed ends the wait. Reading the port matters for a service that lets the operating system choose one, with [`asPort({ allowZero: true })`](/docs/libraries/server/environment#api-asPort) and `PORT=0`: the line carries the port that was bound.

The line says that the process is up: its environment was valid and its listener is bound. What the service depends on is the readiness probe's to report, in the next two steps.

## 3. Give `readiness` a check for each dependency

Give [`readiness`](/docs/libraries/server#api-readiness) one of its [`checks`](/docs/libraries/server#api-ReadinessOptions-prop-checks) for each dependency the service cannot answer without. Declare the dependency's address in the service's [environment](/docs/libraries/server/environment#api-defineEnvironment), here with [`asUrl`](/docs/libraries/server/environment#api-asUrl), and pass the check's signal on, since it aborts when the check runs out of time:

```ts
// in the environment, beside the Quick Start's two groups
store: { STORE_URL: required(asUrl()) },
```

```ts
// in the start function, in place of the Quick Start's `ready` and its `listening` flag
const ready = readiness({
  checks: {
    store: async (signal) => {
      const response = await fetch(values.store.STORE_URL, { signal })
      return response.ok
    },
  },
  timeoutMs: 1000,
})
```

## 4. Point the platform's probes at `health` and `readiness`

Keep [`health`](/docs/libraries/server#api-health) and `readiness` first among the [`steps`](/docs/libraries/server#api-ServiceOptions-prop-steps), ahead of any step that checks identity or limits requests, so that a probe is answered whatever else is going on:

```ts
steps: [health(), ready, router({ greet, slow })],
```

Then configure two probes on the platform, one per path:

| Probe     | Path       | Answer                                                         | What the platform does when it fails |
| --------- | ---------- | -------------------------------------------------------------- | ------------------------------------ |
| Liveness  | `/healthz` | 200 `ok` for as long as the process runs; it asks no check     | Restarts the process                 |
| Readiness | `/readyz`  | 200 when every check returned `true`, else 503, with each name | Sends no traffic until it passes     |

Keep the liveness probe on `/healthz`: pointed at `/readyz`, an outage of one dependency would restart every instance at once. Give the platform's readiness probe a timeout above the check's [`timeoutMs`](/docs/libraries/server#api-ReadinessOptions-prop-timeoutMs), which is two seconds unless set, so that the service's answer arrives before the platform stops waiting for it; the [default of a Kubernetes probe](https://kubernetes.io/docs/concepts/workloads/pods/probes/) is one second.

With the dependency down, the process is alive and not ready:

```bash
curl -s -w ' %{http_code}\n' localhost:8080/healthz
curl -s -w ' %{http_code}\n' localhost:8080/readyz
```

```text
ok 200
{"ready":false,"checks":{"store":false}} 503
```

Once the dependency answers, the same request to `/readyz` prints `{"ready":true,"checks":{"store":true}} 200`.

## 5. Set the restart policy from the exit code

The process ends with one of [three exit codes](/docs/libraries/server/architecture#exit-codes), and each asks something different of the supervisor:

- **0: do nothing.** The stop was asked for, by a signal or a closed IPC channel, and went well. No restart, no alert.
- **1: restart.** A start failed, something faulted while the service ran, or a stop failed. The block on standard error names the [cause](/docs/libraries/server/architecture#lines).
- **78: leave it stopped and alert.** The deployment cannot start as it is, and every restart ends the same way until the deployment changes. For an environment that is wrong, the block names each variable that is missing or malformed and what was expected of it, never a value:

```bash
env -u HELLO_GREETING node dist/main.js
echo "exit code $?"
```

```text
fatal cause=environment
  - HELLO_GREETING (hello) is missing; expected non-empty text.
exit code 78
```

Under [systemd](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) that policy is `Restart=on-failure` with `RestartPreventExitStatus=78`. A policy that cannot tell one failure from another, such as Docker's `on-failure` or a Kubernetes Deployment, restarts on 78 as well, with a growing delay; there, alert on a last exit code of 78.

Two more codes reach a supervisor from outside the service. 137 means the process was killed, most often because the stop outlasted the supervisor's wait, which step 6 sizes. 143 means a terminate signal ended a process that had no handler for it, which is the wrapper of step 1.

## 6. Size the stop from the supervisor's wait inward

A stop has three deadlines, one inside the other. The service lets requests in flight run for [`graceMs`](/docs/libraries/server#api-ServiceOptions-prop-graceMs) and then cuts them. The runner gives the whole stop [`stopTimeoutMs`](/docs/libraries/server#api-ServiceDefinition-prop-stopTimeoutMs), and then takes up to two seconds to flush its output. The supervisor waits its own time after the terminate signal and then kills. Order them so that each has room to finish inside the next:

```text
graceMs < stopTimeoutMs < the supervisor's wait - 2 seconds
```

The [defaults](/docs/libraries/server/architecture#bounds) are 10 and 15 seconds, which need a supervisor that waits more than 17. Look up what yours waits:

| Supervisor | Waits by default | Set with                                                   |
| ---------- | ---------------- | ---------------------------------------------------------- |
| Docker     | 10 seconds       | `docker stop -t`, or `stop_grace_period` in a Compose file |
| Kubernetes | 30 seconds       | `terminationGracePeriodSeconds` in the pod's spec          |
| systemd    | 90 seconds       | `TimeoutStopSec=` in the unit                              |
| Railway    | 10 seconds       | `drainingSeconds` in the service's deploy settings         |

Then raise the supervisor's wait, or lower the two bounds to fit under it. For a wait of 10 seconds:

```ts
export const service = defineService({
  // the environment
  stopTimeoutMs: 7000,
  async start(values, context) {
    // the routes and the readiness step
    return startService(
      {
        port: values.http.PORT,
        steps: [health(), ready, router({ greet, slow })],
        graceMs: 5000,
      },
      { report: context.report }
    )
  },
})
```

Choose `graceMs` as the longest request you are willing to wait for on a deploy. A wrong order shows in the log and the exit code:

- **A request outlasts `graceMs`:** it is cut, and its request line reads `status=0 outcome=shutdown`. The exit code is still 0, so search the log for that [outcome](/docs/libraries/server#api-RequestOutcome) to learn that the grace is too short.
- **`stopTimeoutMs` is not above `graceMs`:** the runner gives up first. Standard error reads `fatal cause=stop-timeout`, no `stopped` line is written and the exit code is 1.
- **The supervisor's wait is the shortest:** the log ends at the `stopping` line and the exit code is 137. A supervisor that ends its wait by repeating the signal, as Railway does once `drainingSeconds` is set, gets `fatal cause=forced` and exit code 1 instead.

## 7. Take the instance out of rotation before the signal

Take the instance out of the proxy's rotation before the terminate signal reaches it. From the `stopping` line on the service [accepts no new connection](/docs/libraries/server/architecture#connections-and-the-drain), so a proxy that still routes to the instance gets a refused connection. On a platform that does both at the same moment, delay the signal with a hook that runs before the stop, and add that delay to the supervisor's wait.

## 8. Set the idle timeout above the proxy's

Set [`keepAliveTimeoutMs`](/docs/libraries/server#api-ServiceOptions-prop-keepAliveTimeoutMs) above the proxy's idle timeout for its connections to the service, so that the proxy retires an idle connection before the service closes it:

```ts
graceMs: 5000,
keepAliveTimeoutMs: 65000,
```

The other way round, the proxy sends a request down a connection the service is closing, and the client gets a 502 now and then. The default is 5 seconds and a load balancer commonly keeps a connection for 60, so the default is the wrong way round for most of them. Railway's edge retires an idle connection after 4 seconds, so there the default stands. Every response says what is in effect: with the option above, `curl -si` shows `Keep-Alive: timeout=65`.

## 9. Count the proxies that write the forwarded address

Set [`trustedProxyHops`](/docs/libraries/server#api-ServiceOptions-prop-trustedProxyHops) to the number of proxies in front that append to [`X-Forwarded-For`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For):

```ts
keepAliveTimeoutMs: 65000,
trustedProxyHops: 1,
```

The option decides what a step reads as the caller's [`address`](/docs/libraries/server#api-ClientInfo-prop-address): with the default of 0 that is the socket's peer, which behind a proxy is the proxy; with 1 it is the last entry of the header, the one your proxy wrote. A request that arrives with `X-Forwarded-For: 198.51.100.1, 203.0.113.7` then reads as `203.0.113.7`, whatever the client put in front. Count exactly: one hop too many believes an entry the client wrote. Count the entries the proxy writes, which can be more than one: Railway's edge replaces the header with the client's address followed by its own, so a service there sets 2.

## 10. On Windows, stop it through its console or an IPC channel

Windows delivers no terminate signal, and a process ended by another one stops at once. [Two things begin a graceful stop there](/docs/libraries/server/architecture#signals-by-platform): Ctrl+C or Ctrl+Break in the console the service runs in, and the close of the process's IPC channel. Under a supervisor that offers no console, start the service from a launcher that opens the channel with [`'ipc'`](https://nodejs.org/api/child_process.html#optionsstdio) and closes it with [`disconnect()`](https://nodejs.org/api/child_process.html#subprocessdisconnect) when it is asked to stop:

```js
// launch.mjs
import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['dist/main.js'], {
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
})
child.on('exit', (code) => process.exit(code ?? 1))

const stop = () => {
  if (child.connected) child.disconnect()
}
process.on('SIGINT', stop)
process.on('SIGBREAK', stop)
```

Wire `stop` to whatever your supervisor offers as a stop request; this one listens for the two console events. The launcher passes on the service's exit code, and the channel also closes when the launcher itself is ended, which stops the service the same way. The channel is Node.js's own on every platform, and this run of the launcher is from Linux:

```bash
node launch.mjs &
launcher=$!
sleep 1
kill -INT $launcher
wait $launcher
echo "exit code $?"
```

```text
started port=8080
stopping cause=disconnect
stopped
exit code 0
```

## Check it worked

Run the stop your supervisor will run, by hand, with a request in flight. Start the service as in step 2, then send a request that takes a while, send the terminate signal while it is open, and read the exit code and the log:

```bash
curl -s -w '\n' localhost:8080/slow &
sleep 1
kill -TERM $service
wait $service
echo "exit code $?"
cat service.log
```

```text
{"waited":3000}
exit code 0
started port=8080
stopping cause=signal signal=SIGTERM
request method=GET route=slow status=200 outcome=sent ms=3008
stopped
```

Four things make this a pass: the client got its answer, the request line with `outcome=sent` comes after the `stopping` line, the `stopped` line is there, and the exit code is 0. Then start it once without a required variable and see exit code 78 with the variable named, as in step 5.

Last, repeat the stop through the supervisor itself: deploy, open a slow request through the proxy, and ask the supervisor to stop the instance. The same four things hold, the supervisor reports exit code 0 and not 137 or 143, and the proxy answers the slow request instead of a 502.
