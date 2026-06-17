document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('provider');
  const keyStatus      = document.getElementById('keyStatus');
  const manageBtn      = document.getElementById('manageBtn');

  function showKeyStatus(provider, keys) {
    if (keys?.[provider]) {
      keyStatus.textContent   = '✓ API key set';
      keyStatus.style.color   = '#4ade80';
    } else {
      keyStatus.textContent   = '✖ No key — add one via Manage API Keys';
      keyStatus.style.color   = '#f87171';
    }
  }

  // Load saved state
  chrome.storage.sync.get(['provider', 'keys'], ({ provider, keys }) => {
    const active = provider || 'gemini';
    providerSelect.value = active;
    showKeyStatus(active, keys);
  });

  // Save provider immediately on change — this was the persistence bug
  providerSelect.addEventListener('change', () => {
    const selected = providerSelect.value;
    chrome.storage.sync.set({ provider: selected }, () => {
      chrome.storage.sync.get('keys', ({ keys }) => {
        showKeyStatus(selected, keys);
      });
    });
  });

  manageBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
