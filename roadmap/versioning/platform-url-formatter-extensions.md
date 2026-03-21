# Platform URL Formatter Extensions

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
