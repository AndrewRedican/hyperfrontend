# Versioning Library - Future Considerations

> Lower-priority improvements for later consideration.
> These are "nice to have" items that don't block current adoption.

---

## Registry Abstraction Layer

**Current State:** Only npm registry is supported via npm CLI subprocess.

**Future Direction:** Define `RegistryAdapter` interface for pluggable registries.

```typescript
// Potential interface shape
export interface RegistryAdapter {
  readonly name: string
  getLatestVersion(packageName: string): Promise<string | null>
  getVersionInfo(packageName: string, version: string): Promise<VersionInfo | null>
  getPublishedCommit(packageName: string, version: string): Promise<string | null>
}
```

**Why Later:**

- npm CLI works for 90%+ of use cases
- HTTP-based npm adapter would reduce subprocess dependency
- GitHub Packages / Artifactory support requires concrete demand
- Significant design + implementation effort

**When to Revisit:** When there's concrete external request for non-npm support.

---

## HTTP-Based npm Client

**Current State:** Uses `npm view` subprocess in [registry/npm/client.ts](../libs/versioning/src/registry/npm/client.ts).

**Future Direction:** Use direct HTTP calls to registry API:

```typescript
// Sketch
async function getPackageInfo(name: string, registry = 'https://registry.npmjs.org'): Promise<PackageInfo> {
  const response = await fetch(`${registry}/${encodeURIComponent(name)}`)
  if (!response.ok) throw new Error(`Registry error: ${response.status}`)
  return response.json()
}
```

**Benefits:**

- No npm CLI dependency
- Works in Docker/serverless without npm installed
- Better error handling
- Potentially faster (no subprocess overhead)

**Trade-offs:**

- Authentication handling becomes our responsibility
- Need to handle `.npmrc` token resolution

---

## Workspace Discovery Auto-Detection

**Current State:** Default patterns are `libs/`, `apps/`, `packages/`, `tools/`, `plugins/`.

**Future Direction:** Auto-detect from workspace config files:

```typescript
// Sketch
function inferDiscoveryPatterns(workspaceRoot: string): string[] {
  // Check nx.json for project locations
  const nxJson = readNxJson(workspaceRoot)
  if (nxJson?.workspaceLayout) {
    return [`${nxJson.workspaceLayout.libsDir}/*`, `${nxJson.workspaceLayout.appsDir}/*`]
  }

  // Check pnpm-workspace.yaml
  const pnpmWorkspace = readPnpmWorkspace(workspaceRoot)
  if (pnpmWorkspace?.packages) {
    return pnpmWorkspace.packages
  }

  // Fall back to defaults
  return DEFAULT_PATTERNS
}
```

**Why Later:** Current configurable `patterns` option is sufficient workaround.

---

## Platform URL Formatter Extensions

**Current State:** Hardcoded support for GitHub, GitLab, Bitbucket, Azure DevOps.

**Future Direction:** Accept custom URL formatter:

```typescript
// In RepositoryConfig
readonly urlFormatter?: (context: {
  host: string
  owner: string
  repo: string
  from?: string
  to?: string
}) => {
  compareUrl?: string
  commitUrl?: string
  issueUrl?: string
}
```

**Why Later:**

- Heuristic fallback works for most self-hosted instances
- Custom formatter can be injected via config already
- Low usage of non-standard platforms

---

## Changelog Section Type Extensions

**Current State:** Fixed `ChangelogSectionType` union with 12 types.

**Future Direction:** Allow registering custom section types:

```typescript
// Sketch - plugin-style registration
registerSectionType({
  name: 'security',
  displayHeading: '🔒 Security',
  commitTypes: ['security', 'vuln'],
})
```

**Why Later:**

- Current `'other'` fallback is acceptable
- Users can post-process changelog
- Plugin system adds complexity

---

## Changelog Template Customization

**Current State:** `createEmptyChangelog()` returns hardcoded template.

**Future Direction:** Accept template in factory:

```typescript
createEmptyChangelog({
  header: {
    title: '# Release Notes',
    description: ['Custom description...'],
  },
})
```

**Why Later:** Users can modify changelog after creation; low friction.

---

## Breaking Change Indicator Customization

**Current State:** Hardcoded `⚠️ BREAKING:` prefix.

**Future Direction:**

```typescript
// In serialize options
breakingIndicator: '💥 **BREAKING CHANGE:** '
// or
breakingIndicator: (commit) => `[BREAKING] ${commit.subject}`
```

**Why Later:** Cosmetic; users can post-process.

---

## Items Explicitly Declined

These were in the original analysis but are not worth pursuing:

| Item                         | Reason                                                                   |
| ---------------------------- | ------------------------------------------------------------------------ |
| Non-English section headings | Extremely niche; fallback to `other` works                               |
| MAX_INPUT_LENGTH config      | 1MB is plenty; edge case                                                 |
| MAX_MESSAGE_LENGTH config    | 10KB is plenty; edge case                                                |
| MAX_VERSION_LENGTH config    | 256 is plenty; edge case                                                 |
| GPG signature in git model   | Out of scope for versioning                                              |
| Custom git log format        | Internal; doesn't affect users                                           |
| Workspace type override      | Auto-detection works; if both configs exist, precedence is deterministic |

---

## Guiding Principle

Only add configurability when:

1. There's concrete external demand (not hypothetical)
2. The default genuinely blocks adoption (not just different preference)
3. The implementation maintains composability (not special-casing)
