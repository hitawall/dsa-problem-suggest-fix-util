#!/usr/bin/env bash
# Apply claude-code-essentials to an existing git repository.
#
# One-liner (run from inside your project):
#   bash <(curl -fsSL https://raw.githubusercontent.com/hitawall/claude-code-essentials/main/scripts/apply.sh)
#
# Preview what would change first:
#   bash <(...) --dry-run
#
# Overwrite existing non-command files:
#   bash <(...) --force

set -euo pipefail

REPO_URL="https://github.com/hitawall/claude-code-essentials.git"
FORCE=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --force|-f) FORCE=true ;;
    --dry-run|-n) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: apply.sh [--dry-run] [--force]"
      echo ""
      echo "Applies the claude-code-essentials template to the current git repository."
      echo ""
      echo "File behaviour:"
      echo "  README.md              — always skipped (your project has its own)"
      echo "  scripts/               — always skipped (not meant to live in target repos)"
      echo "  .gitignore             — entries appended (deduped); never overwritten"
      echo "  CLAUDE.md              — essentials section appended once (idempotent)"
      echo "  .claude/commands/*.md  — always written; skipped only if already identical"
      echo "  Everything else        — skipped if file exists; use --force to overwrite"
      echo ""
      echo "Options:"
      echo "  --dry-run, -n   Show what would change without writing anything"
      echo "  --force, -f     Overwrite existing files (does not affect CLAUDE.md or commands)"
      exit 0 ;;
    *)
      echo "Unknown argument: $arg. Run with --help for usage." >&2
      exit 1 ;;
  esac
done

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not inside a git repository. cd into your project directory first." >&2
  exit 1
fi

TARGET=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Fetching template..."
git clone --depth=1 --quiet "$REPO_URL" "$TMP/template"

COPIED=()
MERGED=()
SKIPPED=()
DRY=()

CLAUDE_MARKER="<!-- claude-code-essentials -->"

# Record an action or perform it depending on --dry-run mode
record() {
  local action="$1" label="$2" src="${3:-}" dst="${4:-}"
  if [[ "$DRY_RUN" == "true" ]]; then
    DRY+=("$label")
  else
    case "$action" in
      copy)
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        COPIED+=("$label") ;;
      append)
        MERGED+=("$label") ;;
    esac
  fi
}

copy_file() {
  local src="$1"
  local rel="${src#"$TMP/template/"}"
  local dst="$TARGET/$rel"

  case "$rel" in
    README.md|scripts/*|.git|.git/*) return ;;
  esac

  # .gitignore — append new entries only, never overwrite
  if [[ "$rel" == ".gitignore" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      if [[ -f "$dst" ]]; then
        local count=0
        while IFS= read -r line; do
          [[ -z "$line" || "$line" == \#* ]] && continue
          grep -qxF "$line" "$dst" 2>/dev/null || count=$((count + 1))
        done < "$src"
        [[ $count -gt 0 ]] && DRY+=("$rel ($count new entries would be appended)")
      else
        DRY+=("$rel (new file)")
      fi
      return
    fi
    mkdir -p "$(dirname "$dst")"
    if [[ -f "$dst" ]]; then
      local added=0
      while IFS= read -r line; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        if ! grep -qxF "$line" "$dst" 2>/dev/null; then
          echo "$line" >> "$dst"
          added=1
        fi
      done < "$src"
      [[ $added -eq 1 ]] && COPIED+=("$rel (new entries appended)")
    else
      cp "$src" "$dst"
      COPIED+=("$rel")
    fi
    return
  fi

  # CLAUDE.md — append essentials section once; never overwrite
  if [[ "$rel" == "CLAUDE.md" ]]; then
    if [[ ! -f "$dst" ]]; then
      record copy "$rel (new file)" "$src" "$dst"
    elif grep -qF "$CLAUDE_MARKER" "$dst" 2>/dev/null; then
      SKIPPED+=("$rel (essentials section already present — skipped)")
    else
      record append "$rel (essentials section appended)"
      if [[ "$DRY_RUN" == "false" ]]; then
        # Append template content (skip its opening header lines) under a clear section
        {
          printf '\n---\n\n'
          printf '%s\n' "$CLAUDE_MARKER"
          printf '## Essentials (from claude-code-essentials)\n'
          printf '<!-- Rules below are managed by the template. Do not remove the marker above. -->\n\n'
          tail -n +3 "$src"
        } >> "$dst"
      fi
    fi
    return
  fi

  # .claude/commands/ — always write; these are the core deliverable
  # Exception: skip silently when content is already identical
  if [[ "$rel" == .claude/commands/* ]]; then
    if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
      SKIPPED+=("$rel (already up-to-date)")
      return
    fi
    local label="$rel"
    [[ -f "$dst" ]] && label="$rel (updated)"
    record copy "$label" "$src" "$dst"
    return
  fi

  # Everything else — skip if exists unless --force
  if [[ -f "$dst" && "$FORCE" == "false" ]]; then
    SKIPPED+=("$rel")
    return
  fi

  record copy "$rel" "$src" "$dst"
}

while IFS= read -r -d '' file; do
  copy_file "$file"
done < <(find "$TMP/template" -type f -print0 | sort -z)

echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  if [[ ${#DRY[@]} -gt 0 ]]; then
    echo "Would apply:"
    printf '  + %s\n' "${DRY[@]}"
  fi
  if [[ ${#SKIPPED[@]} -gt 0 ]]; then
    echo "Would skip:"
    printf '  ~ %s\n' "${SKIPPED[@]}"
  fi
  if [[ ${#DRY[@]} -eq 0 ]]; then
    echo "Nothing to apply — project is already up-to-date."
  fi
  echo ""
  echo "Run without --dry-run to apply."
else
  if [[ ${#COPIED[@]} -gt 0 ]]; then
    echo "Applied:"
    printf '  + %s\n' "${COPIED[@]}"
  fi
  if [[ ${#MERGED[@]} -gt 0 ]]; then
    echo "Merged:"
    printf '  ~ %s\n' "${MERGED[@]}"
  fi
  if [[ ${#SKIPPED[@]} -gt 0 ]]; then
    echo "Skipped:"
    printf '  ~ %s\n' "${SKIPPED[@]}"
    echo ""
    echo "  Use --force to overwrite skipped files (not CLAUDE.md or commands)."
  fi
  echo ""
  echo "Done. Review with: git diff --stat"
fi
