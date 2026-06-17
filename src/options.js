const PROVIDERS = [
  // ── Free tier (permanent, no credit card) ────────────────────
  {
    id:          'gemini',
    name:        'Gemini',
    subtitle:    'Google AI Studio',
    model:       'gemini-2.5-flash',
    placeholder: 'AIza...',
    keyUrl:      'https://aistudio.google.com/apikey',
    freeLimit:   '~500 req/day · no credit card',
    paid:        false,
  },
  {
    id:          'groq',
    name:        'Groq',
    subtitle:    'console.groq.com',
    model:       'llama-3.3-70b-versatile',
    placeholder: 'gsk_...',
    keyUrl:      'https://console.groq.com/keys',
    freeLimit:   '1,000 req/day · no credit card',
    paid:        false,
  },
  {
    id:          'cerebras',
    name:        'Cerebras',
    subtitle:    'cloud.cerebras.ai',
    model:       'llama-3.3-70b',
    placeholder: 'csk-...',
    keyUrl:      'https://cloud.cerebras.ai/',
    freeLimit:   '1M tokens/day · no credit card',
    paid:        false,
  },
  {
    id:          'openrouter',
    name:        'OpenRouter',
    subtitle:    'openrouter.ai · 26+ free models',
    model:       'deepseek/deepseek-r1:free',
    placeholder: 'sk-or-v1-...',
    keyUrl:      'https://openrouter.ai/settings/keys',
    freeLimit:   '50–1,000 req/day · no credit card',
    paid:        false,
    modelEditable: true,
  },
  // ── Paid (small free credits for new accounts only) ──────────
  {
    id:          'anthropic',
    name:        'Anthropic',
    subtitle:    'Claude',
    model:       'claude-sonnet-4-6',
    placeholder: 'sk-ant-...',
    keyUrl:      'https://console.anthropic.com/settings/keys',
    freeLimit:   '~$5 new-user credits, then pay-as-you-go',
    paid:        true,
  },
  {
    id:          'openai',
    name:        'OpenAI',
    subtitle:    'ChatGPT / GPT-4o',
    model:       'gpt-4o',
    placeholder: 'sk-...',
    keyUrl:      'https://platform.openai.com/api-keys',
    freeLimit:   '~$5 new-user credits, then pay-as-you-go',
    paid:        true,
  },
];

// ── Build a provider card ─────────────────────────────────────
function buildCard(provider, savedKey, savedModel) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${provider.id}`;

  const hasSavedKey = Boolean(savedKey);
  const freeBadge   = provider.paid
    ? `<span class="tier-badge paid">Paid</span>`
    : `<span class="tier-badge free">Free</span>`;

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="provider-name">
          ${provider.name}
          <span class="provider-sub">${provider.subtitle}</span>
          ${freeBadge}
        </div>
        <div class="provider-meta">
          Model: <strong>${provider.model}</strong>
          &nbsp;·&nbsp;${provider.freeLimit}
          &nbsp;·&nbsp;<a href="${provider.keyUrl}" target="_blank">Get API key ↗</a>
        </div>
      </div>
      <span class="key-badge ${hasSavedKey ? 'saved' : 'missing'}" id="badge-${provider.id}">
        ${hasSavedKey ? '✓ Key saved' : 'No key'}
      </span>
    </div>

    ${provider.modelEditable ? `
    <div class="model-row">
      <label class="field-label" for="model-${provider.id}">Model ID</label>
      <input type="text" id="model-${provider.id}"
        value="${savedModel || provider.model}"
        placeholder="${provider.model}">
      <div class="field-hint">
        Browse free models at <a href="https://openrouter.ai/models?q=:free" target="_blank">openrouter.ai/models</a>
        — append <code>:free</code> to any free model ID.
      </div>
    </div>` : ''}

    <div class="input-row">
      <input type="password" id="input-${provider.id}"
        placeholder="${hasSavedKey ? '••••••••••••••••••••' : provider.placeholder}">
      <button id="save-${provider.id}">Save</button>
      ${hasSavedKey ? `<button class="clear-btn" id="clear-${provider.id}" title="Remove key">✕</button>` : ''}
    </div>
    <div class="save-status" id="status-${provider.id}"></div>
  `;

  return card;
}

