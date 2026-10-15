import type { TypeDocNode, TypeDocOutput } from '@/components/api-reference/types'
import { describe, expect, it } from 'vitest'
import { renderApiReferenceMarkdown } from './api-markdown'

const PACKAGE = '@hyperfrontend/pkg'

/**
 * A class with every member kind the renderer tells apart: a constructor, a property, an
 * accessor and a documented method with a parameter, a return value and an example.
 */
const EVENTS: TypeDocNode = {
  id: 10,
  name: 'Events',
  variant: 'declaration',
  kind: 128,
  flags: {},
  comment: {
    summary: [{ kind: 'text', text: 'Dispatches events to handlers.' }],
    blockTags: [{ tag: '@example', name: 'Registering', content: [{ kind: 'code', text: '```typescript\nnew Events()\n```' }] }],
  },
  children: [
    {
      id: 11,
      name: 'constructor',
      variant: 'declaration',
      kind: 512,
      flags: {},
      signatures: [
        { id: 12, name: 'Events', variant: 'signature', kind: 16384, flags: {}, type: { type: 'reference', name: 'Events', target: 10 } },
      ],
    },
    {
      id: 13,
      name: 'dispatch',
      variant: 'declaration',
      kind: 1024,
      flags: { isPublic: true, isReadonly: true },
      sources: [{ fileName: 'events.ts', line: 30, character: 2 }],
      comment: { summary: [{ kind: 'text', text: 'Reduces an action.' }] },
      type: { type: 'intrinsic', name: 'unknown' },
    },
    {
      id: 14,
      name: 'current',
      variant: 'declaration',
      kind: 262144,
      flags: { isPublic: true },
      sources: [{ fileName: 'events.ts', line: 20, character: 2 }],
      getSignature: {
        id: 15,
        name: 'current',
        variant: 'signature',
        kind: 524288,
        flags: {},
        comment: { summary: [{ kind: 'text', text: 'The latest state.' }] },
        type: {
          type: 'union',
          types: [
            { type: 'intrinsic', name: 'string' },
            { type: 'literal', value: null },
          ],
        },
      },
    },
    {
      id: 16,
      name: 'on',
      variant: 'declaration',
      kind: 2048,
      flags: { isPublic: true },
      signatures: [
        {
          id: 17,
          name: 'on',
          variant: 'signature',
          kind: 4096,
          flags: {},
          comment: {
            summary: [{ kind: 'text', text: 'Registers a handler.' }],
            blockTags: [
              { tag: '@param', name: 'event', content: [{ kind: 'text', text: 'Which event to listen for' }] },
              { tag: '@returns', content: [{ kind: 'text', text: 'Nothing; the handler is kept' }] },
              { tag: '@example', name: 'Listening', content: [{ kind: 'code', text: "```typescript\nevents.on('done', () => {})\n```" }] },
            ],
          },
          parameters: [
            {
              id: 18,
              name: 'event',
              variant: 'param',
              kind: 32768,
              flags: {},
              type: {
                type: 'union',
                types: [
                  { type: 'intrinsic', name: 'string' },
                  { type: 'intrinsic', name: 'number' },
                ],
              },
            },
          ],
          type: { type: 'intrinsic', name: 'void' },
        },
      ],
    },
  ],
}

/** An interface whose method signature TypeDoc records as a method member. */
const OPTIONS: TypeDocNode = {
  id: 40,
  name: 'Options',
  variant: 'declaration',
  kind: 256,
  flags: {},
  comment: { summary: [{ kind: 'text', text: 'What a caller may set.' }] },
  children: [
    {
      id: 41,
      name: 'label',
      variant: 'declaration',
      kind: 1024,
      flags: { isOptional: true },
      comment: { summary: [{ kind: 'text', text: 'A name to show.' }] },
      type: { type: 'intrinsic', name: 'string' },
    },
    {
      id: 42,
      name: 'resize',
      variant: 'declaration',
      kind: 2048,
      flags: {},
      signatures: [
        {
          id: 43,
          name: 'resize',
          variant: 'signature',
          kind: 4096,
          flags: {},
          comment: { summary: [{ kind: 'text', text: 'Reports a new size.' }] },
          parameters: [{ id: 44, name: 'width', variant: 'param', kind: 32768, flags: {}, type: { type: 'intrinsic', name: 'number' } }],
          type: { type: 'intrinsic', name: 'void' },
        },
      ],
    },
  ],
}

