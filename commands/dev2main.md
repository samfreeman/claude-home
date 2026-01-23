---
allowed-tools: git_status, git_checkout, git_pull, bitbucket_pr_create, bitbucket_pr_list
description: Create a PR from dev to main branch for production deployment
---

## Context
Arguments: $ARGUMENTS

## Your task

This command streamlines the process of creating a pull request from dev to main for production deployment.

### Steps:

1. **Verify current state**
   - Use `git_status` to check current branch and working tree
   - If not on dev branch, use `git_checkout` to switch to dev
   - Ensure working tree is clean

2. **Update dev branch**
   - Use `git_pull` to get latest changes from origin/dev

3. **Check for existing PR**
   - Use `bitbucket_pr_list` to check if there's already an open PR from dev to main
   - If exists, show the PR details and stop

4. **Create the PR**
   - Use `bitbucket_pr_create` with:
     - source_branch: "dev"
     - destination_branch: "main"
     - title: "Deploy to Production: Dev → Main"
     - description: Generate based on:
       - List recent commits from dev not in main
       - Include deployment checklist
       - Add any arguments provided as additional context

5. **Show PR link**
   - Display the created PR URL
   - Remind that:
     - Bitbucket pipeline will run all tests
     - Only after tests pass can the PR be merged
     - Production deployment requires manual trigger after merge

### PR Description Template:
```
## Production Deployment

### Changes included:
[List key changes from dev branch]

### Pre-deployment checklist:
- [ ] All tests passing on dev environment
- [ ] Dev environment tested by stakeholders
- [ ] No critical bugs reported
- [ ] Database migrations reviewed (if any)
- [ ] Environment variables updated (if needed)

### Deployment notes:
$ARGUMENTS

### Post-merge actions:
- Manual production deployment trigger required
- Monitor deployment logs
- Verify production health checks
```

### Examples:
- `/dev2main` - Create PR with standard checklist
- `/dev2main Includes hotfix for payment processing` - Add deployment notes
- `/dev2main URGENT: Security patch included` - Add context to PR

### Important notes:
- Only sfreeman4 can create and merge this PR
- All tests must pass before merge is allowed
- This creates the PR but does NOT auto-merge
- Production deployment is a separate manual step after merge
