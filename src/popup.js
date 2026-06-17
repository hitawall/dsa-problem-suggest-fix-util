document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('apiKey');
  const saveBtn  = document.getElementById('saveBtn');
  const status   = document.getElementById('status');

  chrome.storage.sync.get('apiKey', ({ apiKey }) => {
    if (apiKey) {
      keyInput.placeholder = '••••••••••••••••••••••••';
      status.textContent = 'Key is set. Paste a new one to replace.';
    } else {
      status.textContent = 'No key set.';
      status.style.color = '#888';
    }
  });

  saveBtn.addEventListener('click', () => {
    const val = keyInput.value.trim();
    if (!val) {
      status.textContent = 'Please enter a key.';
      status.style.color = '#f87171';
      return;
    }
    chrome.storage.sync.set({ apiKey: val }, () => {
      keyInput.value = '';
      keyInput.placeholder = '••••••••••••••••••••••••';
      status.textContent = '✓ Saved.';
      status.style.color = '#4ade80';
    });
  });

  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
});
