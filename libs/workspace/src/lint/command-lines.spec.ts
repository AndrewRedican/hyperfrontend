import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { createCommandLinesWorkspace } from './__test-utils__/command-lines-workspace'
import rule, { MESSAGES } from './command-lines'

const workspace = createCommandLinesWorkspace()
const LIBRARY = join(workspace.node, 'project.json')
const TOOL = join(workspace.tool, 'tools', 'app', 'project.json')

testRule(rule, {
  valid: [
    {
      name: 'lines both shells read alike',
      path: LIBRARY,
      text: '{\n  "targets": {\n    "build": {"command": "npm run build"},\n    "lint": {"executor": "@hyperfrontend/workspace:run-commands", "options": {"command": "node tools/lint/bin/lint.ts \\"apps/*/project.json\\" 2>&1 && echo done | cat", "commands": ["npx tsc --noEmit", {"command": "node x.js"}, {"description": "none"}, 3]}},\n    "odd": {"options": "not an object", "commands": "not a list"},\n    "text": "not an object"\n  }\n}',
    },
    { name: 'targets that are not an object', path: LIBRARY, text: '{"targets":[]}' },
    { name: 'a project file that is not an object', path: LIBRARY, text: '[]' },
    {
      name: 'a file that is not a project file',
      path: join(workspace.node, 'package.json'),
      text: '{\n  "targets": {\n    "all": {"command": "FOO=1 node \'x.js\'; echo $HOME & type C:\\\\x *.ts"}\n  }\n}',
    },
    {
      name: 'a project the default does not select',
      path: join(workspace.unpublished, 'project.json'),
      text: '{\n  "targets": {\n    "all": {"command": "FOO=1 node \'x.js\'; echo $HOME & type C:\\\\x *.ts"}\n  }\n}',
    },
    {
      name: 'a tool the default does not select',
      path: TOOL,
      text: '{\n  "targets": {\n    "all": {"command": "FOO=1 node \'x.js\'; echo $HOME & type C:\\\\x *.ts"}\n  }\n}',
    },
  ],
  invalid: [
    {
      name: 'each line one shell reads differently, wherever a target writes it',
      path: LIBRARY,
      text: '{\n  "targets": {\n    "one": {"command": "node \'x.js\'"},\n    "two": {"options": {"command": "CI=1 node x.js"}},\n    "three": {"options": {"commands": ["echo %PATH%", {"command": "echo ${HOME}"}]}},\n    "four": {"command": "npm run a; npm run b"},\n    "five": {"command": "npm run a & npm run b"},\n    "six": {"command": "rm *.tgz"},\n    "seven": {"command": "node tools\\\\x.js"}\n  }\n}',
      errors: [
        { message: MESSAGES.singleQuote, line: 3, column: 24 },
        { message: MESSAGES.envPrefix, line: 4, column: 36 },
        { message: MESSAGES.variable, line: 5, column: 40 },
        { message: MESSAGES.variable, line: 5, column: 67 },
        { message: MESSAGES.separator, line: 6, column: 25 },
        { message: MESSAGES.separator, line: 7, column: 25 },
        { message: MESSAGES.glob, line: 8, column: 24 },
        { message: MESSAGES.backslash, line: 9, column: 26 },
      ],
    },
    {
      name: 'every problem of one line, each once',
      path: LIBRARY,
      text: '{\n  "targets": {\n    "all": {"command": "FOO=1 node \'x.js\'; echo $HOME & type C:\\\\x *.ts"}\n  }\n}',
      errors: [
        { message: MESSAGES.envPrefix, line: 3, column: 24 },
        { message: MESSAGES.variable, line: 3, column: 24 },
        { message: MESSAGES.singleQuote, line: 3, column: 24 },
        { message: MESSAGES.separator, line: 3, column: 24 },
        { message: MESSAGES.backslash, line: 3, column: 24 },
        { message: MESSAGES.glob, line: 3, column: 24 },
      ],
    },
    {
      name: 'a tool the include option selects',
      path: TOOL,
      text: '{\n  "targets": {\n    "one": {"command": "node \'x.js\'"}\n  }\n}',
      options: { include: [{ files: ['tools/**'] }] },
      errors: [{ message: MESSAGES.singleQuote, line: 3, column: 24 }],
    },
  ],
})
