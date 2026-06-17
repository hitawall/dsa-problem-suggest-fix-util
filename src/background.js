chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'DEBUG_REQUEST') {
    handleDebug(msg.payload)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep message channel open for async response
  }
});

async function handleDebug(payload) {
  const { provider = 'gemini', keys = {} } = await chrome.storage.sync.get(['provider', 'keys']);
  const apiKey = keys[provider];

  if (!apiKey) {
    return { error: `No API key set for ${providerLabel(provider)}. Click the extension icon to add one.` };
  }

  const system = buildSystemPrompt();
  const user   = buildPrompt(payload);

  switch (provider) {
    case 'gemini':    return callGemini(apiKey, system, user);
    case 'groq':      return callOpenAICompat('groq', apiKey, system, user);
    case 'openai':    return callOpenAICompat('openai', apiKey, system, user);
    case 'anthropic': return callAnthropic(apiKey, system, user);
    default:          return { error: `Unknown provider: ${provider}` };
  }
}

// ── Provider: Gemini ─────────────────────────────────────────
async function callGemini(apiKey, system, user) {
  const model = 'gemini-2.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 8192 }
      })
    });
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }

  if (!response.ok) return httpError(response, 'Gemini');

  const data = await response.json();
  // Gemini 2.5 Flash is a thinking model — filter out thought parts
  // (marked with thought: true) and join the visible response parts.
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('');
  if (!text) return { error: 'Unexpected response from Gemini API.' };
  return { result: text };
}

// ── Provider: Groq + OpenAI (OpenAI-compatible format) ───────
const OPENAI_COMPAT = {
  groq:   { url: 'https://api.groq.com/openai/v1/chat/completions',  model: 'llama-3.3-70b-versatile' },
  openai: { url: 'https://api.openai.com/v1/chat/completions',        model: 'gpt-4o' },
};

async function callOpenAICompat(provider, apiKey, system, user) {
  const { url, model } = OPENAI_COMPAT[provider];

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user }
        ]
      })
    });
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }

  if (!response.ok) return httpError(response, providerLabel(provider));

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: `Unexpected response from ${providerLabel(provider)} API.` };
  return { result: text };
}

// ── Provider: Anthropic ──────────────────────────────────────
async function callAnthropic(apiKey, system, user) {
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
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }

  if (!response.ok) return httpError(response, 'Anthropic');

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) return { error: 'Unexpected response from Anthropic API.' };
  return { result: text };
}

// ── Shared helpers ───────────────────────────────────────────
async function httpError(response, label) {
  if (response.status === 401 || response.status === 403) {
    return { error: `Invalid API key (${response.status}). Update it via the extension icon.` };
  }
  if (response.status === 429) {
    return { error: `Rate limited by ${label} (429). Wait a moment and try again.` };
  }
  if (response.status === 503 || response.status === 529) {
    return { error: `${label} is overloaded right now (${response.status}). Wait 30 seconds and try again, or switch to a different provider via the extension icon.` };
  }
  const body = await response.text().catch(() => '');
  return { error: `${label} API error ${response.status}: ${body.slice(0, 200)}` };
}

function providerLabel(provider) {
  return { gemini: 'Gemini', groq: 'Groq', openai: 'OpenAI', anthropic: 'Anthropic' }[provider] ?? provider;
}

// ── Prompts ──────────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a coding mentor helping a student with a data structures and algorithms problem.

IMPORTANT: First decide honestly whether the code actually contains a bug for the given inputs. Do not assume there is always a bug.

─── If the code is CORRECT ───────────────────────────────────
Respond with:

## ✅ No Bug Found
Briefly explain why the code is correct and should pass the test cases. Optionally mention minor style or efficiency notes, but do not invent problems.

─── If the code has a BUG ────────────────────────────────────
Respond with exactly this structure:

## Bug Identified
One clear sentence naming the bug.

## Why It Fails
Explain the root cause and which test case(s) expose it.

## Corrected Code
The complete corrected solution in a single fenced code block. Use the same language as the student's submission. Add brief inline comments ONLY on the changed lines. This fenced code block MUST be the very last thing in your response — do not write anything after the closing fence.`;
}

function buildPrompt(p) {
  const parts = [];
  const lang  = normalizeLanguage(p.language);

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
    'python': 'python', 'python3': 'python',
    'java': 'java', 'c++': 'cpp', 'c#': 'csharp',
    'javascript': 'javascript', 'typescript': 'typescript',
    'go': 'go', 'rust': 'rust', 'swift': 'swift',
    'kotlin': 'kotlin', 'ruby': 'ruby', 'scala': 'scala',
  };
  return map[lang.toLowerCase()] ?? lang.toLowerCase();
}
