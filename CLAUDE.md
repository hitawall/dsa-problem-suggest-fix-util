# Project Claude Rules
# Extends ~/.claude/CLAUDE.md — do not repeat rules already defined there.

## Git workflow
- Every change starts with a GitHub issue. Run `/new-issue` before branching.
- Branch naming: `feat/issue-{N}-{slug}` | `fix/issue-{N}-{slug}` | `chore/{slug}` | `docs/{slug}`
- Commits: Conventional Commits — `type(scope): description` (imperative mood)
  Valid types: feat, fix, chore, docs, refactor, test, ci, perf
- Never push directly to `main`. All changes go through a PR.
- Every PR must include `Closes #N` in the body. Delete branch after merge.

## Slash commands
| Command | Purpose |
|---|---|
| `/new-issue` | Draft and create a GitHub issue interactively |
| `/feature` | Create `feat/issue-{N}-{slug}` branch from main |
| `/fix` | Create `fix/issue-{N}-{slug}` branch from main |
| `/sync` | List open issues grouped by milestone and priority |

## Code quality
- Tests are part of done — no PR merges without passing tests.
- Remove all debug artifacts before opening a PR.
- Justify any new dependency in the PR body.

## Token efficiency (inherits from global — key reminders)
- Prefer `gh` CLI over MCP for all GitHub operations.
- Read file sections with offset/limit, not whole files.
- Delegate large outputs (test runs, logs) to a subagent.
