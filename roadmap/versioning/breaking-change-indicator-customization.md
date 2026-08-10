# Breaking Change Indicator Customization

**Current State:** Two hardcoded indicators — the generate-changelog flow step prepends `⚠️ BREAKING:` to item text, and the markdown serializer separately emits `**BREAKING**` for breaking items; neither is configurable.

**Future Direction:**

```typescript
// In serialize options
breakingIndicator: '💥 **BREAKING CHANGE:** '
// or
breakingIndicator: (commit) => `[BREAKING] ${commit.subject}`
```

**Why Later:** Cosmetic; users can post-process.
