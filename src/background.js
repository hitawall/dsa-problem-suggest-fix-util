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
    return { error: 'No API key set. Click the extension icon to add your Groq API key.' };
  }

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildPrompt(payload) }
        ]
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
      return { error: 'Rate limited by Groq API (429). Wait a moment and try again.' };
    }
    const body = await response.text().catch(() => '');
    return { error: `Groq API error ${response.status}: ${body.slice(0, 200)}` };
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    return { error: 'Unexpected response from Groq API — no text content.' };
  }
  return { result: text };
}

function buildSystemPrompt() {
  return `You are a coding mentor helping a student debug their solution to a data structures and algorithms problem.

Be concrete, educational, and encouraging. Format your response in markdown using EXACTLY this structure:

## Bug Identified
One clear sentence naming the bug.

## Why It Fails
Explain the root cause and which test case(s) expose it.

## Corrected Code
The complete corrected solution in a single fenced code block. Use the same language as the student's submission. Add brief inline comments ONLY on the lines you changed. This fenced code block MUST be the very last thing in your response — do not write any text after the closing fence.`;
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
