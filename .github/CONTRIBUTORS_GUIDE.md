# Contributors & Funding Management Guide

This guide explains how to manage contributors recognition and funding for the hyperfrontend project.

## Table of Contents

- [Automated Contributors](#automated-contributors)
- [All Contributors Setup](#all-contributors-setup)
- [Adding Contributors](#adding-contributors)
- [Funding Setup](#funding-setup)
- [Recognition Types](#recognition-types)

## Automated Contributors

Everyone who contributes is credited, whether through code, documentation, bug reports, ideas or research, and nobody has to ask. Merging a pull request does not add its author by itself, though: a maintainer adds each contributor through the All Contributors bot or the CLI. See [AUTOMATED_CONTRIBUTORS.md](AUTOMATED_CONTRIBUTORS.md) for full details.

### Quick Summary

- 💬 **Via Comments**: comment `@all-contributors please add @username for code` on any issue or PR, and the All Contributors bot opens a PR with the change
- 🏆 **Suggestions**: when a maintainer approves an outside PR, a workflow comments with the contribution types the changed files suggest
- 🔧 **Locally**: run the All Contributors CLI, then commit the result yourself

## All Contributors Setup

### What is All Contributors?

[All Contributors](https://allcontributors.org) is a specification for recognizing all contributors to a project, not just code contributors. It automatically generates a contributors section in your README with avatars and contribution types.

### Configuration

The configuration is in [.all-contributorsrc](../.all-contributorsrc) and includes:

- Project name and owner
- Contributors list with their contribution types
- The badge, written out in full so every version of the CLI and the bot renders it the same way
- `"commit": false`, so the CLI leaves its changes for you to commit under the repository's commit conventions

### Files Modified

All Contributors automatically manages:

- `README.md` - Contributors section and badge
- `.all-contributorsrc` - Contributors database

## Adding Contributors

The CLI is not a dependency of the repository. Run it with `npx`, pinned to the version the README is checked against:

### Command Line Method

```bash
# Add a code contributor
npx --yes all-contributors-cli@6.26.1 add username code

# Add multiple contribution types
npx --yes all-contributors-cli@6.26.1 add username code,doc,design
```

The CLI reads the name and avatar from the GitHub profile, then updates `.all-contributorsrc` and `README.md`. Run `npx hf format --write --files=README.md` afterwards: the generator drops the blank lines around the badge and the formatter puts them back.

### Manual Method

Edit `.all-contributorsrc` directly and add to the `contributors` array:

```json
{
  "login": "username",
  "name": "Full Name",
  "avatar_url": "https://github.com/username.png",
  "profile": "https://github.com/username",
  "contributions": ["code", "doc"]
}
```

Then regenerate:

```bash
npx --yes all-contributors-cli@6.26.1 generate
npx hf format --write --files=README.md
```

`profile` may be any URL, such as a research group's site, and a contribution may be an object that points its badge at a specific issue or PR:

```json
"contributions": [{ "type": "bug", "url": "https://github.com/AndrewRedican/hyperfrontend/issues/201" }]
```

## Recognition Types

All Contributors supports these contribution types (from `all-contributors-cli` 6.26.1):

| Emoji | Type              | Description                                |
| ----- | ----------------- | ------------------------------------------ |
| ♿️    | a11y              | Accessibility                              |
| 🔊    | audio             | Audio                                      |
| 📝    | blog              | Blogposts                                  |
| 🐛    | bug               | Bug reports                                |
| 💼    | business          | Business development                       |
| 💻    | code              | Code                                       |
| 🖋    | content           | Content                                    |
| 🔣    | data              | Data                                       |
| 🎨    | design            | Design                                     |
| 📖    | doc               | Documentation                              |
| 📋    | eventOrganizing   | Event Organizing                           |
| 💡    | example           | Examples                                   |
| 💵    | financial         | Financial                                  |
| 🔍    | fundingFinding    | Funding Finding                            |
| 🤔    | ideas             | Ideas, Planning, & Feedback                |
| 🚇    | infra             | Infrastructure (Hosting, Build-Tools, etc) |
| 🚧    | maintenance       | Maintenance                                |
| 🧑‍🏫    | mentoring         | Mentoring                                  |
| 📦    | platform          | Packaging/porting to new platform          |
| 🔌    | plugin            | Plugin/utility libraries                   |
| 📆    | projectManagement | Project Management                         |
| 📣    | promotion         | Promotion                                  |
| 💬    | question          | Answering Questions                        |
| 🔬    | research          | Research                                   |
| 👀    | review            | Reviewed Pull Requests                     |
| 🛡️    | security          | Security                                   |
| 📢    | talk              | Talks                                      |
| ⚠️    | test              | Tests                                      |
| 🔧    | tool              | Tools                                      |
| 🌍    | translation       | Translation                                |
| ✅    | tutorial          | Tutorials                                  |
| 📓    | userTesting       | User Testing                               |
| 📹    | video             | Videos                                     |

### Examples

```bash
# Code contributor
npx --yes all-contributors-cli@6.26.1 add username code

# Documentation writer
npx --yes all-contributors-cli@6.26.1 add username doc

# Designer
npx --yes all-contributors-cli@6.26.1 add username design

# Bug reporter
npx --yes all-contributors-cli@6.26.1 add username bug

# Financial supporter
npx --yes all-contributors-cli@6.26.1 add username financial

# Multiple types
npx --yes all-contributors-cli@6.26.1 add username code,doc,test,review
```

## Funding Setup

### GitHub Sponsors

The project is configured for GitHub Sponsors:

1. **FUNDING.yml**: Located at `.github/FUNDING.yml`
2. **Sponsor Button**: Shows "Sponsor" button on GitHub repository
3. **Sponsor Link**: https://github.com/sponsors/AndrewRedican

### Setting Up GitHub Sponsors

1. Go to https://github.com/sponsors
2. Click "Join the waitlist" or "Set up GitHub Sponsors"
3. Complete the sponsor profile:
   - Add bio and sponsorship tiers
   - Set up payment information
   - Configure sponsorship goals
4. Once approved, the sponsor button will appear on your repository

### Package.json Funding Field

The `package.json` includes a `funding` field:

```json
"funding": {
  "type": "github",
  "url": "https://github.com/sponsors/AndrewRedican"
}
```

This shows funding info when users run `npm fund`.

### Funding Documentation

See [FUNDING.md](../FUNDING.md) for:

- Why support the project
- How to support (GitHub Sponsors, one-time donations)
- Corporate sponsorship tiers
- Other ways to contribute
- Recognition and transparency

## Workflow

### Adding a New Contributor

1. **Add the contributor**:

   ```bash
   npx --yes all-contributors-cli@6.26.1 add username bug
   ```

2. **The tool will**:
   - Update `.all-contributorsrc`
   - Update `README.md` with the new contributor

3. **Format, review and commit**, under the root project's scope:
   ```bash
   npx hf format --write --files=README.md
   git add .all-contributorsrc README.md
   git commit -m "docs(hyperfrontend): add @username as a contributor"
   ```

### Checking Contributors

Verify all contributors are properly recognized:

```bash
npx --yes all-contributors-cli@6.26.1 check
```

This compares the list with the repository's commit authors on GitHub and names anyone missing. People who contributed without a commit, such as bug reporters, never show up here.

### Regenerating Contributors Section

If you manually edit `.all-contributorsrc`, regenerate the README section:

```bash
npx --yes all-contributors-cli@6.26.1 generate
npx hf format --write --files=README.md
```

## Best Practices

### When to Add Contributors

Add contributors when they:

- ✅ Submit a merged pull request (code, doc, etc.)
- ✅ Report a significant bug with reproduction steps
- ✅ Provide valuable feedback or ideas
- ✅ Help answer questions in issues/discussions
- ✅ Create tutorials, blog posts, or videos
- ✅ Sponsor the project financially
- ✅ Help with design, testing, or infrastructure

### Multiple Contribution Types

Many contributors help in multiple ways:

```bash
# Example: Someone who codes, writes docs, and reviews PRs
npx --yes all-contributors-cli@6.26.1 add username code,doc,review
```

### Keep It Updated

- Add new contributors promptly after their contribution
- Update contribution types as contributors expand their involvement
- Celebrate all contributions, not just code!

## Recognizing Financial Supporters

### GitHub Sponsors

GitHub Sponsors are automatically recognized through the sponsor badge and FUNDING.yml.

For additional recognition:

1. Add them to the contributors list:

   ```bash
   npx --yes all-contributors-cli@6.26.1 add username financial
   ```

2. Update `FUNDING.md` with sponsor tier (Bronze/Silver/Gold/Platinum)

3. Add sponsor logo to README if applicable (for higher tiers)

### One-time Donors

Recognize one-time donors by:

1. Adding them with the `financial` type
2. Listing them in `FUNDING.md` under "Individual Sponsors"

## Commands Reference

```bash
# Add a contributor with specific types
npx --yes all-contributors-cli@6.26.1 add username type1,type2

# Regenerate the contributors section, then restore the formatting
npx --yes all-contributors-cli@6.26.1 generate
npx hf format --write --files=README.md

# Check for missing contributors
npx --yes all-contributors-cli@6.26.1 check

# View funding information
npm fund
```

## Resources

- [All Contributors Specification](https://allcontributors.org)
- [All Contributors CLI Docs](https://allcontributors.org/docs/en/cli/overview)
- [GitHub Sponsors Docs](https://docs.github.com/en/sponsors)
- [npm Funding Field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#funding)

## Questions?

For questions about contributors or funding:

**Email**: andrew.redican.mejia@gmail.com
**GitHub**: [@AndrewRedican](https://github.com/AndrewRedican)

---

**Remember**: Every contribution matters! Whether it's code, documentation, bug reports, or financial support, all contributions help make hyperfrontend better. 🚀
