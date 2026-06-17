# NeetCode Debug Overlay

A Chrome Extension that adds an AI-powered **"🐛 Debug with Claude"** button to every NeetCode problem page. Click it to get an instant explanation of what's wrong with your code and a corrected version — using your own Anthropic API key, no subscription required.

---

## What it does

1. Injects a floating, draggable button into any `neetcode.io/problems/*` page
2. On click, scrapes: problem statement, your code (from localStorage), selected language, test inputs, and test output
3. Sends the context to the Claude API via a background service worker
4. Renders Claude's response (markdown with code blocks) in a dark-themed modal overlay

---

## Installation (Developer Mode)

No Chrome Web Store required.

### 1. Clone and prepare

```bash
git clone https://github.com/hitawall/dsa-problem-suggest-fix-util.git
cd dsa-problem-suggest-fix-util

# Download the vendored markdown renderer (one-time)
curl -fsSL "https://cdn.jsdelivr.net/npm/marked@12/marked.min.js" -o src/lib/marked.min.js
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the repo root (the folder containing `manifest.json`)
5. The "NeetCode Debug Overlay" card should appear — no red error badge

### 3. Set your API key

1. Click the puzzle-piece icon in the Chrome toolbar
2. Click **NeetCode Debug Overlay**
3. Paste your `sk-ant-...` key and click **Save Key**

Get a key at [console.anthropic.com](https://console.anthropic.com/).

---

## Usage

1. Navigate to any problem, e.g. `https://neetcode.io/problems/two-sum`
2. Write your solution in the Monaco editor
3. Run your code at least once (so NeetCode saves it to localStorage)
4. Click the **🐛 Debug with Claude** button (bottom-right, draggable)
5. Read Claude's explanation and corrected code in the modal
6. Close with **×**, **ESC**, or clicking outside the modal

---

## File structure

```
manifest.json          Chrome Extension Manifest V3
.env.example           Documents the chrome.storage.sync key approach (no secrets here)
src/
  content.js           Injected into NeetCode pages — scraping, button, modal
  background.js        Service worker — reads API key, calls Claude API
  overlay.css          All styles (button + modal + markdown rendering)
  popup.html           Extension popup for API key entry
  popup.js             Reads/writes key to chrome.storage.sync
  lib/
    marked.min.js      Vendored markdown renderer (marked v12)
```

---

## Privacy

- Your API key is stored in `chrome.storage.sync` (encrypted by Chrome, synced to your Google account). It is **never** written to disk or committed to this repo.
- When you click the debug button, the problem statement, your code, and test data are sent to `api.anthropic.com`. Nothing else.
- No analytics, no telemetry, no third-party services.

---

## Development

No build step required — plain vanilla JS/CSS. To make changes:

1. Edit files in `src/`
2. Go to `chrome://extensions/` and click the **↺ reload** button on the extension card
3. Refresh the NeetCode tab

To update marked.min.js:
```bash
curl -fsSL "https://cdn.jsdelivr.net/npm/marked@12/marked.min.js" -o src/lib/marked.min.js
```

---

## Contributing

- Open an issue using `/new-issue` in Claude Code, or via the GitHub issue templates
- Branch naming: `feat/issue-{N}-{slug}` | `fix/issue-{N}-{slug}`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `type(scope): description`
- All PRs must include `Closes #N` and pass CI
