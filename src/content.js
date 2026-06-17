(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────
  let currentBtn     = null;
  let readyObserver  = null;
  let backdropEl     = null;

  // ── SPA navigation detection ─────────────────────────────────
  // Patch history API so Angular route changes trigger re-init.
  const _origPush    = history.pushState.bind(history);
  const _origReplace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    _origPush(...args);
    setTimeout(maybeInit, 150);
  };
  history.replaceState = function (...args) {
    _origReplace(...args);
    setTimeout(maybeInit, 150);
  };
  window.addEventListener('popstate', () => setTimeout(maybeInit, 150));

  // ── Entry point ──────────────────────────────────────────────
  function maybeInit() {
    if (!/^\/problems\/[^/]+/.test(window.location.pathname)) return;
    teardown();
    waitForAngular();
  }

  function teardown() {
    if (readyObserver) { readyObserver.disconnect(); readyObserver = null; }
    if (currentBtn)    { currentBtn.remove(); currentBtn = null; }
    closeModal();
  }

  // ── Wait for Angular to render ───────────────────────────────
  // app-article is the Angular component wrapping the problem statement.
  // Falls back to attribute selectors if the component name changes.
  function waitForAngular() {
    if (findArticle()) {
      injectButton();
      return;
    }
    let attempts = 0;
    readyObserver = new MutationObserver(() => {
      attempts++;
      if (findArticle()) {
        readyObserver.disconnect();
        readyObserver = null;
        injectButton();
      } else if (attempts > 300) {
        // Give up after ~30s (300 × 100ms MutationObserver ticks)
        readyObserver.disconnect();
        readyObserver = null;
      }
    });
    readyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function findArticle() {
    return (
      document.querySelector('app-article') ||
      document.querySelector('[class*="description"]') ||
      document.querySelector('[class*="problem-statement"]')
    );
  }

  // ── Button injection ─────────────────────────────────────────
  function injectButton() {
    if (document.getElementById('ncd-debug-btn')) return;

    const btn = document.createElement('button');
    btn.id          = 'ncd-debug-btn';
    btn.textContent = '🐛 Debug with AI';
    makeDraggable(btn);
    document.body.appendChild(btn);
    currentBtn = btn;
  }

  // ── Drag + click ─────────────────────────────────────────────
  function makeDraggable(el) {
    let dragging = false;
    let didDrag  = false;
    let startX, startY, initRight, initBottom;

    el.addEventListener('mousedown', (e) => {
      dragging = true;
      didDrag  = false;
      startX   = e.clientX;
      startY   = e.clientY;
      const rect = el.getBoundingClientRect();
      initRight  = window.innerWidth  - rect.right;
      initBottom = window.innerHeight - rect.bottom;
      el.classList.add('ncd-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
        didDrag = true;
      }
      const newRight  = Math.max(0, initRight  + (startX - e.clientX));
      const newBottom = Math.max(0, initBottom + (startY - e.clientY));
      el.style.right  = newRight  + 'px';
      el.style.bottom = newBottom + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('ncd-dragging');
    });

    el.addEventListener('click', () => {
      if (didDrag) { didDrag = false; return; }
      onDebugClick();
    });
  }

  // ── DOM scraping ─────────────────────────────────────────────
  function scrapeContext() {
    const slug      = (window.location.pathname.split('/')[2] || '').toLowerCase();
    const title     = document.querySelector('h1')?.textContent?.trim() || slug;
    const statement = findArticle()?.textContent?.trim() || '';
    const language  = document.querySelector('app-code-language button')?.textContent?.trim() || '';

    const testInputs = [...document.querySelectorAll('input[type="text"]')]
      .map(i => i.value)
      .filter(Boolean);

    const testOutput = document.querySelector('.output-content')?.textContent?.trim() || '';

    let code        = null;
    let codeWarning = null;

    if (slug && language) {
      const storageKey = `${slug}_${language.toLowerCase()}_tabs`;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const tabs = JSON.parse(raw);
          const tab  = Array.isArray(tabs) ? tabs[0] : null;
          if (tab) {
            code = tab.code ?? tab.content ?? tab.value ?? tab.text ?? null;
          }
        }
      } catch (_) {
        // JSON parse error — treat as missing
      }

      if (!code) {
        const storageKey2 = `${slug}_${language.toLowerCase()}`;
        try {
          const raw2 = localStorage.getItem(storageKey2);
          if (raw2) {
            code = raw2;
          }
        } catch (_) { /* ignore */ }
      }
    }

    if (!code) {
      codeWarning = `Code not found in localStorage (key: "${slug}_${(language || '?').toLowerCase()}_tabs"). ` +
        'Try making an edit or running your code once to trigger a save, then click the button again.';
    }

    return { slug, title, statement, language, testInputs, testOutput, code, codeWarning };
  }

  // ── Click handler ────────────────────────────────────────────
  function onDebugClick() {
    const ctx = scrapeContext();
    showModal(ctx);
  }

  // ── Modal ────────────────────────────────────────────────────
  function showModal(ctx) {
    closeModal();

    const backdrop = document.createElement('div');
    backdrop.id = 'ncd-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const modal = document.createElement('div');
    modal.id = 'ncd-modal';

    const header = document.createElement('div');
    header.className = 'ncd-modal-header';

    const title = document.createElement('h3');
    title.textContent = '🐛 Debug with AI';

    const closeBtn = document.createElement('button');
    closeBtn.className   = 'ncd-close-btn';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ncd-modal-body';

    if (ctx.codeWarning) {
      const warn = document.createElement('div');
      warn.className   = 'ncd-warn';
      warn.textContent = '⚠ ' + ctx.codeWarning;
      body.appendChild(warn);
    }

    const spinner = document.createElement('div');
    spinner.className   = 'ncd-spinner';
    spinner.textContent = 'Analyzing your code…';
    body.appendChild(spinner);

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    backdropEl = backdrop;

    const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler, { once: true });

    chrome.runtime.sendMessage({ type: 'DEBUG_REQUEST', payload: ctx }, (response) => {
      if (chrome.runtime.lastError) {
        renderError(body, spinner, 'Extension error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (!response) {
        renderError(body, spinner, 'No response from background worker. Try reloading the extension.');
        return;
      }
      if (response.error) {
        renderError(body, spinner, response.error);
        return;
      }
      renderResult(body, spinner, response.result, ctx.code);
    });
  }

  function renderResult(body, spinner, text, originalCode) {
    spinner.remove();
    const correctedCode = extractCorrectedCode(text);
    if (originalCode && correctedCode) {
      renderTabbed(body, text, originalCode, correctedCode);
    } else {
      const content = document.createElement('div');
      content.innerHTML = marked.parse(text);
      body.appendChild(content);
    }
  }

  // ── Extract corrected code from LLM response ─────────────────
  // The prompt instructs the model to end with a single fenced code
  // block — we grab the last one in the response.
  function extractCorrectedCode(text) {
    const fenceRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let last = null;
    let m;
    while ((m = fenceRegex.exec(text)) !== null) last = m[1];
    return last;
  }

  // ── Tabbed explanation + diff view ───────────────────────────
  function renderTabbed(body, responseText, originalCode, correctedCode) {
    const tabBar = document.createElement('div');
    tabBar.className = 'ncd-tab-bar';

    const explainBtn = document.createElement('button');
    explainBtn.className = 'ncd-tab ncd-tab-active';
    explainBtn.textContent = 'Explanation';

    const diffBtn = document.createElement('button');
    diffBtn.className = 'ncd-tab';
    diffBtn.textContent = 'Diff';

    tabBar.appendChild(explainBtn);
    tabBar.appendChild(diffBtn);

    const explainPanel = document.createElement('div');
    explainPanel.className = 'ncd-panel';
    explainPanel.innerHTML = marked.parse(responseText);

    const diffPanel = document.createElement('div');
    diffPanel.className = 'ncd-panel ncd-panel-hidden';
    diffPanel.appendChild(buildDiffView(originalCode, correctedCode));

    explainBtn.addEventListener('click', () => {
      explainBtn.classList.add('ncd-tab-active');
      diffBtn.classList.remove('ncd-tab-active');
      explainPanel.classList.remove('ncd-panel-hidden');
      diffPanel.classList.add('ncd-panel-hidden');
    });
    diffBtn.addEventListener('click', () => {
      diffBtn.classList.add('ncd-tab-active');
      explainBtn.classList.remove('ncd-tab-active');
      diffPanel.classList.remove('ncd-panel-hidden');
      explainPanel.classList.add('ncd-panel-hidden');
    });

    body.appendChild(tabBar);
    body.appendChild(explainPanel);
    body.appendChild(diffPanel);
  }

  // ── Diff renderer ────────────────────────────────────────────
  function buildDiffView(originalCode, correctedCode) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ncd-diff-wrapper';

    const changes = Diff.diffLines(originalCode, correctedCode);
    const table = document.createElement('table');
    table.className = 'ncd-diff-table';

    let oldLine = 1;
    let newLine = 1;

    changes.forEach(part => {
      const lines = part.value.split('\n');
      if (lines.at(-1) === '') lines.pop();

      lines.forEach(lineText => {
        const tr = document.createElement('tr');

        const tdOld  = document.createElement('td');
        tdOld.className = 'ncd-ln';
        const tdNew  = document.createElement('td');
        tdNew.className = 'ncd-ln';
        const tdSign = document.createElement('td');
        tdSign.className = 'ncd-sign';
        const tdCode = document.createElement('td');
        tdCode.className = 'ncd-code';
        tdCode.textContent = lineText;

        if (part.added) {
          tr.className = 'ncd-added';
          tdOld.textContent = '';
          tdNew.textContent = newLine++;
          tdSign.textContent = '+';
        } else if (part.removed) {
          tr.className = 'ncd-removed';
          tdOld.textContent = oldLine++;
          tdNew.textContent = '';
          tdSign.textContent = '-';
        } else {
          tr.className = 'ncd-context';
          tdOld.textContent = oldLine++;
          tdNew.textContent = newLine++;
          tdSign.textContent = ' ';
        }

        tr.appendChild(tdOld);
        tr.appendChild(tdNew);
        tr.appendChild(tdSign);
        tr.appendChild(tdCode);
        table.appendChild(tr);
      });
    });

    wrapper.appendChild(table);
    return wrapper;
  }

  function renderError(body, spinner, message) {
    spinner.remove();
    const err = document.createElement('div');
    err.className   = 'ncd-error';
    err.textContent = '✖ ' + message;
    body.appendChild(err);
  }

  function closeModal() {
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  maybeInit();

})();
