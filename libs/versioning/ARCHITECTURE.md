# Architecture

This document describes the internal architecture of `@hyperfrontend/versioning`. For usage examples and quick start guides, see the main [README.md](./README.md).

## Table of Contents

- [Design Principles](#design-principles)
- [Module Composition](#module-composition)
- [Data Flow](#data-flow)
- [Core Types](#core-types)
- [Security Architecture](#security-architecture)
- [Module Details](#module-details)

---

## Design Principles

### 1. Purely Functional Architecture

All operations are implemented as pure functions. State is never mutated—instead, new objects are returned from each operation.

```typescript
// ✅ Pure function - returns new object
function incrementVersion(version: ParsedVersion, type: ReleaseType): ParsedVersion

// ❌ Never mutate - this pattern does not exist in this library
function updateVersion(version: ParsedVersion, type: ReleaseType): void
```

### 2. Factory Functions Over Classes

All complex objects are created via factory functions rather than class constructors. This simplifies testing, enables tree-shaking, and avoids `this` binding issues.

```typescript
// Factory function pattern used throughout
const context = createFlowContext({ workspaceRoot, projectName })
const client = createGitClient({ tree, workspaceRoot })
```

### 3. State Machine Parsing

All parsing uses character-by-character state machines with O(n) complexity, ensuring predictable performance regardless of input patterns.

```mermaid
flowchart LR
    Input[Raw Input] --> Tokenizer[State Machine Tokenizer]
    Tokenizer --> Tokens[Token Stream]
    Tokens --> Parser[Token Parser]
    Parser --> AST[Structured Data]
```

### 4. Explicit Error Handling

Functions return discriminated unions or throw typed errors. No silent failures.

```typescript
type ParseResult<T> = { success: true; value: T } | { success: false; error: ParseError }
```

### 5. Composition Over Configuration

Complex operations are built by composing simple functions rather than through configuration objects with many options.

---

## Module Composition

The library is organized into seven focused modules that compose together:

```mermaid
graph TB
    subgraph "Orchestration Layer"
        flow[flow/]
    end

    subgraph "Domain Modules"
        changelog[changelog/]
        commits[commits/]
        semver[semver/]
        registry[registry/]
    end

    subgraph "Infrastructure Modules"
        git[git/]
        workspace[workspace/]
    end

    flow --> changelog
    flow --> commits
    flow --> semver
    flow --> registry
    flow --> git
    flow --> workspace

    changelog --> semver
    commits --> changelog
    registry --> semver
    git --> workspace
```

### Module Hierarchy

| Layer          | Modules                                          | Responsibility                     |
| -------------- | ------------------------------------------------ | ---------------------------------- |
| Orchestration  | `flow/`                                          | Version release workflow execution |
| Domain         | `changelog/`, `commits/`, `semver/`, `registry/` | Core versioning logic              |
| Infrastructure | `git/`, `workspace/`                             | File system and git operations     |

---

## Data Flow

### Version Release Flow

The primary use case—releasing a new version—flows through multiple modules:

```mermaid
sequenceDiagram
    participant User
    participant Flow as flow/
    participant Git as git/
    participant Commits as commits/
    participant Semver as semver/
    participant Changelog as changelog/
    participant Registry as registry/
    participant Workspace as workspace/

    User->>Flow: executeVersionFlow(context)
    Flow->>Workspace: discoverProjects()
    Workspace-->>Flow: projects[]

    Flow->>Git: getCommitsSince(publishedCommit)
    Git-->>Flow: commits[]

    Flow->>Commits: parseConventionalCommits(commits)
    Commits-->>Flow: parsedCommits[]

    Flow->>Semver: determineVersionBump(parsedCommits)
    Semver-->>Flow: ReleaseType

    Flow->>Semver: incrementVersion(current, releaseType)
    Semver-->>Flow: newVersion

    Flow->>Registry: checkVersionAvailable(newVersion)
    Registry-->>Flow: boolean

    Flow->>Changelog: generateEntry(parsedCommits, newVersion)
    Changelog-->>Flow: ChangelogEntry

    Flow->>Workspace: updatePackageJson(newVersion)
    Flow->>Workspace: updateChangelog(entry)

    Flow->>Git: commitAndTag(newVersion)

    Flow-->>User: FlowResult
```

### Changelog Parsing Pipeline

```mermaid
flowchart LR
    MD["CHANGELOG.md"] --> tokenize["tokenize()"]
    tokenize --> tokens["Token[ ]"]
    tokens --> parseTokens["parseTokens()"]
    parseTokens --> ast["Changelog AST"]
    ast --> buildChangelog["buildChangelog()"]
    buildChangelog --> format["Format Detection"]
    format --> changelog["Changelog Object"]
```

### Conventional Commit Parsing

```mermaid
flowchart TD
    input["feat(scope)!: description\n\nBody text\n\nBREAKING CHANGE: details"]

    subgraph "Header Parsing"
        type[Type: feat]
        scope[Scope: scope]
        breaking1[Breaking: !]
        subject[Subject: description]
    end

    subgraph "Body Parsing"
        body[Body: Body text]
    end

    subgraph "Footer Parsing"
        footer[Footer: BREAKING CHANGE]
        breaking2[Breaking Details: details]
    end

    input --> type
    input --> scope
    input --> breaking1
    input --> subject
    input --> body
    input --> footer
    footer --> breaking2

    type --> result[ConventionalCommit]
    scope --> result
    breaking1 --> result
    subject --> result
    body --> result
    breaking2 --> result
```

### Commit Classification Pipeline

When generating changelogs for monorepo projects, commits must be classified to determine which project(s) they belong to:

```mermaid
flowchart TB
    input["Raw Commits\n(git log)"]

    subgraph engine["Commit Classification Engine"]
        direction TB
        subgraph filters["Filtering Strategies"]
            scope["Scope-Based\nFiltering"]
            file["File-Based\nFiltering"]
        end
        scope --> matrix
        file --> matrix
        matrix["Classification\nDecision Matrix"]
    end

    input --> engine

    matrix --> direct
    matrix --> indirect
    matrix --> excluded

    subgraph direct["DIRECT"]
        d1["Matching scope OR\ntouches project files"]
        d2["Scope: OMITTED\n(redundant)"]
    end

    subgraph indirect["INDIRECT"]
        i1["Dependency changes OR\ninfrastructure changes"]
        i2["Scope: PRESERVED\n(context)"]
    end

    subgraph excluded["EXCLUDED"]
        e1["Unrelated to project"]
        e2["Not in CHANGELOG"]
    end

    direct --> changelog["Project CHANGELOG"]
    indirect --> changelog
```

---

## Core Types

### Central Type Relationships

```mermaid
classDiagram
    class Changelog {
        +title: string
        +description: string
        +entries: ChangelogEntry[]
        +metadata: ChangelogMetadata
    }

    class ChangelogEntry {
        +version: string
        +date: string
        +sections: ChangelogSection[]
        +yanked: boolean
    }

    class ChangelogSection {
        +heading: SectionHeading
        +items: ChangelogItem[]
    }

    class ChangelogItem {
        +content: string
        +scope: string
        +references: Reference[]
    }

    class ConventionalCommit {
        +type: CommitType
        +scope: string
        +subject: string
        +body: string
        +breaking: boolean
        +footers: CommitFooter[]
    }

    class ParsedVersion {
        +major: number
        +minor: number
        +patch: number
        +prerelease: string[]
        +build: string[]
    }

    class FlowContext {
        +workspaceRoot: string
        +projectName: string
        +tree: Tree
        +logger: Logger
        +gitClient: GitClient
    }

    Changelog "1" *-- "*" ChangelogEntry
    ChangelogEntry "1" *-- "*" ChangelogSection
    ChangelogSection "1" *-- "*" ChangelogItem
    ConventionalCommit ..> ChangelogItem : generates
    ParsedVersion ..> ChangelogEntry : version field
    FlowContext ..> Changelog : orchestrates
```

### Type Categories

| Category  | Types                                                              | Location     |
| --------- | ------------------------------------------------------------------ | ------------ |
| Changelog | `Changelog`, `ChangelogEntry`, `ChangelogSection`, `ChangelogItem` | `changelog/` |
| Commits   | `ConventionalCommit`, `CommitType`, `CommitFooter`                 | `commits/`   |
| Semver    | `ParsedVersion`, `ReleaseType`, `PreReleaseType`                   | `semver/`    |
| Git       | `GitClient`, `GitCommit`, `GitTag`, `GitLogEntry`                  | `git/`       |
| Registry  | `RegistryClient`, `PackageInfo`, `VersionInfo`                     | `registry/`  |
| Workspace | `Project`, `Workspace`, `PackageJson`                              | `workspace/` |
| Flow      | `FlowContext`, `FlowStep`, `FlowResult`, `FlowError`               | `flow/`      |

---

## Security Architecture

### Input Validation

All entry points validate input before processing:

```mermaid
flowchart LR
    input[User Input] --> length{Length Check}
    length -->|>limit| reject[Reject]
    length -->|≤limit| encoding{Encoding Check}
    encoding -->|invalid| reject
    encoding -->|valid| process[Process]
```

### Input Limits

| Input Type     | Maximum Length | Rationale                         |
| -------------- | -------------- | --------------------------------- |
| Commit message | 10,000 chars   | No legitimate commit exceeds this |
| Changelog file | 1 MB           | Prevents memory exhaustion        |
| Version string | 256 chars      | Per semver spec limits            |
| Package name   | 214 chars      | Per npm spec                      |

State-machine parsing ensures O(n) complexity for all inputs, providing predictable performance regardless of content patterns.

---

## Module Details

### changelog/

**Purpose:** Parse, manipulate, and serialize CHANGELOG.md files.

**Key Components:**

- `tokenize/` - Character-by-character markdown tokenizer
- `parse/` - Token-to-AST parser
- `format/` - Format detection (Keep a Changelog, Conventional, etc.)
- `render/` - AST-to-markdown serializer

**Architecture:**

```mermaid
flowchart TB
    subgraph Public API
        parseChangelog
        renderChangelog
        createChangelog
    end

    subgraph Internal
        tokenize
        parseTokens
        detectFormat
        buildAST
    end

    parseChangelog --> tokenize
    tokenize --> parseTokens
    parseTokens --> detectFormat
    detectFormat --> buildAST
    renderChangelog --> serialize
```

📖 [Full changelog/ documentation](./src/changelog/README.md)

---

### commits/

**Purpose:** Parse conventional commit messages into structured data.

**Key Components:**

- `parse/` - Commit message parser
- `types/` - Type definitions and constants
- `validate/` - Commit validation utilities

**Architecture:**

```mermaid
flowchart LR
    message[Commit Message] --> header[Parse Header]
    header --> type[Extract Type]
    header --> scope[Extract Scope]
    header --> subject[Extract Subject]
    message --> body[Parse Body]
    message --> footer[Parse Footers]
    footer --> breaking[Detect Breaking Changes]

    type --> commit[ConventionalCommit]
    scope --> commit
    subject --> commit
    body --> commit
    breaking --> commit
```

📖 [Full commits/ documentation](./src/commits/README.md)

---

### semver/

**Purpose:** Parse, compare, and manipulate semantic versions.

**Key Components:**

- `parse/` - Version string parser
- `compare/` - Version comparison functions
- `increment/` - Version bumping logic
- `range/` - Version range utilities

**Architecture:**

```mermaid
flowchart TB
    subgraph "Parse"
        parseVersion[parseVersion]
        parseRange[parseRange]
    end

    subgraph "Compare"
        compareVersions[compareVersions]
        satisfiesRange[satisfiesRange]
    end

    subgraph "Transform"
        incrementVersion[incrementVersion]
        formatVersion[formatVersion]
    end

    parseVersion --> compareVersions
    parseRange --> satisfiesRange
    parseVersion --> incrementVersion
    incrementVersion --> formatVersion
```

📖 [Full semver/ documentation](./src/semver/README.md)

---

### registry/

**Purpose:** Query npm registry for package and version information.

**Key Components:**

- `client/` - Registry client factory
- `fetch/` - HTTP fetch utilities
- `parse/` - Registry response parsers

**Architecture:**

```mermaid
flowchart LR
    createRegistryClient --> client[RegistryClient]
    client --> getPackageInfo
    client --> getVersionInfo
    client --> checkVersionExists

    getPackageInfo --> fetch[HTTP Fetch]
    fetch --> parse[Parse Response]
    parse --> result[PackageInfo]
```

📖 [Full registry/ documentation](./src/registry/README.md)

---

### git/

**Purpose:** Git operations abstraction layer.

**Key Components:**

- `client/` - Git client factory
- `log/` - Commit history parsing
- `tag/` - Tag operations
- `branch/` - Branch operations
- `diff/` - Diff parsing

**Architecture:**

```mermaid
flowchart TB
    createGitClient --> client[GitClient]

    subgraph "Read Operations"
        client --> getLog
        client --> getTags
        client --> getBranches
        client --> getDiff
    end

    subgraph "Write Operations"
        client --> commit
        client --> tag
        client --> push
    end

    subgraph "Query Operations"
        client --> getCommitsSince
        client --> getLatestTag
        client --> isClean
    end
```

📖 [Full git/ documentation](./src/git/README.md)

---

### workspace/

**Purpose:** Workspace and project discovery, package.json manipulation.

**Key Components:**

- `discover/` - Project discovery
- `package-json/` - Package.json read/write
- `project/` - Project configuration
- `nx/` - Nx workspace integration

**Architecture:**

```mermaid
flowchart TB
    subgraph "Discovery"
        discoverProjects
        findPackageJson
        detectWorkspaceRoot
    end

    subgraph "Package Operations"
        readPackageJson
        writePackageJson
        updateVersion
    end

    subgraph "Project Operations"
        getProjectConfig
        getProjectDependencies
    end

    discoverProjects --> readPackageJson
    readPackageJson --> getProjectConfig
```

📖 [Full workspace/ documentation](./src/workspace/README.md)

---

### flow/

**Purpose:** Orchestrate version release workflows.

**Key Components:**

- `context/` - Flow context factory
- `steps/` - Individual flow steps
- `execute/` - Flow execution engine
- `validate/` - Pre-flight validation

**Architecture:**

```mermaid
flowchart TB
    subgraph "Setup"
        createFlowContext --> context[FlowContext]
        validateContext --> validation[Validation Result]
    end

    subgraph "Execution"
        executeVersionFlow --> step1[Analyze Commits]
        step1 --> step2[Determine Version]
        step2 --> step3[Validate Registry]
        step3 --> step4[Update Files]
        step4 --> step5[Git Operations]
    end

    subgraph "Result"
        step5 --> result[FlowResult]
    end

    context --> executeVersionFlow
```

📖 [Full flow/ documentation](./src/flow/README.md)

---

## Further Reading

- [Main README](./README.md) - Installation and quick start
- [Module Documentation](./src/) - Per-module README files
- [Contributing Guide](../../CONTRIBUTING.md) - Development setup
- [Security Policy](../../SECURITY.md) - Vulnerability reporting
