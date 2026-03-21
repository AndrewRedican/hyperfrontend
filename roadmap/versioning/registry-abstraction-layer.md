# Registry Abstraction Layer

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
