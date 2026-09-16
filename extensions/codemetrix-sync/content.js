/**
 * CodeMetrix LeetCode Sync - Content Script
 * Captures: Register Number, LeetCode Username, Problem Name/Number, Language,
 * Submitted Code, Runtime (ms), Memory (MB), Timestamp.
 */

(function() {
  const DEFAULT_SUPABASE_URL = "https://bmbdkmtplemvlglqbgee.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl";

  let lastProcessedKey = null;

  function showToast(title, message, isError = false) {
    const existing = document.getElementById('codemetrix-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'codemetrix-toast';
    if (isError) toast.className = 'error';

    toast.innerHTML = `
      <div class="cm-icon">${isError ? '⚠️' : '⚡'}</div>
      <div class="cm-content">
        <h4 style="color: ${isError ? '#f85149' : '#3fb950'}">${title}</h4>
        <p>${message}</p>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 400);
      }
    }, 4500);
  }

  function getProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : '';
  }

  function getProblemTitle() {
    const titleEl = document.querySelector('div[class*="text-title-large"], a[href*="/problems/"], div[data-cy="question-title"]');
    if (titleEl && titleEl.textContent) {
      const text = titleEl.textContent.trim();
      if (text.length > 2 && !text.includes('LeetCode')) return text;
    }

    const slug = getProblemSlug();
    if (!slug) return 'LeetCode Problem';
    return slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function getSourceCode() {
    try {
      const lines = document.querySelectorAll('.monaco-editor .view-line');
      if (lines && lines.length > 0) {
        const codeArr = [];
        lines.forEach(l => codeArr.push(l.innerText || l.textContent || ''));
        const joined = codeArr.join('\n');
        if (joined.trim().length > 10) return joined;
      }
    } catch (e) {}

    try {
      const textareas = document.querySelectorAll('textarea');
      for (const t of textareas) {
        if (t.value && t.value.length > 20) return t.value;
      }
    } catch (e) {}

    return '';
  }

  function getActiveLanguage() {
    try {
      const langBtn = document.querySelector('button[id*="headlessui-listbox-button"], [data-cy="lang-select"], div[class*="rounded"] button');
      if (langBtn && langBtn.textContent) {
        const lang = langBtn.textContent.trim();
        if (lang && !lang.includes('Run') && !lang.includes('Submit')) return lang;
      }
    } catch (e) {}
    return 'Python3';
  }

  function getLoggedLeetCodeUser() {
    try {
      const avatarLink = document.querySelector('a[href*="/u/"]');
      if (avatarLink) {
        const match = avatarLink.getAttribute('href').match(/\/u\/([^\/]+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return '';
  }

  async function syncSubmission(submissionDetails) {
    chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync', 'supabaseUrl', 'supabaseAnonKey', 'syncCount', 'localSubmissions'], async (config) => {
      const regNumber = config.registerNumber;
      if (!regNumber) {
        showToast('CodeMetrix Setup Needed', 'Click the ⚡ extension icon in toolbar to enter your Register Number.', true);
        return;
      }

      if (config.autoSync === false) {
        return;
      }

      const supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
      const supabaseKey = config.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
      const lcUsername = config.leetcodeUsername || getLoggedLeetCodeUser() || regNumber;

      const problemTitle = submissionDetails.title || getProblemTitle();
      const problemSlug = submissionDetails.slug || getProblemSlug();
      const sourceCode = submissionDetails.code || getSourceCode();
      const language = submissionDetails.language || getActiveLanguage();

      const payload = {
        register_number: regNumber,
        leetcode_username: lcUsername,
        problem_title: problemTitle,
        problem_slug: problemSlug,
        problem_difficulty: submissionDetails.difficulty || 'Medium',
        language: language,
        submission_status: 'Accepted',
        runtime_ms: submissionDetails.runtime_ms || 0,
        runtime_percentile: submissionDetails.runtime_percentile || 0,
        memory_mb: submissionDetails.memory_mb || 0,
        memory_percentile: submissionDetails.memory_percentile || 0,
        source_code: sourceCode || ("// Solution for " + problemTitle),
        submitted_at: new Date().toISOString()
      };

      // Save locally in extension memory
      let localList = config.localSubmissions || [];
      localList.unshift(payload);
      if (localList.length > 30) localList = localList.slice(0, 30);

      const newCount = (parseInt(config.syncCount || 0) + 1).toString();
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      chrome.storage.local.set({
        syncCount: newCount,
        lastSynced: `${problemTitle} (${timeNow})`,
        localSubmissions: localList
      });

      try {
        await fetch(`${supabaseUrl}/rest/v1/student_leetcode_submissions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(payload)
        });

        showToast('⚡ CodeMetrix Synced!', `${problemTitle} (${language}) captured! Click ⚡ to view code.`);
      } catch (err) {
        showToast('⚡ CodeMetrix Saved!', `${problemTitle} (${language}) saved to local archive.`);
      }
    });
  }

  function initObserver() {
    const observer = new MutationObserver(() => {
      const text = document.body.innerText || '';
      
      const isAccepted = (
        (text.includes('Accepted') && (text.includes('Runtime') || text.includes('Memory') || text.includes('Beats'))) ||
        document.querySelector('[data-e2e-locator="submission-result"]') ||
        document.querySelector('.text-green-s')
      );

      if (isAccepted) {
        const slug = getProblemSlug();
        const code = getSourceCode();
        const uniqueKey = `${slug}_${Date.now().toString().slice(0, -4)}`;

        if (lastProcessedKey !== uniqueKey) {
          lastProcessedKey = uniqueKey;

          let runtime = 0;
          let memory = 0;
          try {
            const rMatch = text.match(/Runtime\s*[:\n]?\s*([\d\.]+)\s*ms/i);
            if (rMatch) runtime = parseInt(rMatch[1]);
            const mMatch = text.match(/Memory\s*[:\n]?\s*([\d\.]+)\s*MB/i);
            if (mMatch) memory = parseFloat(mMatch[1]);
          } catch (e) {}

          syncSubmission({
            slug: slug,
            title: getProblemTitle(),
            code: code,
            language: getActiveLanguage(),
            runtime_ms: runtime,
            memory_mb: memory
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }

  console.log('⚡ CodeMetrix LeetCode Sync active and watching.');
})();
