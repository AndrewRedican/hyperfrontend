import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-signal-kill-in-tests.ts'

const PATH = '/root/a.spec.ts'

const message = (signal: string): string =>
  `Send '${signal}' to a child the test spawned with sendSignal from '@hyperfrontend/testing/process' and compare its exit with cleanSignalExit: Windows ends the child outright instead of delivering the signal, so the exit it reports differs by platform.`

/**
 * The error a case's text gives at the first occurrence of a span.
 *
 * @param text - The case's text
 * @param span - The reported text
 * @param signal - The signal the message names
 * @returns The expected error
 */
const at = (text: string, span: string, signal: string): { message: string; line: number; column: number; endColumn: number } => {
  const before = text.slice(0, text.indexOf(span))
  const line = before.split(/\r?\n/).length
  const column = before.length - before.lastIndexOf('\n')
  return { message: message(signal), line, column, endColumn: column + span.length }
}

const NAMED = "import { spawn } from 'node:child_process'\nconst child = spawn('node', ['server.js'])\nchild.kill('SIGINT')"
const ASSIGNED = "import { fork } from 'child_process'\nlet child\nchild = fork('worker.js')\nawait done\nchild.kill('SIGTERM')"
const NAMESPACE = "import * as cp from 'node:child_process'\nconst child = cp.execFile('ls')\nchild.kill('SIGINT')"
const DEFAULT = "import cp from 'node:child_process'\ncp.exec('ls').kill('SIGHUP')"
const QUOTED = "import { 'spawn' as start } from 'node:child_process'\nconst child = start('x')\nchild.kill('SIGINT')"

testRule(rule, {
  valid: [
    { name: 'SIGKILL, which ends a child the same way everywhere', path: PATH, text: NAMED.replace('SIGINT', 'SIGKILL') },
    {
      name: 'a signal to a stand-in the test did not spawn',
      path: PATH,
      text: "import { createFakeChildProcess } from '@hyperfrontend/testing/process'\nconst child = createFakeChildProcess()\nchild.kill('SIGINT')",
    },
    {
      name: 'a signal to a member rather than a variable',
      path: PATH,
      text: "import { spawn } from 'node:child_process'\nconst started = [spawn('x')]\nstarted[0]?.kill('SIGTERM')",
    },
    {
      name: 'a signal that is no string literal, or none',
      path: PATH,
      text: "import { spawn } from 'node:child_process'\nconst child = spawn('x')\nchild.kill(signal)\nchild.kill(2)\nchild.kill()",
    },
    {
      name: 'a spawn imported from another module',
      path: PATH,
      text: "import { spawn } from './fake-spawn.ts'\nconst child = spawn('x')\nchild.kill('SIGINT')",
    },
    {
      name: 'a name from a child-process module that spawns nothing',
      path: PATH,
      text: "import { execSync } from 'node:child_process'\nconst child = execSync('x')\nchild.kill('SIGINT')",
    },
    {
      name: 'a namespace call to a function that spawns nothing',
      path: PATH,
      text: "import * as cp from 'node:child_process'\nconst child = cp.spawnSync('x')\nchild.kill('SIGINT')",
    },
    {
      name: 'a child from an import-equals declaration',
      path: PATH,
      text: "import cp = require('node:child_process')\nconst child = cp.spawn('x')\nchild.kill('SIGINT')",
    },
    {
      name: 'a kill through a computed member or on a call that is no spawn',
      path: PATH,
      text: "import { spawn } from 'node:child_process'\nconst child = spawn('x')\nchild['kill']('SIGINT')\nstart(child).kill('SIGINT')",
    },
    { name: 'a variable the file never binds', path: PATH, text: "child.kill('SIGINT')" },
    {
      name: 'calls through a child-process import that spawn nothing',
      path: PATH,
      text: "import cp from 'node:child_process'\nimport { spawn } from 'node:child_process'\nconst a = cp('x')\na.kill('SIGINT')\nconst b = cp['spawn']('x')\nb.kill('SIGINT')\nconst c = deep.cp.spawn('x')\nc.kill('SIGINT')\nconst d = spawn.default('x')\nd.kill('SIGINT')",
    },
    {
      name: 'a signal without the SIG prefix, a bare kill call and a child received as a parameter',
      path: PATH,
      text: "import { spawn } from 'node:child_process'\nconst child = spawn('x')\nchild.kill('TERM')\nkill('SIGINT')\nfunction stop(started) {\n  started.kill('SIGINT')\n}",
    },
  ],
  invalid: [
    { name: 'a signal to a child a named spawn created', path: PATH, text: NAMED, errors: [at(NAMED, "child.kill('SIGINT')", 'SIGINT')] },
    {
      name: 'a signal to a child assigned after its declaration',
      path: PATH,
      text: ASSIGNED,
      errors: [at(ASSIGNED, "child.kill('SIGTERM')", 'SIGTERM')],
    },
    {
      name: 'a signal to a child a namespace import spawned',
      path: PATH,
      text: NAMESPACE,
      errors: [at(NAMESPACE, "child.kill('SIGINT')", 'SIGINT')],
    },
    {
      name: 'a signal to the result of a spawn through a default import',
      path: PATH,
      text: DEFAULT,
      errors: [at(DEFAULT, "cp.exec('ls').kill('SIGHUP')", 'SIGHUP')],
    },
    {
      name: 'a signal to a child a spawn imported by a string literal created',
      path: PATH,
      text: QUOTED,
      errors: [at(QUOTED, "child.kill('SIGINT')", 'SIGINT')],
    },
  ],
})
