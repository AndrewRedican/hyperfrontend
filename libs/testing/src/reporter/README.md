# reporter

Node's own spec reporter with the per-evaluation coverage summary held back, so the merged table the runner prints is the only coverage verdict a run shows.

## Usage

Name the entry with `--test-reporter`, the way any custom reporter is named. The runner behind [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) passes it by file URL and sends it to stdout, with Node's lcov reporter writing the raw report to a file beside it:

```bash
node --import @hyperfrontend/testing/hooks --test \
  --experimental-test-coverage \
  --test-reporter=@hyperfrontend/testing/reporter \
  --test-reporter-destination=stdout \
  'src/**/*.spec.ts'
```

The output is exactly what Node's [`spec`](https://nodejs.org/api/test.html#test-reporters) reporter prints, test by test and suite by suite, minus the coverage report that would otherwise follow the summary.

## Design

Node reports each evaluation of a module as a file of its own. A suite that calls [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) therefore produces one coverage entry per generation, and a summary that counts every line of the module once per evaluation while crediting only the evaluation that ran it. The runner prints a merged table instead, built from the lcov report by [`mergeLcov`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-mergeLcov) and [`renderCoverageTable`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-renderCoverageTable), and printing both would show two different answers for the same run.

The reporter is an async generator that wraps an instance of Node's spec reporter: every event from the runner's stream is forwarded to it except `test:coverage`, and whatever the spec reporter renders is yielded as it comes. Nothing about pass, fail, skip, todo or diagnostic output is changed.
