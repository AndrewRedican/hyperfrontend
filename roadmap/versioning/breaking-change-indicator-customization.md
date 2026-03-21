# Breaking Change Indicator Customization

**Current State:** Hardcoded `⚠️ BREAKING:` prefix.

**Future Direction:**

```typescript
// In serialize options
breakingIndicator: '💥 **BREAKING CHANGE:** '
// or
breakingIndicator: (commit) => `[BREAKING] ${commit.subject}`
```

**Why Later:** Cosmetic; users can post-process.
