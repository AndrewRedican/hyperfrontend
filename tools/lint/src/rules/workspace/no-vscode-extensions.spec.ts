import { testRule } from '@hyperfrontend/linter/testing'
import rule from './no-vscode-extensions.ts'

const PATH = '/root/.devcontainer/devcontainer.json'
const ALLOW = { allow: ['anthropic.claude-code'] }

const message = (id: string): string =>
  `The devcontainer installs the VS Code extension '${id}', which the workspace does not allow. Remove it, or add it to the rule's 'allow' option if the workspace relies on it.`

const listed =
  '{ "customizations": { "vscode": { "extensions": ["Anthropic.Claude-Code", "eamodio.gitlens", 3, "esbenp.prettier-vscode"] } } }\n'
const allowedOnly = '{ "customizations": { "vscode": { "extensions": ["anthropic.claude-code"] } } }\n'

testRule(rule, {
  valid: [
    { name: 'an allowed extension', path: PATH, text: allowedOnly, options: ALLOW },
    { name: 'an empty extension list', path: PATH, text: '{ "customizations": { "vscode": { "extensions": [] } } }\n' },
    { name: 'no extension list', path: PATH, text: '{ "customizations": { "vscode": { "settings": {} } } }\n' },
    { name: 'a customization that is no object', path: PATH, text: '{ "customizations": "vscode" }\n' },
    {
      name: 'an extension list that is no array',
      path: PATH,
      text: '{ "customizations": { "vscode": { "extensions": "eamodio.gitlens" } } }\n',
    },
    { name: 'a document that is no object', path: PATH, text: '["eamodio.gitlens"]\n' },
  ],
  invalid: [
    {
      name: 'every extension the allow list leaves out, matching the allowed one whatever its case and skipping entries that are no string',
      path: PATH,
      text: listed,
      options: ALLOW,
      errors: [
        { message: message('eamodio.gitlens'), line: 1, column: listed.indexOf('"eamodio') + 1, endColumn: listed.indexOf(', 3') + 1 },
        {
          message: message('esbenp.prettier-vscode'),
          line: 1,
          column: listed.indexOf('"esbenp') + 1,
          endColumn: listed.indexOf('] }') + 1,
        },
      ],
    },
    {
      name: 'every extension when no allow list is configured',
      path: PATH,
      text: allowedOnly,
      errors: [{ message: message('anthropic.claude-code'), line: 1, column: allowedOnly.indexOf('"anthropic') + 1 }],
    },
  ],
})
