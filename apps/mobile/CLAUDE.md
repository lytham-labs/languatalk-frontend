# Claude AI Assistant Instructions

## Project Overview
This is the LanguaTalk codebase - a language learning platform with chat and call features.

## Branch Naming Convention
When creating new branches, use "strukturedkaos/" as the root prefix:
- `strukturedkaos/feature-name`
- `strukturedkaos/fix-description`

## Git Practices
- Only stage the necessary files when committing (avoid using `git add -A` or `git add .`)
- Review changes carefully before staging with `git status` and `git diff`
- Stage files individually or by pattern to ensure only intended changes are committed

## Pull Request Template
When creating pull requests, use the following template:

```markdown
# Description
<!--
Provide a clear and concise description of the changes made in this PR.
Include the context and motivation for these changes.
List any dependencies that are required for this change.
-->

# Acceptance Criteria
<!--
List all the requirements that need to be met for this PR to be accepted.
Use checkboxes to track completion:
- [ ] Requirement 1
- [ ] Requirement 2
-->

# Screenshots / Videos
<!--
Add screenshots or videos to help explain your changes.
For UI changes, before/after screenshots are very helpful.
For backend changes, include relevant test output or logs.
Delete this section if not applicable.
-->
```

## Code Quality Standards
- Run lint and typecheck commands before committing:
  - `npm run lint`
  - `npm run typecheck`
  - `bundle exec rubocop` (for Ruby files)
- Ensure all tests pass
- Follow existing code patterns and conventions

## Testing
- Write tests for new functionality
- Update existing tests when modifying code
- Run the test suite before creating a PR

## Commit Messages
- Use clear, descriptive commit messages
- Follow conventional commit format when possible:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for test changes
  - `chore:` for maintenance tasks

## Data-Driven Analysis
- Always validate hypotheses with actual metrics before making conclusions
- Query relevant database tables and logs to understand patterns
- Don't make assumptions about root causes without examining the data
- Look for correlations in error rates, timing patterns, and user behavior
- Consider that low error rates (< 1%) often indicate infrastructure issues rather than code bugs