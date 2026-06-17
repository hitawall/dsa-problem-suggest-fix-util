const KEY_PLACEHOLDERS = {
  gemini:    'AIza...',
  groq:      'gsk_...',
  anthropic: 'sk-ant-...',
  openai:    'sk-...',
};

document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('provider');
  const keyInput       = document.getElementById('apiKey');
  const saveBtn        = document.getElementById('saveBtn');
  const statusEl       = document.getElementById('status');

  function setStatus(text, color = '#4ade80') {
    statusEl.textContent   = text;
    statusEl.style.color   = color;
  }

  function updateForProvider(provider, keys) {
    keyInput.value       = '';
    keyInput.placeholder = KEY_PLACEHOLDERS[provider] || '...';
    if (keys?.[provider]) {
      setStatus('✓ Key saved for this provider. Paste to replace.', '#4ade80');
    } else {
      setStatus('No key set for this provider.', '#888');
    }
  }

  // Load saved provider + all keys on open
  chrome.storage.sync.get(['provider', 'keys'], ({ provider, keys }) => {
    const saved = provider || 'gemini';
    providerSelect.value = saved;
    updateForProvider(saved, keys);
  });

  // Switch provider — update placeholder and key status without saving yet
  providerSelect.addEventListener('change', () => {
    chrome.storage.sync.get('keys', ({ keys }) => {
      updateForProvider(providerSelect.value, keys);
    });
  });

  saveBtn.addEventListener('click', () => {
    const val      = keyInput.value.trim();
    const provider = providerSelect.value;

    if (!val) {
      setStatus('Please enter a key.', '#f87171');
      return;
    }

    chrome.storage.sync.get('keys', ({ keys }) => {
      const updatedKeys = { ...(keys || {}), [provider]: val };
      chrome.storage.sync.set({ provider, keys: updatedKeys }, () => {
        keyInput.value       = '';
        keyInput.placeholder = KEY_PLACEHOLDERS[provider] || '...';
        setStatus('✓ Saved.', '#4ade80');
      });
    });
  });

  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
});
