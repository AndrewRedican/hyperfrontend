# HTTP-Based npm Client

**Current State:** Uses `npm view` subprocess in [registry/npm/client.ts](../../libs/versioning/src/registry/npm/client.ts).

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