/** A function with a parameter and a return value. */
const CREATE: TypeDocNode = {
  id: 20,
  name: 'create',
  variant: 'declaration',
  kind: 64,
  flags: {},
  signatures: [
    {
      id: 21,
      name: 'create',
      variant: 'signature',
      kind: 4096,
      flags: {},
      comment: {
        summary: [{ kind: 'text', text: 'Makes an instance.' }],
        blockTags: [
          { tag: '@param', name: 'options', content: [{ kind: 'text', text: 'What to make it with' }] },
          { tag: '@returns', content: [{ kind: 'text', text: 'The instance' }] },
        ],
      },
      parameters: [
        {
          id: 22,
          name: 'options',
          variant: 'param',
          kind: 32768,
          flags: { isOptional: true },
          type: { type: 'reference', name: 'Options', target: 40 },
        },
      ],
      type: { type: 'reference', name: 'Events', target: 10 },
    },
  ],
}

/** A type alias. */
const HANDLER: TypeDocNode = {
  id: 30,
  name: 'Handler',
  variant: 'declaration',
  kind: 2097152,
  flags: {},
  comment: { summary: [{ kind: 'text', text: 'Called on every event.' }] },
  type: { type: 'intrinsic', name: 'unknown' },
}

/**
 * A reference to a declaration exported from another module.
 *
 * @param target - The declaration's id
 * @param name - The export name
 * @returns The reference node
 */
function reference(target: number, name: string): TypeDocNode {
  return { id: target + 1000, name, variant: 'reference', kind: 4194304, flags: {}, target }
}

/**
 * A module node.
 *
 * @param name - What TypeDoc calls the module
 * @param children - Its exports
 * @returns A declaration of the module kind carrying those exports
 */
function moduleNode(name: string, children: TypeDocNode[]): TypeDocNode {
  return { id: name.length, name, variant: 'declaration', kind: 2, flags: {}, children }
}

/** A package with a root entry point that re-exports what its secondary entry points declare. */
const MULTI: TypeDocOutput = {
  schemaVersion: '2.0',
  id: 0,
  name: PACKAGE,
  variant: 'project',
  kind: 1,
  flags: {},
  children: [
    moduleNode(PACKAGE, [EVENTS, CREATE, HANDLER, reference(40, 'Options')]),
    moduleNode(`${PACKAGE}/events`, [reference(10, 'Events')]),
    moduleNode(`${PACKAGE}/models`, [OPTIONS]),
  ],
}

/** A package with one entry point, whose exports are the project's own children. */
const SINGLE: TypeDocOutput = {
  schemaVersion: '2.0',
  id: 0,
  name: PACKAGE,
  variant: 'project',
  kind: 1,
  flags: {},
  children: [CREATE, HANDLER],
}

/**
 * How many times a line occurs in a document.
 *
 * @param markdown - The document
 * @param line - The exact line
 * @returns The count
 */
function occurrences(markdown: string, line: string): number {
  return markdown.split('\n').filter((candidate) => candidate === line).length
}

