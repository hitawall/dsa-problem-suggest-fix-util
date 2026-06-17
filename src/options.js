const PROVIDERS = [
  {
    id:          'gemini',
    name:        'Gemini',
    subtitle:    'Google AI Studio',
    model:       'gemini-2.5-flash',
    placeholder: 'AIza...',
    keyUrl:      'https://aistudio.google.com/apikey',
  },
  {
    id:          'groq',
    name:        'Groq',
    subtitle:    'console.groq.com',
    model:       'llama-3.3-70b-versatile',
    placeholder: 'gsk_...',
    keyUrl:      'https://console.groq.com/keys',
  },
  {
    id:          'anthropic',
    name:        'Anthropic',
    subtitle:    'Claude',
    model:       'claude-sonnet-4-6',
    placeholder: 'sk-ant-...',
    keyUrl:      'https://console.anthropic.com/settings/keys',
  },
  {
    id:          'openai',
    name:        'OpenAI',
    subtitle:    'platform.openai.com',
    model:       'gpt-4o',
    placeholder: 'sk-...',
    keyUrl:      'https://platform.openai.com/api-keys',
  },
];

function buildCard(provider, savedKey) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${provider.id}`;

  const hasSavedKey = Boolean(savedKey);

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="provider-name">${provider.name}
          <span style="font-weight:400; color:#888; font-size:12px;"> — ${provider.subtitle}</span>
        </div>
        <div class="provider-meta">
          Model: <strong style="color:#aaa">${provider.model}</strong>
          &nbsp;·&nbsp;
          <a href="${provider.keyUrl}" target="_blank">Get API key ↗</a>
        </div>
      </div>
      <span class="key-badge ${hasSavedKey ? 'saved' : 'missing'}" id="badge-${provider.id}">
        ${hasSavedKey ? '✓ Key saved' : 'No key'}
      </span>
    </div>
    <div class="input-row">
      <input
        type="password"
        id="input-${provider.id}"
        placeholder="${hasSavedKey ? '••••••••••••••••••••' : provider.placeholder}"
      >
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
  badge.className = `key-badge ${hasSavedKey ? 'saved' : 'missing'}`;
  badge.textContent = hasSavedKey ? '✓ Key saved' : 'No key';
}

function setStatus(providerId, text, color) {
  const el = document.getElementById(`status-${providerId}`);
  if (el) { el.textContent = text; el.style.color = color; }
}

function attachListeners(provider) {
  const saveBtn  = document.getElementById(`save-${provider.id}`);
  const clearBtn = document.getElementById(`clear-${provider.id}`);
  const input    = document.getElementById(`input-${provider.id}`);

  saveBtn?.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) {
      setStatus(provider.id, 'Enter a key first.', '#f87171');
      return;
    }
    chrome.storage.sync.get('keys', ({ keys }) => {
      const updated = { ...(keys || {}), [provider.id]: val };
      chrome.storage.sync.set({ keys: updated }, () => {
        input.value       = '';
        input.placeholder = '••••••••••••••••••••';
        updateBadge(provider.id, true);
        setStatus(provider.id, '✓ Saved.', '#4ade80');

        // Add clear button if it wasn't there
        if (!document.getElementById(`clear-${provider.id}`)) {
          const clearEl = document.createElement('button');
          clearEl.className = 'clear-btn';
          clearEl.id        = `clear-${provider.id}`;
          clearEl.title     = 'Remove key';
          clearEl.textContent = '✕';
          saveBtn.insertAdjacentElement('afterend', clearEl);
          clearEl.addEventListener('click', () => handleClear(provider));
        }
      });
    });
  });

  clearBtn?.addEventListener('click', () => handleClear(provider));

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn?.click();
  });
}

function handleClear(provider) {
  if (!confirm(`Remove the saved key for ${provider.name}?`)) return;
  chrome.storage.sync.get('keys', ({ keys }) => {
    const updated = { ...(keys || {}) };
    delete updated[provider.id];
    chrome.storage.sync.set({ keys: updated }, () => {
      const input = document.getElementById(`input-${provider.id}`);
      if (input) {
        input.value       = '';
        input.placeholder = provider.placeholder;
      }
      updateBadge(provider.id, false);
      setStatus(provider.id, 'Key removed.', '#888');
      document.getElementById(`clear-${provider.id}`)?.remove();
    });
  });
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('cards');

  chrome.storage.sync.get('keys', ({ keys = {} }) => {
    PROVIDERS.forEach(provider => {
      const card = buildCard(provider, keys[provider.id]);
      container.appendChild(card);
      attachListeners(provider);
    });
  });
});
