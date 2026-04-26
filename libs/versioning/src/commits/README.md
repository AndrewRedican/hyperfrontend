# commits/

Conventional commit parsing and models.

## Overview

Parsing and models for the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Uses state-machine tokenization for predictable O(n) performance.

```mermaid
flowchart LR
    subgraph Input
        MSG[Commit Message]
    end

    subgraph Parse
        PH[parse/header.ts]
        PB[parse/body.ts]
        PF[parse/footer.ts]
        PM[parse/message.ts]
    end

    subgraph Models
        CC[ConventionalCommit]
        CF[CommitFooter]
        CT[CommitType]
        BC[BreakingChange]
    end

    MSG --> PM
    PM --> PH --> CC
    PM --> PB --> CC
    PM --> PF --> CF
    CF --> CC
    CC --> CT
    CC --> BC
```

## Usage Examples

### Parsing Commits

```typescript
import { parseConventionalCommit, isConventionalCommit } from '@hyperfrontend/versioning'

// Parse a commit message
const commit = parseConventionalCommit('feat(api): add user endpoint')
console.log(commit.type) // 'feat'
console.log(commit.scope) // ['api']
console.log(commit.subject) // 'add user endpoint'

// Multi-scope headers produce multi-element arrays
const multi = parseConventionalCommit('feat(versioning,questions): add filter')
console.log(multi.scope) // ['versioning', 'questions']

// Scopeless commits produce an empty array
const scopeless = parseConventionalCommit('docs: update README')
console.log(scopeless.scope) // []

// Check format before parsing
if (isConventionalCommit(message)) {
  const parsed = parseConventionalCommit(message)
}
```

### Breaking Changes

```typescript
import { parseConventionalCommit } from '@hyperfrontend/versioning'

// Breaking change via !
const breaking1 = parseConventionalCommit('feat!: remove deprecated API')
console.log(breaking1.breaking) // true

// Breaking change via footer
const breaking2 = parseConventionalCommit(`fix: update signature

BREAKING CHANGE: The return type is now a Promise`)
console.log(breaking2.breaking) // true
console.log(breaking2.breakingDescription) // 'The return type is now a Promise'
```

### Body and Footers

```typescript
import { parseConventionalCommit } from '@hyperfrontend/versioning'

const commit = parseConventionalCommit(`feat(core): add validation

This adds input validation to all public methods.
Invalid inputs now throw descriptive errors.

Refs: ABC-123
Closes #456`)

console.log(commit.body)
// 'This adds input validation to all public methods.\nInvalid inputs now throw descriptive errors.'

console.log(commit.footers)
// [
//   { key: 'Refs', value: 'ABC-123', separator: ':' },
//   { key: 'Closes', value: '456', separator: ' #' }
// ]
```

### Creating Commits

```typescript
import { createConventionalCommit, createCommitFooter } from '@hyperfrontend/versioning'

const commit = createConventionalCommit('feat', 'add feature', {
  scope: ['api'],
  body: 'Detailed description',
  footers: [createCommitFooter('Refs', 'ABC-123'), createCommitFooter('Closes', '456', ' #')],
  breaking: true,
})

console.log(commit.raw)
// 'feat(api)!: add feature\n\nDetailed description\n\nRefs: ABC-123\nCloses #456'

// Multi-scope headers
const multi = createConventionalCommit('feat', 'shared change', { scope: ['versioning', 'questions'] })
console.log(multi.raw) // 'feat(versioning,questions): shared change'
```

### Semver Integration

```typescript
import { parseConventionalCommit, getSemverBump } from '@hyperfrontend/versioning'

const commit = parseConventionalCommit('feat: add feature')
const bump = getSemverBump(commit.type, commit.breaking)
console.log(bump) // 'minor'

const breaking = parseConventionalCommit('fix!: change API')
const breakingBump = getSemverBump(breaking.type, breaking.breaking)
console.log(breakingBump) // 'major'
```

## Conventional Commits Format

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

### Header

- **type**: Describes the category of change (feat, fix, docs, etc.)
- **scope**: Optional context in parentheses. Supports multi-scope headers such as `feat(versioning,questions): ...`; parsed into a `readonly string[]` (empty when no scope is present).
- **!**: Optional breaking change indicator
- **description**: Short summary of the change

### Body

Free-form text separated from header by a blank line. Can span multiple paragraphs.

### Footers

Token-based trailers in `key: value` or `key #value` format:

```
Refs: ABC-123
Fixes #456
BREAKING CHANGE: API signature changed
```

## Security

- **No regex**: All parsing uses character-by-character iteration
- **Input limits**: 10KB maximum message length enforced
- **ReDoS safe**: No regular expressions means no catastrophic backtracking

## See Also

- [classify/](./classify/README.md) — Commit classification for changelog attribution
- [changelog/](../changelog/README.md) — Generates entries from commits
- [flow/](../flow/README.md) — Analyzes commits to determine version bumps
- [semver/](../semver/README.md) — Version bumping based on commit types
- [Main README](../../README.md) — Package overview and quick start
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — Design principles and data flow
