import { join } from 'node:path'
import { createTempWorkspaceManager } from '../testing'
import rule, {
  extractBadgesBlock,
  extractDocumentationLink,
  extractShortDescription,
  extractTitle,
  parseMarkdownSections,
  REQUIRED_BADGES,
  REQUIRED_SECTIONS,
  REQUIRED_SUBSECTIONS,
  RULE_NAME,
} from './lib-readme-structure'

const manager = createTempWorkspaceManager()

/**
 * Valid publishable library project.json for testing.
 */
const validProjectJson = {
  name: 'lib-test-library',
  description: 'A test library for validation',
  projectType: 'library',
  tags: ['type:util', 'scope:public'],
  targets: { build: {}, publish: {} },
}

/**
 * Creates a temporary project structure for testing.
 *
 * @param config - Configuration for the temporary project.
 * @param config.projectJson - The project.json content.
 * @returns The path to the temporary project directory.
 */
function createTempProject(config: { projectJson: object }): string {
  const workspace = manager.create({
    projectJson: config.projectJson,
    directories: ['src'],
  })
  return workspace.root
}

/**
 * Creates a valid README.md content for testing.
 *
 * @param packageName - The name of the package to use in the README title and badges.
 * @returns A string containing the content of a valid README.md file.
 */
function createValidReadme(packageName = 'test-library'): string {
  return `# @hyperfrontend/${packageName}

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-${packageName}.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-${packageName}.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=${packageName}">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=${packageName}" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/${packageName}">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/${packageName}?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/${packageName}">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2F${packageName}?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/${packageName}">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/${packageName}?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

A short description of this library for testing purposes.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/${packageName}/)

## What is @hyperfrontend/${packageName}?

This is a description of what the library does.

### Key Features

- **Feature One** - Description of feature one
- **Feature Two** - Description of feature two

### Architecture Highlights

Built on functional composition with dependency injection.

## Why Use @hyperfrontend/${packageName}?

Reasons why you should use this library.

## Installation

\`\`\`bash
npm install @hyperfrontend/${packageName}
\`\`\`

## Quick Start

\`\`\`typescript
import { something } from '@hyperfrontend/${packageName}'
\`\`\`

## API Overview

### Main Function

- **\`mainFunction()\`** - Does something useful

## Compatibility

| Platform | Support |
| -------- | :-----: |
| Browser  |   ✅    |
| Node.js  |   ✅    |
`
}

