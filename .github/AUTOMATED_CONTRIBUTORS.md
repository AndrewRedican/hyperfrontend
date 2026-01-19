# Automated Contributors Management

This project uses automated workflows to recognize contributors.

## Automatic Addition on PR Merge

When a pull request from a fork is merged, the contributor is **automatically added** to the contributors list with the `code` contribution type.

This happens via the GitHub Actions workflow in `.github/workflows/contributors.yml`.

## Manual Addition via Comments

You can also add contributors manually by commenting on any issue or PR:

### Add a Code Contributor

```
@all-contributors please add @username for code
```

### Add Multiple Contribution Types

```
@all-contributors please add @username for code, doc, and design
```

### Available Contribution Types

| Type        | Description         | Comment Usage     |
| ----------- | ------------------- | ----------------- |
| code        | Code contributions  | `for code`        |
| doc         | Documentation       | `for doc`         |
| design      | Design              | `for design`      |
| bug         | Bug reports         | `for bug`         |
| ideas       | Ideas & Planning    | `for ideas`       |
| infra       | Infrastructure      | `for infra`       |
| maintenance | Maintenance         | `for maintenance` |
| review      | Code reviews        | `for review`      |
| test        | Tests               | `for test`        |
| tool        | Tools               | `for tool`        |
| translation | Translation         | `for translation` |
| tutorial    | Tutorials           | `for tutorial`    |
| question    | Answering Questions | `for question`    |
| talk        | Talks               | `for talk`        |
| blog        | Blog posts          | `for blog`        |
| financial   | Financial support   | `for financial`   |
| video       | Videos              | `for video`       |
| example     | Examples            | `for example`     |
| plugin      | Plugins             | `for plugin`      |
| platform    | Packaging/porting   | `for platform`    |
| mentoring   | Mentoring           | `for mentoring`   |

### Examples

```
@all-contributors please add @johndoe for code and test
@all-contributors please add @janedoe for doc
@all-contributors please add @sponsor for financial
```

## How It Works

### On PR Merge (Automatic)

1. PR from a fork is merged
2. GitHub Actions workflow triggers
3. Contributor is added with `code` type
4. README is updated automatically
5. Changes are committed to main branch

### On Comment (Manual)

1. Maintainer or contributor comments with `@all-contributors` command
2. All Contributors bot processes the comment
3. Contributor is added with specified types
4. Bot creates a PR with the changes
5. Maintainer merges the PR

## Permissions

The workflow has these permissions:

- `contents: write` - To commit changes to the repository
- `pull-requests: write` - To create PRs for manual additions
- `issues: write` - To respond to comments

## Updating Contribution Types

If a contributor should have additional contribution types:

1. Comment on any issue/PR:

   ```
   @all-contributors please add @username for code, doc, and review
   ```

2. Or manually edit `.all-contributorsrc` and run:
   ```bash
   npm run contributors:generate
   ```

## Troubleshooting

### Workflow didn't trigger on PR merge

- Check that the PR was from a fork (not a branch in the main repo)
- Check the Actions tab for any errors
- Verify GitHub Actions are enabled

### Bot didn't respond to comment

- Ensure you used the exact format: `@all-contributors please add @username for type`
- Check that you have the proper permissions
- The bot may take a minute to respond

### Manual fallback

If automation fails, you can always add contributors manually:

```bash
npm run contributors:add -- username code,doc
npm run contributors:generate
git add .all-contributorsrc README.md
git commit -m "docs: add @username as a contributor"
```

## Configuration

The automation is configured in:

- `.github/workflows/contributors.yml` - GitHub Actions workflow
- `.all-contributorsrc` - Contributors database

---

**Note**: Contributors from the main repository (non-fork PRs) won't be automatically added since they're likely maintainers. Use manual commands for them if needed.
