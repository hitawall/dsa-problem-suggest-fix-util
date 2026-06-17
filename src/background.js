chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'DEBUG_REQUEST') {
    handleDebug(msg.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep message channel open for async response
  }
});

async function handleDebug(payload) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) {
    return { error: 'No API key set. Click the extension icon to add your Anthropic API key.' };
  }

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: buildPrompt(payload) }]
      })
    });
  } catch (networkErr) {
    return { error: `Network error: ${networkErr.message}` };
  }

  if (!response.ok) {
    if (response.status === 401) {
      return { error: 'Invalid API key (401). Update it via the extension icon.' };
    }
    if (response.status === 429) {
      return { error: 'Rate limited by Claude API (429). Wait a moment and try again.' };
    }
    const body = await response.text().catch(() => '');
    return { error: `Claude API error ${response.status}: ${body.slice(0, 200)}` };
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) {
    return { error: 'Unexpected response from Claude API — no text content.' };
  }
  return { result: text };
}

function buildSystemPrompt() {
  return `You are a coding mentor helping a student debug their solution to a data structures and algorithms problem.

Be concrete, educational, and encouraging. Format your response in markdown. Structure it as:
1. **Bug identified** — a short, clear statement of what is wrong
2. **Why it fails** — explain the root cause and which test case(s) it breaks
3. **Corrected code** — the fixed version in a fenced code block, with brief inline comments only on the changed lines

Keep explanations concise. Use the same language as the student's submission.`;
}

function buildPrompt(p) {
  const parts = [];
  const lang = normalizeLanguage(p.language);

  parts.push(`## Problem: ${p.title || p.slug || 'Unknown'}`);
  parts.push(`**Language:** ${p.language || 'Unknown'}`);

  if (p.statement) {
    const truncated = p.statement.length > 3000
      ? p.statement.slice(0, 3000) + '\n...[truncated]'
      : p.statement;
    parts.push(`\n## Problem Statement\n${truncated}`);
  }

  if (p.code) {
    parts.push(`\n## My Current Code\n\`\`\`${lang}\n${p.code}\n\`\`\``);
  } else {
    parts.push('\n## My Current Code\n*(Code not available — could not read from localStorage)*');
  }

  if (p.testInputs && p.testInputs.length > 0) {
    parts.push(`\n## Test Inputs\n${p.testInputs.join('\n')}`);
  }

  if (p.testOutput) {
    parts.push(`\n## Test Output\n${p.testOutput}`);
  }

  parts.push('\n## Request\nPlease identify the bug(s), explain why the code fails, and show a corrected version.');

  return parts.join('\n');
}

function normalizeLanguage(lang) {
  if (!lang) return '';
  const map = {
    'python':     'python',
    'python3':    'python',
    'java':       'java',
    'c++':        'cpp',
    'c#':         'csharp',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'go':         'go',
    'rust':       'rust',
    'swift':      'swift',
    'kotlin':     'kotlin',
    'ruby':       'ruby',
    'scala':      'scala',
  };
  return map[lang.toLowerCase()] ?? lang.toLowerCase();
}