describe('lib-readme-structure', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  describe('rule metadata', () => {
    it('exports the correct rule name', () => {
      expect(RULE_NAME).toBe('lib-readme-structure')
    })

    it('has correct meta type', () => {
      expect(rule.meta?.type).toBe('problem')
    })

    it('has documentation url', () => {
      expect(rule.meta?.docs?.url).toContain('lib-readme-structure')
    })

    it('has all required message IDs', () => {
      const messageIds = Object.keys(rule.meta?.messages ?? {})
      expect(messageIds).toContain('missingTitle')
      expect(messageIds).toContain('invalidTitleFormat')
      expect(messageIds).toContain('missingBadgesBlock')
      expect(messageIds).toContain('missingBadge')
      expect(messageIds).toContain('missingShortDescription')
      expect(messageIds).toContain('missingDocumentationLink')
      expect(messageIds).toContain('missingSection')
      expect(messageIds).toContain('emptySectionContent')
      expect(messageIds).toContain('sectionOutOfOrder')
      expect(messageIds).toContain('missingSubsection')
      expect(messageIds).toContain('missingKeyFeaturesList')
    })
  })

  describe('extractTitle', () => {
    it('extracts title from valid README', () => {
      const content = '# @hyperfrontend/test-lib\n\nSome content'
      const result = extractTitle(content)
      expect(result).toEqual({ title: '@hyperfrontend/test-lib', line: 1 })
    })

    it('returns null when no title present', () => {
      const content = 'No title here\n\nJust text'
      const result = extractTitle(content)
      expect(result).toBeNull()
    })

    it('handles title not on first line', () => {
      const content = '\n\n# @hyperfrontend/test-lib'
      const result = extractTitle(content)
      expect(result).toEqual({ title: '@hyperfrontend/test-lib', line: 3 })
    })

    it('extracts only level 1 heading', () => {
      const content = '## Not a title\n# @hyperfrontend/test-lib'
      const result = extractTitle(content)
      expect(result).toEqual({ title: '@hyperfrontend/test-lib', line: 2 })
    })
  })

  describe('extractBadgesBlock', () => {
    it('extracts single badges block', () => {
      const content = `# Title

<p align="center">
  <img src="badge1.svg" alt="Badge 1">
</p>

Content here`
      const result = extractBadgesBlock(content)
      expect(result).not.toBeNull()
      expect(result?.block).toContain('badge1.svg')
      expect(result?.startLine).toBe(3)
    })

    it('extracts multiple consecutive badges blocks', () => {
      const content = `# Title

<p align="center">
  <img src="badge1.svg" alt="Badge 1">
</p>
<p align="center">
  <img src="badge2.svg" alt="Badge 2">
</p>

Content here`
      const result = extractBadgesBlock(content)
      expect(result).not.toBeNull()
      expect(result?.block).toContain('badge1.svg')
      expect(result?.block).toContain('badge2.svg')
    })

    it('returns null when no badges block', () => {
      const content = '# Title\n\nJust content'
      const result = extractBadgesBlock(content)
      expect(result).toBeNull()
    })
  })

  describe('extractShortDescription', () => {
    it('extracts description after badges', () => {
      const content = `Line 0
</p>

A short description here.

## Section`
      const result = extractShortDescription(content, 2)
      expect(result).toEqual({ text: 'A short description here.', line: 4 })
    })

    it('returns null if first non-empty line is a header', () => {
      const content = `</p>

## Section`
      const result = extractShortDescription(content, 1)
      expect(result).toBeNull()
    })

    it('skips HTML tags except links', () => {
      const content = `Line 0
</p>
<div>skip me</div>
A description`
      const result = extractShortDescription(content, 2)
      expect(result?.text).toBe('A description')
    })
  })

  describe('extractDocumentationLink', () => {
    it('finds documentation link', () => {
      const content = `# Title

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/test/)

## Content`
      const result = extractDocumentationLink(content)
      expect(result).toEqual({ line: 3 })
    })

    it('returns null when no documentation link', () => {
      const content = '# Title\n\n## Content'
      const result = extractDocumentationLink(content)
      expect(result).toBeNull()
    })

    it('handles different formatting', () => {
      const content = `# Title

•  👉  See [**documentation**](https://www.hyperfrontend.dev/docs/test/)

## Content`
      const result = extractDocumentationLink(content)
      expect(result).toEqual({ line: 3 })
    })
  })

  describe('parseMarkdownSections', () => {
    it('parses sections with correct levels', () => {
      const content = `# Title

## Section 1

Content 1

### Subsection 1.1

Content 1.1

## Section 2

Content 2`
      const sections = parseMarkdownSections(content)

      expect(sections).toHaveLength(4)
      expect(sections[0]).toMatchObject({ level: 1, title: 'Title' })
      expect(sections[1]).toMatchObject({ level: 2, title: 'Section 1' })
      expect(sections[2]).toMatchObject({ level: 3, title: 'Subsection 1.1' })
      expect(sections[3]).toMatchObject({ level: 2, title: 'Section 2' })
    })

    it('extracts section content', () => {
      const content = `# Title

## Section 1

Line 1
Line 2

## Section 2`
      const sections = parseMarkdownSections(content)

      expect(sections[1].content).toBe('Line 1\nLine 2')
    })

    it('sets correct start and end lines', () => {
      const content = `# Title
## Section 1
Content
## Section 2`
      const sections = parseMarkdownSections(content)

      expect(sections[0].startLine).toBe(1)
      expect(sections[0].endLine).toBe(4)
      expect(sections[1].startLine).toBe(2)
      expect(sections[1].endLine).toBe(3)
      expect(sections[2].startLine).toBe(4)
      expect(sections[2].endLine).toBe(4)
    })

    it('includes subsections within parent endLine', () => {
      const content = `## Parent Section

### Child 1

Content 1

### Child 2

Content 2

## Next Parent`
      const sections = parseMarkdownSections(content)

      const parent = sections[0]
      expect(parent.title).toBe('Parent Section')
      expect(parent.level).toBe(2)

      const child1 = sections[1]
      const child2 = sections[2]

      expect(child1.startLine).toBeGreaterThan(parent.startLine)
      expect(child1.startLine).toBeLessThan(parent.endLine)
      expect(child2.startLine).toBeGreaterThan(parent.startLine)
      expect(child2.startLine).toBeLessThan(parent.endLine)
    })
  })

  describe('REQUIRED_SECTIONS', () => {
    it('has all required sections defined', () => {
      const sectionNames = REQUIRED_SECTIONS.map((s) => s.name)
      expect(sectionNames).toContain('What is @hyperfrontend/<name>?')
      expect(sectionNames).toContain('Why Use @hyperfrontend/<name>?')
      expect(sectionNames).toContain('Installation')
      expect(sectionNames).toContain('Quick Start')
      expect(sectionNames).toContain('API Overview')
      expect(sectionNames).toContain('Compatibility')
    })

    it('all sections are level 2', () => {
      for (const section of REQUIRED_SECTIONS) {
        expect(section.level).toBe(2)
      }
    })
  })

  describe('REQUIRED_SUBSECTIONS', () => {
    it('has Key Features and Architecture Highlights', () => {
      const subsectionNames = REQUIRED_SUBSECTIONS.map((s) => s.name)
      expect(subsectionNames).toContain('Key Features')
      expect(subsectionNames).toContain('Architecture Highlights')
    })

    it('all subsections are level 3', () => {
      for (const sub of REQUIRED_SUBSECTIONS) {
        expect(sub.level).toBe(3)
      }
    })
  })

  describe('REQUIRED_BADGES', () => {
    it('has all required badges defined', () => {
      const badgeNames = REQUIRED_BADGES.map((b) => b.name)
      expect(badgeNames).toContain('Build badge')
      expect(badgeNames).toContain('Coverage badge')
      expect(badgeNames).toContain('npm version badge')
      expect(badgeNames).toContain('Bundle size badge')
      expect(badgeNames).toContain('Contributors badge')
      expect(badgeNames).toContain('License badge')
      expect(badgeNames).toContain('npm downloads badge')
      expect(badgeNames).toContain('GitHub stars badge')
      expect(badgeNames).toContain('Node version badge')
      expect(badgeNames).toContain('Tree-shakeable badge')
    })

    it('badge patterns match valid badge URLs', () => {
      const validBadges = createValidReadme('test')
      for (const badge of REQUIRED_BADGES) {
        expect(badge.pattern.test(validBadges)).toBe(true)
      }
    })
  })

  describe('rule.create', () => {
    it('returns empty object for non-README files', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const context = {
        filename: join(dir, 'src/index.ts'),
        sourceCode: { getText: () => '' },
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toEqual({})
    })

    it('returns empty object for non-publishable libraries', () => {
      const dir = createTempProject({
        projectJson: {
          name: 'lib-test',
          projectType: 'library',
          targets: { build: {} },
        },
      })
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => '' },
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toEqual({})
    })

    it('returns root listener for publishable library README', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => createValidReadme('test') },
        report: jest.fn(),
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      expect(listener).toHaveProperty('root')
    })

    it('reports missing title', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => 'No title here' },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingTitle',
        })
      )
    })

    it('reports invalid title format', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => '# Wrong Title Format' },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'invalidTitleFormat',
          data: { title: 'Wrong Title Format' },
        })
      )
    })

    it('reports missing badges block', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => '# @hyperfrontend/test\n\nNo badges here' },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingBadgesBlock',
        })
      )
    })

    it('reports missing required sections', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const content = `# @hyperfrontend/test

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/test" alt="Build">
  <img src="https://codecov.io/gh/test" alt="Coverage">
  <img src="https://img.shields.io/npm/v/test" alt="npm version">
  <img src="https://bundlephobia.com/package/test" alt="Bundle size">
  <img src="https://img.shields.io/github/all-contributors/test" alt="Contributors">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/npm/dm/test" alt="Downloads">
  <img src="https://img.shields.io/github/stars/test" alt="Stars">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node">
  <img src="https://img.shields.io/badge/tree%20shakeable-yes" alt="Shakeable">
</p>

Description.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/test/)

## Installation

npm install
`
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => content },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      const missingCalls = reportMock.mock.calls.filter((call) => call[0].messageId === 'missingSection')
      expect(missingCalls.length).toBeGreaterThanOrEqual(5)
    })

    it('does not report errors for valid README', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => createValidReadme('test') },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).not.toHaveBeenCalled()
    })

    it('reports sections out of order', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const content = `# @hyperfrontend/test

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/test" alt="Build">
  <img src="https://codecov.io/gh/test" alt="Coverage">
  <img src="https://img.shields.io/npm/v/test" alt="npm version">
  <img src="https://bundlephobia.com/package/test" alt="Bundle size">
  <img src="https://img.shields.io/github/all-contributors/test" alt="Contributors">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/npm/dm/test" alt="Downloads">
  <img src="https://img.shields.io/github/stars/test" alt="Stars">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node">
  <img src="https://img.shields.io/badge/tree%20shakeable-yes" alt="Shakeable">
</p>

Description.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/test/)

## Installation

npm install

## What is @hyperfrontend/test?

Description.

### Key Features

- **Feature** - Desc

### Architecture Highlights

Desc.

## Why Use @hyperfrontend/test?

Reasons.

## Quick Start

Code.

## API Overview

API.

## Compatibility

Compatible.
`
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => content },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      const outOfOrderCalls = reportMock.mock.calls.filter((call) => call[0].messageId === 'sectionOutOfOrder')
      expect(outOfOrderCalls.length).toBeGreaterThan(0)
    })

    it('reports missing subsections', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const content = `# @hyperfrontend/test

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/test" alt="Build">
  <img src="https://codecov.io/gh/test" alt="Coverage">
  <img src="https://img.shields.io/npm/v/test" alt="npm version">
  <img src="https://bundlephobia.com/package/test" alt="Bundle size">
  <img src="https://img.shields.io/github/all-contributors/test" alt="Contributors">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/npm/dm/test" alt="Downloads">
  <img src="https://img.shields.io/github/stars/test" alt="Stars">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node">
  <img src="https://img.shields.io/badge/tree%20shakeable-yes" alt="Shakeable">
</p>

Description.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/test/)

## What is @hyperfrontend/test?

Description without subsections.

## Why Use @hyperfrontend/test?

Reasons.

## Installation

npm install

## Quick Start

Code.

## API Overview

API.

## Compatibility

Compatible.
`
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => content },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      const subCalls = reportMock.mock.calls.filter((call) => call[0].messageId === 'missingSubsection')
      expect(subCalls.length).toBe(2)
    })

    it('reports missing key features bullet list', () => {
      const dir = createTempProject({ projectJson: validProjectJson })
      const reportMock = jest.fn()
      const content = `# @hyperfrontend/test

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/test" alt="Build">
  <img src="https://codecov.io/gh/test" alt="Coverage">
  <img src="https://img.shields.io/npm/v/test" alt="npm version">
  <img src="https://bundlephobia.com/package/test" alt="Bundle size">
  <img src="https://img.shields.io/github/all-contributors/test" alt="Contributors">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/npm/dm/test" alt="Downloads">
  <img src="https://img.shields.io/github/stars/test" alt="Stars">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node">
  <img src="https://img.shields.io/badge/tree%20shakeable-yes" alt="Shakeable">
</p>

Description.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/test/)

## What is @hyperfrontend/test?

Description.

### Key Features

No bullet list here, just plain text.

### Architecture Highlights

Desc.

## Why Use @hyperfrontend/test?

Reasons.

## Installation

npm install

## Quick Start

Code.

## API Overview

API.

## Compatibility

Compatible.
`
      const context = {
        filename: join(dir, 'README.md'),
        sourceCode: { getText: () => content },
        report: reportMock,
      }
      // @ts-expect-error - partial mock
      const listener = rule.create(context)
      const mockNode = { type: 'root' }
      // @ts-expect-error - partial mock
      listener.root?.(mockNode)

      expect(reportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'missingKeyFeaturesList',
        })
      )
    })
  })
})
