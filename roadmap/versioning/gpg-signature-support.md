# GPG Signature Support in Git Model

**Current State:** GPG signatures are not exposed in the git commit model.

**Future Direction:** Extend git model to include signature verification status.

**Notes:**

- Currently considered out of scope for versioning
- Could be useful for security-focused workflows
- Would require parsing `git log --show-signature` output
