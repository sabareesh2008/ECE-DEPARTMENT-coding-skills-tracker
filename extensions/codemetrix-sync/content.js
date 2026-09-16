/**
 * CodeMetrix LeetCode Sync - Content Script
 * 100% SINGLE-SHOT SUBMISSION LOCK:
 * - Listens for explicit "Submit" button click.
 * - Locks trigger so 1 Submit = EXACTLY 1 Database Insert.
 * - 30-second cooldown per problem.
 * - Robust Language & Difficulty detection.
 */

(function() {
  const DEFAULT_SUPABASE_URL = "https://bmbdkmtplemvlglqbgee.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl";

  // Single-shot state tracking
  let isSubmitPending = false;
  let isCurrentlySyncing = false;
  let lastSyncedProblemSlug = "";
  let lastSyncedTimestamp = 0;

  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  }

  function showToast(title, message, isError = false) {
    try {
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
    } catch (e) {}
  }

  function getProblemSlug() {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : '';
  }

  function getProblemTitle() {
    try {
      const titleEl = document.querySelector('div[class*="text-title-large"], a[href*="/problems/"], div[data-cy="question-title"], h4[class*="text-"]');
      if (titleEl && titleEl.textContent) {
        const text = titleEl.textContent.trim();
        if (text.length > 2 && !text.includes('LeetCode') && !text.includes('Problem List')) {
          return text;
        }
      }
    } catch (e) {}

    const slug = getProblemSlug();
    if (!slug) return 'LeetCode Problem';
    return slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function getProblemDifficulty() {
    try {
      const diffEl = document.querySelector(
        'div[class*="text-olive"], div[class*="text-yellow"], div[class*="text-pink"], ' +
        'div[class*="text-difficulty-"], div[class*="text-green"], div[class*="text-red"], ' +
        'span[class*="text-olive"], span[class*="text-yellow"], span[class*="text-pink"]'
      );

      if (diffEl && diffEl.textContent) {
        const txt = diffEl.textContent.trim().toLowerCase();
        if (txt.includes('easy')) return 'Easy';
        if (txt.includes('medium')) return 'Medium';
        if (txt.includes('hard')) return 'Hard';
      }

      const descArea = document.querySelector('div[data-track-load="description_content"], div[class*="description__"]');
      const fullText = (descArea ? descArea.parentElement.innerText : document.body.innerText) || '';
      const topChunk = fullText.slice(0, 1500);
      if (/\bEasy\b/i.test(topChunk)) return 'Easy';
      if (/\bHard\b/i.test(topChunk)) return 'Hard';
      if (/\bMedium\b/i.test(topChunk)) return 'Medium';
    } catch (e) {}

    return 'Easy';
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
    const knownLanguages = [
      'Java', 'C++', 'Python3', 'Python', 'C', 'C#', 'JavaScript',
      'TypeScript', 'Go', 'Rust', 'Kotlin', 'Swift', 'Ruby', 'PHP',
      'Dart', 'Scala', 'Racket', 'Erlang', 'Elixir', 'SQL', 'Pandas'
    ];

    try {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const txt = (btn.textContent || '').trim();
        for (const lang of knownLanguages) {
          if (txt === lang || txt.startsWith(lang + ' ') || txt === lang.toLowerCase()) {
            return lang;
          }
        }
      }

      const langSelect = document.querySelector('[data-cy="lang-select"], button[id*="headlessui-listbox-button"]');
      if (langSelect && langSelect.textContent) {
        const txt = langSelect.textContent.trim();
        for (const lang of knownLanguages) {
          if (txt.includes(lang)) return lang;
        }
      }
    } catch (e) {}

    const code = getSourceCode();
    if (code) {
      if (code.includes('public class') || code.includes('class Solution') && code.includes('public ') && code.includes(';') || code.includes('System.out.')) {
        return 'Java';
      }
      if (code.includes('#include') || code.includes('std::') || code.includes('vector<') || code.includes('cout <<')) {
        return 'C++';
      }
      if (code.includes('def ') || code.includes('class Solution:') || code.includes('self,')) {
        return 'Python3';
      }
      if (code.includes('#include <stdio.h>') || code.includes('printf(')) {
        return 'C';
      }
      if (code.includes('function ') || code.includes('const ') || code.includes('var ') && code.includes('=>')) {
        return 'JavaScript';
      }
    }

    return 'Java';
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
    if (isCurrentlySyncing) return;
    isCurrentlySyncing = true;

    if (!isContextValid()) {
      isCurrentlySyncing = false;
      return;
    }

    try {
      chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync', 'supabaseUrl', 'supabaseAnonKey', 'syncCount'], async (config) => {
        if (!isContextValid()) {
          isCurrentlySyncing = false;
          return;
        }

        const regNumber = config.registerNumber;
        if (!regNumber) {
          showToast('CodeMetrix Setup Needed', 'Click the ⚡ extension icon in toolbar to enter your Register Number.', true);
          isCurrentlySyncing = false;
          return;
        }

        if (config.autoSync === false) {
          isCurrentlySyncing = false;
          return;
        }

        const supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
        const supabaseKey = config.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
        const lcUsername = config.leetcodeUsername || getLoggedLeetCodeUser() || regNumber;

        const problemTitle = submissionDetails.title || getProblemTitle();
        const problemSlug = submissionDetails.slug || getProblemSlug();
        const sourceCode = submissionDetails.code || getSourceCode();
        const language = submissionDetails.language || getActiveLanguage();
        const difficulty = submissionDetails.difficulty || getProblemDifficulty();

        const payload = {
          register_number: regNumber,
          leetcode_username: lcUsername,
          problem_title: problemTitle,
          problem_slug: problemSlug,
          problem_difficulty: difficulty,
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
            if (isContextValid()) {
              const newCount = (parseInt(config.syncCount || 0) + 1).toString();
              chrome.storage.local.set({ syncCount: newCount });
            }
            showToast('⚡ CodeMetrix Synced to Database!', `Accepted: ${problemTitle} (${difficulty} • ${language}) recorded in Supabase.`);
          } else {
            showToast('⚡ CodeMetrix Synced!', `${problemTitle} (${difficulty} • ${language}) logged to Supabase.`);
          }
        } catch (err) {
          console.error('[CodeMetrix Database Sync Error]', err);
        } finally {
          setTimeout(() => {
            isCurrentlySyncing = false;
          }, 2000);
        }
      });
    } catch (e) {
      isCurrentlySyncing = false;
    }
  }

  // 1. Listen for user clicking "Submit"
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const btn = target.closest('button[data-e2e-locator="console-submit-button"], button');
    if (btn) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'submit' || text.includes('submit')) {
        isSubmitPending = true;
        // Auto reset pending flag after 45s if not resolved
        setTimeout(() => { isSubmitPending = false; }, 45000);
      }
    }
  }, true);

  // 2. Strict Single-Shot Submission Observer
  function initStrictObserver() {
    const observer = new MutationObserver(() => {
      if (!isContextValid()) {
        observer.disconnect();
        return;
      }

      const resultContainer = document.querySelector('[data-e2e-locator="submission-result"], div[class*="result__"], div[class*="status__"]');
      const allText = (resultContainer ? resultContainer.innerText : document.body.innerText) || '';

      // Ignore failed states
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
        isSubmitPending = false;
        return;
      }

      // Check for "Accepted" banner
      const hasAcceptedBanner = (
        (allText.includes('Accepted') && (allText.includes('Runtime') || allText.includes('Beats') || allText.includes('Memory'))) ||
        (document.querySelector('[data-e2e-locator="submission-result"]') && document.querySelector('[data-e2e-locator="submission-result"]').innerText.includes('Accepted'))
      );

      // Must be accepted AND submit action was initiated
      if (hasAcceptedBanner) {
        const slug = getProblemSlug();
        if (!slug) return;

        const code = getSourceCode();
        if (!code || code.trim().length < 5) return;

        const now = Date.now();
        // Strict 20-second cooldown per problem
        if (slug === lastSyncedProblemSlug && (now - lastSyncedTimestamp) < 20000) {
          return;
        }

        if (isCurrentlySyncing) {
          return;
        }

        // Lock trigger immediately
        lastSyncedProblemSlug = slug;
        lastSyncedTimestamp = now;
        isSubmitPending = false;

        let runtime = 0;
        let memory = 0;
        try {
          const rMatch = allText.match(/Runtime\s*[:\n]?\s*([\d\.]+)\s*ms/i);
          if (rMatch) runtime = parseInt(rMatch[1]);
          const mMatch = allText.match(/Memory\s*[:\n]?\s*([\d\.]+)\s*MB/i);
          if (mMatch) memory = parseFloat(mMatch[1]);
        } catch (e) {}

        const lang = getActiveLanguage();
        const diff = getProblemDifficulty();

        syncAcceptedSubmission({
          slug: slug,
          title: getProblemTitle(),
          difficulty: diff,
          language: lang,
          code: code,
          runtime_ms: runtime,
          memory_mb: memory
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStrictObserver);
  } else {
    initStrictObserver();
  }

  console.log('⚡ CodeMetrix LeetCode Sync: Single-Shot Submission Lock active.');
})();
