# Changelog Module

The changelog module provides comprehensive parsing, manipulation, and serialization of CHANGELOG.md files.

## Architecture Overview

```mermaid
flowchart LR
    subgraph Input
        MD[CHANGELOG.md]
    end

    subgraph Core
        PARSE[parse/]
        MODELS[models/]
        PARSE --> MODELS
    end

    subgraph Transform
        OPS[operations/]
        COMPARE[compare/]
        MODELS --> OPS
        MODELS --> COMPARE
    end

    subgraph Output
        SERIALIZE[serialize/]
        OPS --> SERIALIZE
        SERIALIZE --> MD_OUT[Markdown]
        SERIALIZE --> JSON_OUT[JSON]
    end

    MD --> PARSE
```

### Module Dependencies

```mermaid
graph TD
    MODELS[models/] --> PARSE[parse/]
    MODELS --> SERIALIZE[serialize/]
    MODELS --> COMPARE[compare/]
    MODELS --> OPS[operations/]
    PARSE -.->|creates| CHANGELOG[Changelog]
    SERIALIZE -.->|consumes| CHANGELOG
    COMPARE -.->|consumes| CHANGELOG
    OPS -.->|transforms| CHANGELOG
```

## Data Model

```mermaid
classDiagram
    class Changelog {
        +source?: string
        +header: ChangelogHeader
        +entries: ChangelogEntry[]
        +metadata: ChangelogMetadata
    }

    class ChangelogHeader {
        +title: string
        +description: string[]
        +links: ChangelogLink[]
    }

    class ChangelogLink {
        +label: string
        +url: string
    }

    class ChangelogEntry {
        +version: string
        +date: string | null
        +unreleased: boolean
        +compareUrl?: string
        +sections: ChangelogSection[]
        +rawContent?: string
    }

    class ChangelogSection {
        +type: ChangelogSectionType
        +heading: string
        +items: ChangelogItem[]
    }

    class ChangelogItem {
        +description: string
        +scope?: string
        +breaking: boolean
        +commits: CommitRef[]
        +references: IssueRef[]
    }

    class CommitRef {
        +hash: string
        +url?: string
    }

    class IssueRef {
        +number: number
        +type: "issue" | "pull-request"
        +url?: string
    }

    class ChangelogMetadata {
        +format: ChangelogFormat
        +isConventional: boolean
        +repositoryUrl?: string
        +packageName?: string
        +warnings: string[]
    }

    Changelog --> ChangelogHeader
    Changelog --> ChangelogEntry
    Changelog --> ChangelogMetadata
    ChangelogHeader --> ChangelogLink
    ChangelogEntry --> ChangelogSection
    ChangelogSection --> ChangelogItem
    ChangelogItem --> CommitRef
    ChangelogItem --> IssueRef
```

## Parse Pipeline

```mermaid
flowchart LR
    A[Markdown String] --> B["tokenize()"]
    B --> C[Token Stream]
    C --> D["parseChangelog()"]
    D --> E[Changelog Object]

    subgraph Tokens
        C --> T1[HEADER]
        C --> T2[ENTRY_HEADING]
        C --> T3[SECTION_HEADING]
        C --> T4[LIST_ITEM]
        C --> T5[PARAGRAPH]
        C --> T6[LINK_DEFINITION]
    end
```

## Section Types

The module recognizes these standard changelog section types:

| Type            | Common Headings            |
| --------------- | -------------------------- |
| `breaking`      | Breaking Changes, BREAKING |
| `features`      | Features, Added, New       |
| `fixes`         | Bug Fixes, Fixed           |
| `performance`   | Performance, Perf          |
| `documentation` | Documentation, Docs        |
| `deprecations`  | Deprecated                 |
| `refactoring`   | Refactored, Refactor       |
| `tests`         | Tests, Testing             |
| `build`         | Build, Dependencies        |
| `ci`            | CI, Continuous Integration |
| `chores`        | Chores, Misc               |
| `other`         | Other (fallback)           |

## Usage Examples

### Parsing a Changelog

```typescript
import { parseChangelog } from '@hyperfrontend/versioning'

const markdown = `
# Changelog

## [1.0.0] - 2024-01-15

### Features
- Initial release
`

const changelog = parseChangelog(markdown)
```

### Creating a Changelog Programmatically

```typescript
import { createChangelog, createChangelogEntry, createChangelogSection, createChangelogItem } from '@hyperfrontend/versioning'

const changelog = createChangelog({
  header: { title: '# Changelog', description: [], links: [] },
  entries: [
    createChangelogEntry('1.0.0', {
      date: '2024-01-15',
      sections: [createChangelogSection('features', 'Features', [createChangelogItem('Initial release')])],
    }),
  ],
  metadata: { format: 'keep-a-changelog', isConventional: false, warnings: [] },
})
```

### Serializing to Markdown

```typescript
import { serializeChangelog } from '@hyperfrontend/versioning'

const markdown = serializeChangelog(changelog, {
  includeScope: true,
  useAsterisks: false,
})
```

### Comparing Changelogs

```typescript
import { isChangelogEqual, diffChangelogs } from '@hyperfrontend/versioning'

const areEqual = isChangelogEqual(changelog1, changelog2)
const diff = diffChangelogs(changelog1, changelog2)
```

### Filtering Entries

```typescript
import { filterByVersionRange, filterBreakingChanges } from '@hyperfrontend/versioning'

const recent = filterByVersionRange(changelog, '1.0.0', '2.0.0')
const breaking = filterBreakingChanges(changelog)
```

### Merging Changelogs

```typescript
import { mergeChangelogs } from '@hyperfrontend/versioning'

const result = mergeChangelogs(source, target, {
  entryStrategy: 'union',
  sectionStrategy: 'union',
  itemStrategy: 'union',
})
```

### Transforming Entries

```typescript
import { transformEntries, sortEntries, compact } from '@hyperfrontend/versioning'

const updated = transformEntries(changelog, (entry) => ({
  ...entry,
  date: entry.date ?? new Date().toISOString().split('T')[0],
}))

const sorted = sortEntries(updated)
const cleaned = compact(sorted)
```

## Merge Strategies

```mermaid
flowchart TB
    subgraph Strategies
        direction TB
        S[source] --> |"Keep source value"| R1[Result]
        T[target] --> |"Keep target value"| R2[Result]
        U[union] --> |"Combine both"| R3[Result]
        L[latest] --> |"Prefer newer"| R4[Result]
    end
```

| Strategy | Entry Behavior        | Section Behavior   | Item Behavior          |
| -------- | --------------------- | ------------------ | ---------------------- |
| `source` | Use source entry      | Use source section | Use source item        |
| `target` | Use target entry      | Use target section | Use target item        |
| `union`  | Include both (unique) | Combine sections   | Combine items          |
| `latest` | Use newer entry       | Merge by type      | Replace by description |

## Design Principles

1. **Immutability**: All operations return new objects; inputs are never mutated
2. **No Regex**: Character-by-character parsing to prevent ReDoS vulnerabilities
3. **Functional**: Pure functions without class-based state
4. **Lossless**: Round-trip parsing preserves original formatting where possible
5. **Type-Safe**: Full TypeScript support with strict typing

## See Also

- [semver/](../semver/README.md) — Version parsing and comparison
- [commits/](../commits/README.md) — Generates changelog entries from commits
- [flow/](../flow/README.md) — Orchestrates changelog generation
- [workspace/](../workspace/README.md) — Discovers changelog files
- [Main README](../../README.md) — Package overview and quick start
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Design principles and data flow