describe('renderApiReferenceMarkdown', () => {
  describe('package page of a multi-entry package', () => {
    const markdown = renderApiReferenceMarkdown(MULTI, { packageName: PACKAGE }) ?? ''

    it('groups by entry point under the reference heading', () => {
      expect(markdown.split('\n').filter((line) => line.startsWith('### '))).toEqual([
        `### ${PACKAGE}`,
        `### ${PACKAGE}/events`,
        `### ${PACKAGE}/models`,
      ])
    })

    it('documents a declaration once, under the most specific entry point that exports it', () => {
      expect(occurrences(markdown, '##### Events')).toBe(1)
    })

    it('places the declaration under the specific entry point rather than the root', () => {
      expect(markdown.indexOf('##### Events')).toBeGreaterThan(markdown.indexOf(`### ${PACKAGE}/events`))
    })

    it('lists re-exports by name under the root, pointing at the entry point that owns them', () => {
      expect(markdown).toContain(`- \`${PACKAGE}/events\`: \`Events\``)
    })

    it('keeps declarations only the root exports under the root', () => {
      expect(markdown.indexOf('##### create')).toBeLessThan(markdown.indexOf(`### ${PACKAGE}/events`))
    })
  })

  describe('secondary entry point page', () => {
    const markdown = renderApiReferenceMarkdown(MULTI, { packageName: PACKAGE, subpath: 'events' }) ?? ''

    it('opens with the same heading the page renders', () => {
      expect(markdown.startsWith('## API Reference\n')).toBe(true)
    })

    it('renders the class under its kind section', () => {
      expect(markdown).toContain('### Classes\n\n#### Events\n\nDispatches events to handlers.')
    })

    it('renders the constructor as the expression a consumer writes', () => {
      expect(markdown).toContain('##### Constructor\n\n```typescript\nnew Events()\n```')
    })

    it('lists properties and accessors in one table in declaration order', () => {
      expect(markdown).toContain(
        '| `get current` | `string \\| null` | The latest state. |\n| `readonly dispatch` | `unknown` | Reduces an action. |'
      )
    })

    it('renders a method with its declaration, description, parameters, return value and example', () => {
      expect(markdown).toContain(
        [
          '##### on',
          '',
          '```typescript',
          'on(event: string | number): void',
          '```',
          '',
          'Registers a handler.',
          '',
          '**Parameters**',
          '',
          '| Name | Type | Description |',
          '| --- | --- | --- |',
          '| `event` | `string \\| number` | Which event to listen for |',
          '',
          '**Returns** `void`: Nothing; the handler is kept',
          '',
          '**Example: Listening**',
          '',
          '```typescript',
          "events.on('done', () => {})",
          '```',
        ].join('\n')
      )
    })

    it('renders the class example after its members', () => {
      expect(markdown.indexOf('**Example: Registering**')).toBeGreaterThan(markdown.indexOf('##### on'))
    })

    it('is absent for an entry point the bundle does not have', () => {
      expect(renderApiReferenceMarkdown(MULTI, { packageName: PACKAGE, subpath: 'missing' })).toBeNull()
    })
  })

  describe('single-entry package', () => {
    const markdown = renderApiReferenceMarkdown(SINGLE, { packageName: PACKAGE }) ?? ''

    it('lists exports by kind without a module heading', () => {
      expect(markdown.split('\n').filter((line) => line.startsWith('### '))).toEqual(['### Functions', '### Types'])
    })

    it('renders a function with its optional parameter and return value', () => {
      expect(markdown).toContain(
        [
          '#### create',
          '',
          '```typescript',
          'function create(options?: Options): Events',
          '```',
          '',
          'Makes an instance.',
          '',
          '**Parameters**',
          '',
          '| Name | Type | Description |',
          '| --- | --- | --- |',
          '| `options?` | `Options` | What to make it with |',
          '',
          '**Returns** `Events`: The instance',
        ].join('\n')
      )
    })

    it('renders a type alias as the type it names', () => {
      expect(markdown).toContain('#### Handler\n\nCalled on every event.\n\n```typescript\ntype Handler = unknown\n```')
    })
  })

  describe('interface members', () => {
    const markdown = renderApiReferenceMarkdown(MULTI, { packageName: PACKAGE, subpath: 'models' }) ?? ''

    it('renders an optional property in the table', () => {
      expect(markdown).toContain('| `label?` | `string` | A name to show. |')
    })

    it('renders a method signature as a method entry', () => {
      expect(markdown).toContain('##### resize\n\n```typescript\nresize(width: number): void\n```\n\nReports a new size.')
    })
  })
})
