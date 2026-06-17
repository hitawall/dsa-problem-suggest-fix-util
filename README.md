# claude-code-essentials

A template that provisions GitHub-native project tooling and Claude Code conventions into any project — new or existing — in under 5 minutes.

---

## What's included

```
.
├── CLAUDE.md                          # Project-level Claude Code rules (extends ~/.claude/CLAUDE.md)
├── .gitignore                         # Universal, stack-agnostic ignores
├── .claude/
│   └── commands/                      # Custom slash commands for Claude Code
│       ├── new-issue.md               # /new-issue — create a GitHub issue interactively
│       ├── feature.md                 # /feature   — create a feat/issue-N-slug branch
│       ├── fix.md                     # /fix        — create a fix/issue-N-slug branch
│       └── sync.md                    # /sync       — view open issues by priority/milestone
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── config.yml                 # Disables blank issues; links to Discussions
    │   ├── bug.yml                    # Bug report form (required fields + priority)
    │   ├── feature.yml                # Feature request form (problem/solution/criteria)
    │   └── epic.yml                   # Epic form (goal, task list, definition of done)
    ├── PULL_REQUEST_TEMPLATE.md       # PR checklist with Closes #N prompt
    ├── labels.yml                     # 20 labels across 4 groups (type/priority/status/size)
    └── workflows/
        ├── sync-labels.yml            # Applies labels.yml automatically on push to main
        └── ci.yml                     # CI placeholder — uncomment your stack's section
```

---

## Applying to an existing project

This is the primary use case. Run this one-liner from inside any existing git repository:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hitawall/claude-code-essentials/main/scripts/apply.sh)
```

### Preview first (recommended)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hitawall/claude-code-essentials/main/scripts/apply.sh) --dry-run
```

Shows exactly what would be written, appended, or skipped — nothing is changed.

### How collisions are handled

| File | Behaviour |
|---|---|
| `README.md` | Always skipped — your project's README is never touched |
| `scripts/` | Always skipped — not meant to live in target repos |
| `.gitignore` | New entries appended (deduped); existing content untouched |
| `CLAUDE.md` | Template rules appended once as a guarded section — idempotent, safe to re-run |
| `.claude/commands/*.md` | Always written — these are the core deliverable; skipped only if already identical |
| `.github/**`, everything else | Skipped if the file exists; use `--force` to overwrite |

### CLAUDE.md merge in detail

If your project already has a `CLAUDE.md`, the script appends the template's rules under a clearly-marked section at the bottom:

```
---

<!-- claude-code-essentials -->
## Essentials (from claude-code-essentials)
<!-- Rules below are managed by the template. Do not remove the marker above. -->

## Git workflow
...
```

The marker makes the operation idempotent — re-running the script will detect it and skip. After applying, review the appended section and delete any rules that duplicate what you already have.

### After applying to an existing project

1. **Review `CLAUDE.md`** — remove rules that conflict with or duplicate your existing conventions.
2. **Update `.github/ISSUE_TEMPLATE/config.yml`** — replace `OWNER/REPO` with your repo path.
3. **Push to `main`** — the `sync-labels` workflow runs automatically and creates all 20 labels.
4. **Edit `.github/workflows/ci.yml`** — uncomment your stack's section; delete the placeholder step.
5. Verify slash commands work: type `/sync` in Claude Code — it should list your open issues.

---

## Starting a new project

### GitHub Template button
Click **Use this template** on the repo page, fill in the name and visibility, done.

### `gh` CLI
```bash
gh repo create my-project \
  --template hitawall/claude-code-essentials \
  --private --clone
```

### After creating from template
1. Update `.github/ISSUE_TEMPLATE/config.yml` — replace `OWNER/REPO` with your repo path.
2. Push to `main` — the `sync-labels` workflow runs and creates all 20 labels.
3. Add a `## Local commands` section to `CLAUDE.md` with your project's test/build/start commands.
4. Edit `.github/workflows/ci.yml` — uncomment your stack's section.

---

## Claude slash commands

| Command | What it does |
|---|---|
| `/new-issue` | Asks for title/type/priority, drafts body, creates issue via `gh` |
| `/feature N` | Pulls main, creates `feat/issue-N-slug`, pushes upstream |
| `/fix N` | Pulls main, creates `fix/issue-N-slug`, pushes upstream |
| `/sync` | Lists all open issues grouped by milestone and priority |

Commands are defined as prompt files in `.claude/commands/`. Claude reads them when you type the slash command. Add project-specific commands by dropping `.md` files in that directory — no registration required.

---

## Conventions

### Branch naming
| Prefix | When to use | Example |
|---|---|---|
| `feat/issue-{N}-{slug}` | New functionality | `feat/issue-12-dark-mode` |
| `fix/issue-{N}-{slug}` | Bug fixes | `fix/issue-7-login-crash` |
| `chore/{slug}` | Maintenance, tooling | `chore/update-deps` |
| `docs/{slug}` | Documentation only | `docs/api-reference` |
| `refactor/{slug}` | Code restructuring | `refactor/auth-service` |

### Commit types (Conventional Commits)

Format: `type(optional-scope): imperative description`

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `chore` | Build, tooling, dependency updates |
| `docs` | Documentation |
| `refactor` | Code change with no behavior change |
| `test` | Test additions or fixes |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvements |

### Label taxonomy
| Group | Labels | Purpose |
|---|---|---|
| `type:` | bug, feature, epic, task, chore, docs | What kind of work |
| `priority:` | critical, high, medium, low | When to do it |
| `status:` | in-progress, needs-review, blocked, wontfix | Current state |
| `size:` | XS, S, M, L, XL | Effort estimate |

---

## CLAUDE.md hierarchy

```
~/.claude/CLAUDE.md          ← Global rules (model selection, cache discipline, token efficiency)
        ↓ extends
CLAUDE.md                    ← Project rules (git workflow, slash commands, code quality)
        ↓ extends
.claude/commands/*.md        ← Slash command prompts (executed when you type /command)
```

The project `CLAUDE.md` only adds project-specific rules — it never repeats global ones. When you import this template into an existing project, the essentials section is appended so your existing rules stay intact and take precedence.

---

## Labels setup

Labels are defined in `.github/labels.yml` and synced by the `sync-labels` workflow (`crazy-max/ghaction-github-labeler@v6`). The workflow runs automatically when `labels.yml` is pushed to `main`.

**Trigger manually:**
```bash
gh workflow run sync-labels.yml
gh label list --limit 50   # verify 20 labels exist
```

**Rename a label safely** (preserves history on existing issues):
```yaml
- name: "type: chore"
  from_name: "maintenance"   # old name to rename from
  color: "fef2c0"
  description: "Maintenance, tooling, dependencies"
```

---

## Customising for your project

| File | What to change |
|---|---|
| `CLAUDE.md` | Add `## Local commands` section: test, lint, start commands |
| `.github/ISSUE_TEMPLATE/config.yml` | Replace `OWNER/REPO` with your repo path |
| `.github/workflows/ci.yml` | Uncomment your stack; delete the placeholder step |
| `.claude/commands/` | Add `.md` files for project-specific slash commands |
| `.gitignore` | Append stack-specific entries (`target/` for Rust, `*.class` for Java, etc.) |
