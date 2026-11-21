---
name: create-pr
description: Push the current branch and open its pull request against main with the GitHub CLI. Use when asked to create a PR, open or raise a pull request, or push the branch and open a PR.
---

# Create PR

## Before

Stop and report, changing nothing, when any of these holds:

```bash
git status --porcelain                                # anything listed but PR.md: uncommitted work
git branch --show-current                             # empty or main: no branch to open a PR from
gh pr list --head "$(git branch --show-current)"      # a row: the PR already exists, give its URL
```

## Steps

1. Run the `pr-description` skill. It writes the body to `PR.md` and prints the title.
2. Push:

```bash
npx hf push --set-upstream origin "$(git branch --show-current)"
```

3. Create, with the title step 1 printed:

```bash
gh pr create --base main --title "Workspace-Owned Git Hooks, hf push and a Security Commit Type" --body-file PR.md
```

4. Print the PR's URL.

## When a step fails

Report its output and stop. **Never** force-push, pass `--no-verify`, switch a hook step off, or amend, rebase or add a commit to get past it. A `gh` that is not signed in needs the user's `gh auth login`.
