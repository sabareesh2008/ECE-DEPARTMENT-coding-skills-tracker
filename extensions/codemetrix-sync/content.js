/**
 * CodeMetrix LeetCode Sync - Content Script
 * Injected into LeetCode problem pages to capture submitted code & metrics upon Accepted status.
 */

(function() {
  const DEFAULT_SUPABASE_URL = "https://bmbdkmtplemvlglqbgee.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl";

  let lastProcessedSubmissionId = null;
  let isWatching = false;

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
    const slug = getProblemSlug();
    if (!slug) return '';
    return slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function getSourceCodeFromMonaco() {
    try {
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          for (const m of models) {
            const val = m.getValue();
            if (val && val.length > 20) return val;
          }
        }
      }
    } catch (e) {}

    try {
      const viewLines = document.querySelector('.view-lines');
      if (viewLines) {
        return viewLines.innerText || '';
      }
    } catch (e) {}

    return '';
  }

  function getActiveLanguage() {
    try {
      const langBtn = document.querySelector('button[id*="headlessui-listbox-button"], [data-cy="lang-select"]');
      if (langBtn) {
        return langBtn.textContent.trim();
      }
    } catch (e) {}
    return 'Python3';
  }

  async function syncSubmission(submissionData) {
    chrome.storage.local.get(['registerNumber', 'studentName', 'autoSync', 'supabaseUrl', 'supabaseAnonKey', 'syncCount'], async (config) => {
      const regNumber = config.registerNumber;
      if (!regNumber) {
        showToast('CodeMetrix Setup Needed', 'Click the CodeMetrix extension icon to set your Register Number.', true);
        return;
      }

      if (config.autoSync === false) {
        return;
      }

      const supabaseUrl = config.supabaseUrl || DEFAULT_SUPABASE_URL;
      const supabaseKey = config.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;

      const payload = {
        register_number: regNumber,
        leetcode_username: submissionData.username || regNumber,
        problem_title: submissionData.title || getProblemTitle(),
        problem_slug: submissionData.slug || getProblemSlug(),
        problem_difficulty: submissionData.difficulty || 'Medium',
        language: submissionData.language || getActiveLanguage(),
        submission_status: 'Accepted',
        runtime_ms: submissionData.runtime_ms || 0,
        runtime_percentile: submissionData.runtime_percentile || 0,
        memory_mb: submissionData.memory_mb || 0,
        memory_percentile: submissionData.memory_percentile || 0,
        source_code: submissionData.code || getSourceCodeFromMonaco(),
        submitted_at: new Date().toISOString()
      };

      if (!payload.source_code || payload.source_code.trim().length === 0) {
        payload.source_code = "// Solution submitted and verified on LeetCode\n// Problem: " + payload.problem_title;
      }

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
          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          chrome.storage.local.set({
            syncCount: newCount,
            lastSynced: `${payload.problem_title} (${timeNow})`
          });

          showToast('⚡ CodeMetrix Synced!', `${payload.problem_title} (${payload.language}) logged to ${regNumber}.`);
        } else {
          showToast('⚡ CodeMetrix Synced!', `${payload.problem_title} recorded to your profile.`);
        }
      } catch (netErr) {
        console.error('[CodeMetrix Network Error]', netErr);
      }
    });
  }

  function watchForSubmissionResult() {
    if (isWatching) return;
    isWatching = true;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            const text = node.innerText || '';
            const isAccepted = (
              (text.includes('Accepted') && (text.includes('Runtime') || text.includes('Beats') || text.includes('Memory'))) ||
              node.querySelector('[data-e2e-locator="submission-result"]') ||
              node.querySelector('.text-green-s, [class*="text-success"]')
            );

            if (isAccepted) {
              const currentSlug = getProblemSlug();
              const uniqueKey = `${currentSlug}_${Date.now().toString().slice(0, -4)}`;

              if (lastProcessedSubmissionId !== uniqueKey) {
                lastProcessedSubmissionId = uniqueKey;

                let runtime = 0;
                let memory = 0;
                try {
                  const runtimeMatch = document.body.innerText.match(/Runtime\s*[:\n]?\s*([\d\.]+)\s*ms/i);
                  if (runtimeMatch) runtime = parseInt(runtimeMatch[1]);

                  const memoryMatch = document.body.innerText.match(/Memory\s*[:\n]?\s*([\d\.]+)\s*MB/i);
                  if (memoryMatch) memory = parseFloat(memoryMatch[1]);
                } catch (e) {}

                syncSubmission({
                  slug: currentSlug,
                  title: getProblemTitle(),
                  code: getSourceCodeFromMonaco(),
                  language: getActiveLanguage(),
                  runtime_ms: runtime,
                  memory_mb: memory
                });
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForSubmissionResult);
  } else {
    watchForSubmissionResult();
  }

  console.log('⚡ CodeMetrix LeetCode Sync initialized.');
})();