function updateBadge(providerId, hasSavedKey) {
  const badge = document.getElementById(`badge-${providerId}`);
  if (!badge) return;
  badge.className  = `key-badge ${hasSavedKey ? 'saved' : 'missing'}`;
  badge.textContent = hasSavedKey ? '✓ Key saved' : 'No key';
}

function setStatus(providerId, text, color) {
  const el = document.getElementById(`status-${providerId}`);
  if (el) { el.textContent = text; el.style.color = color; }
}

// ── Event listeners ──────────────────────────────────────────
function attachListeners(provider) {
  const saveBtn  = document.getElementById(`save-${provider.id}`);
  const clearBtn = document.getElementById(`clear-${provider.id}`);
  const input    = document.getElementById(`input-${provider.id}`);
  const modelInput = provider.modelEditable
    ? document.getElementById(`model-${provider.id}`) : null;

  saveBtn?.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) {
      setStatus(provider.id, 'Enter a key first.', '#f87171');
      return;
    }
    chrome.storage.sync.get('keys', ({ keys }) => {
      const updated = { ...(keys || {}), [provider.id]: val };
      const storageUpdate = { keys: updated };

      // Save model override for OpenRouter if field is present
      if (modelInput) {
        const modelVal = modelInput.value.trim();
        if (modelVal) storageUpdate.openrouterModel = modelVal;
      }

      chrome.storage.sync.set(storageUpdate, () => {
        input.value       = '';
        input.placeholder = '••••••••••••••••••••';
        updateBadge(provider.id, true);
        setStatus(provider.id, '✓ Saved.', '#4ade80');

        if (!document.getElementById(`clear-${provider.id}`)) {
          const clearEl = document.createElement('button');
          clearEl.className   = 'clear-btn';
          clearEl.id          = `clear-${provider.id}`;
          clearEl.title       = 'Remove key';
          clearEl.textContent = '✕';
          saveBtn.insertAdjacentElement('afterend', clearEl);
          clearEl.addEventListener('click', () => handleClear(provider));
        }
      });
    });
  });

  // Save model override immediately when changed (no key re-entry needed)
  modelInput?.addEventListener('change', () => {
    const modelVal = modelInput.value.trim();
    if (modelVal) {
      chrome.storage.sync.set({ openrouterModel: modelVal }, () => {
        setStatus(provider.id, '✓ Model updated.', '#4ade80');
      });
    }
  });

  clearBtn?.addEventListener('click', () => handleClear(provider));
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn?.click(); });
}

function handleClear(provider) {
  if (!confirm(`Remove the saved key for ${provider.name}?`)) return;
  chrome.storage.sync.get('keys', ({ keys }) => {
    const updated = { ...(keys || {}) };
    delete updated[provider.id];
    chrome.storage.sync.set({ keys: updated }, () => {
      const input = document.getElementById(`input-${provider.id}`);
      if (input) { input.value = ''; input.placeholder = provider.placeholder; }
      updateBadge(provider.id, false);
      setStatus(provider.id, 'Key removed.', '#888');
      document.getElementById(`clear-${provider.id}`)?.remove();
    });
  });
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('cards');

  chrome.storage.sync.get(['keys', 'openrouterModel'], ({ keys = {}, openrouterModel }) => {
    PROVIDERS.forEach(provider => {
      const savedModel = provider.id === 'openrouter' ? openrouterModel : null;
      const card = buildCard(provider, keys[provider.id], savedModel);
      container.appendChild(card);
      attachListeners(provider);
    });
  });
});
