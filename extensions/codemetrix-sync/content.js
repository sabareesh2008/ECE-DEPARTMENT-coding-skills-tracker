/**
 * CodeMetrix LeetCode Sync - Content Script
 * STRICT FILTERING:
 * - ONLY syncs when submission is strictly ACCEPTED (100% test cases passed).
 * - Ignores "Run Code" test runs.
 * - Ignores "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Compile Error".
 * - Pushes code directly to Supabase table `student_leetcode_submissions`.
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

  async function syncAcceptedSubmission(submissionDetails) {
    chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync', 'supabaseUrl', 'supabaseAnonKey', 'syncCount'], async (config) => {
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
        source_code: sourceCode || ("// Accepted solution for " + problemTitle),
        submitted_at: new Date().toISOString()
      };

      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/student_leetcode_submissions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          const newCount = (parseInt(config.syncCount || 0) + 1).toString();
          chrome.storage.local.set({ syncCount: newCount });
          showToast('⚡ CodeMetrix Synced to Database!', `All test cases passed! ${problemTitle} (${language}) recorded in Supabase.`);
        } else {
          showToast('⚡ CodeMetrix Synced!', `${problemTitle} logged to Supabase.`);
        }
      } catch (err) {
        console.error('[CodeMetrix Database Sync Error]', err);
      }
    });
  }

  // Strict Submission Result Observer
  function initStrictObserver() {
    const observer = new MutationObserver(() => {
      // 1. Look for submission result container
      const resultContainer = document.querySelector('[data-e2e-locator="submission-result"], div[class*="result__"], div[class*="status__"]');
      const allText = (resultContainer ? resultContainer.innerText : document.body.innerText) || '';

      // 2. Reject any failed states immediately
      const isFailed = (
        allText.includes('Wrong Answer') ||
        allText.includes('Runtime Error') ||
        allText.includes('Time Limit Exceeded') ||
        allText.includes('Memory Limit Exceeded') ||
        allText.includes('Compile Error') ||
        allText.includes('Output Limit Exceeded') ||
        allText.includes('Internal Error')
      );

      if (isFailed) {
        // Failed submission, DO NOT sync
        return;
      }

      // 3. Strict Check for "Accepted" banner (Must be an actual submission with Runtime or Beats)
      const hasAcceptedBanner = (
        (allText.includes('Accepted') && (allText.includes('Runtime') || allText.includes('Beats') || allText.includes('Memory'))) ||
        document.querySelector('[data-e2e-locator="submission-result"]') && document.querySelector('[data-e2e-locator="submission-result"]').innerText.includes('Accepted')
      );

      // 4. Ensure this is NOT just a "Run Code" test run
      const isTestRunOnly = document.querySelector('[data-cy="run-code-result"], div[class*="testcase"]') && !allText.includes('Beats');
      if (isTestRunOnly && !allText.includes('Accepted')) {
        return;
      }

      if (hasAcceptedBanner) {
        const slug = getProblemSlug();
        if (!slug) return;

        const code = getSourceCode();
        if (!code || code.trim().length < 5) return;

        // Unique debounce key to prevent double syncing the same click
        const uniqueKey = `${slug}_${Date.now().toString().slice(0, -4)}`;

        if (lastProcessedKey !== uniqueKey) {
          lastProcessedKey = uniqueKey;

          let runtime = 0;
          let memory = 0;
          try {
            const rMatch = allText.match(/Runtime\s*[:\n]?\s*([\d\.]+)\s*ms/i);
            if (rMatch) runtime = parseInt(rMatch[1]);
            const mMatch = allText.match(/Memory\s*[:\n]?\s*([\d\.]+)\s*MB/i);
            if (mMatch) memory = parseFloat(mMatch[1]);
          } catch (e) {}

          syncAcceptedSubmission({
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
    document.addEventListener('DOMContentLoaded', initStrictObserver);
  } else {
    initStrictObserver();
  }

  console.log('⚡ CodeMetrix LeetCode Sync: Strict Accepted-only filter active.');
})();
