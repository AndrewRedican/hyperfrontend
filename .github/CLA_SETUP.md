# CLA Setup Instructions

This document provides instructions for the repository owner to complete the CLA (Contributor License Agreement) setup.

## What Has Been Created

The following files have been added to set up the CLA process:

1. **[SECURITY.md](../SECURITY.md)** - Security vulnerability reporting policy
2. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Comprehensive contributing guidelines
3. **[CLA.md](../CLA.md)** - The Contributor License Agreement document
4. **[.github/workflows/cla.yml](../workflows/cla.yml)** - GitHub Actions workflow for CLA enforcement
5. **[.github/ISSUE_TEMPLATE/security_vulnerability.md](../ISSUE_TEMPLATE/security_vulnerability.md)** - Security issue template
6. **[.well-known/security.txt](../../.well-known/security.txt)** - RFC 9116 compliant security contact file
7. **[.clabot](.clabot)** - CLA bot configuration (legacy, optional)

## Required Actions

To activate the CLA enforcement, you need to complete the following steps:

### 1. Create a Personal Access Token (PAT)

The CLA Assistant workflow requires a Personal Access Token with specific permissions:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it something like "CLA Assistant"
4. Set expiration (recommend: 1 year, set calendar reminder to renew)
5. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again)

### 2. Add the PAT as a Repository Secret

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CLA_PAT`
5. Value: Paste the PAT you created in step 1
6. Click "Add secret"

### 3. Enable GitHub Actions

Ensure GitHub Actions are enabled for your repository:

1. Go to Settings → Actions → General
2. Under "Actions permissions", select "Allow all actions and reusable workflows"
3. Under "Workflow permissions", select "Read and write permissions"
4. Enable "Allow GitHub Actions to create and approve pull requests"
5. Click "Save"

### 4. Test the CLA Workflow

To test that the CLA is working:

1. Create a test branch and make a small change
2. Open a pull request from a different account (or ask a friend)
3. The CLA Assistant bot should comment on the PR within a few seconds
4. The contributor can sign by commenting: `I have read the CLA Document and I hereby sign the CLA`
5. Once signed, the bot will update the PR status and create a commit in `.github/signatures/cla.json`

### 5. Optional: Update CLA Document

Review the [CLA.md](../CLA.md) file and customize if needed:

- Update effective date
- Adjust terms if necessary (consult with a lawyer if making significant changes)
- Update contact information

## How It Works

### For Contributors

1. Contributor opens a pull request
2. CLA Assistant bot checks if they've signed the CLA
3. If not signed, bot comments with instructions
4. Contributor comments: `I have read the CLA Document and I hereby sign the CLA`
5. Bot records signature in `.github/signatures/cla.json`
6. PR status updates to show CLA is signed

### For Maintainer

- All signatures are stored in `.github/signatures/cla.json` in your repository
- You can manually add/remove signatures by editing this file
- The CLA text is in `CLA.md` - any changes require contributors to re-sign
- You have full control over accepting or rejecting contributions

## Security Reporting Process

The security vulnerability reporting process is now documented:

1. **Public Disclosure Prevention**: The GitHub issue template redirects users to email for security issues
2. **Email Contact**: Security issues should be sent to `andrew.redican.mejia@gmail.com`
3. **Response Timeline**:
   - Acknowledgment within 2 business days
   - Initial assessment within 5 business days
   - Patch development within 10 days
4. **Coordinated Disclosure**: 10-day grace period before public disclosure

## Files to Review

Please review the following files and adjust as needed:

- [ ] [SECURITY.md](../SECURITY.md) - Verify email and timeline
- [ ] [CONTRIBUTING.md](../CONTRIBUTING.md) - Review setup instructions
- [ ] [CLA.md](../CLA.md) - Review legal terms (consider legal review)
- [ ] [README.md](../../README.md) - Updated with links to new docs

## Documentation Updates

The main [README.md](../../README.md) has been updated to include:

- Link to Contributing Guide
- Link to Security Policy
- Note about CLA requirement

## Additional Considerations

### Legal Review

While the CLA has been drafted with best practices in mind, you may want to have it reviewed by a lawyer, especially if:

- Your project will be used in commercial contexts
- You plan to change licensing in the future
- You want additional patent protections

### Alternative CLA Tools

If you prefer a different CLA solution:

- **CLA Assistant** (current setup) - Free, GitHub-integrated
- **EasyCLA** - Linux Foundation's CLA tool (for larger projects)
- **CLAHub** - Alternative hosted solution
- **Manual Process** - Track signatures in a spreadsheet (not recommended)

### Backup Strategy

The CLA signatures are stored in your repository at `.github/signatures/cla.json`. Consider:

- Regular backups of this file
- Archive signed CLAs periodically
- Keep a copy outside of GitHub for safety

## Support

If you encounter issues with the CLA setup:

1. Check GitHub Actions logs in the "Actions" tab
2. Verify the `CLA_PAT` secret has the correct permissions
3. Ensure the token hasn't expired
4. Check that the paths in `cla.yml` match your repository structure

## Next Steps

- [ ] Create and add PAT secret (`CLA_PAT`)
- [ ] Enable GitHub Actions with write permissions
- [ ] Test the workflow with a test PR
- [ ] Review and customize CLA text if needed
- [ ] Update security email if needed
- [ ] Consider legal review of CLA terms
- [ ] Set calendar reminder to renew PAT before expiration

---

**Created**: January 19, 2026
**Maintainer**: Andrew Redican (andrew.redican.mejia@gmail.com)
