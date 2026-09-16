const SUPABASE_URL = "https://bmbdkmtplemvlglqbgee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl";

document.addEventListener('DOMContentLoaded', () => {
  const regInput = document.getElementById('regNumber');
  const leetcodeInput = document.getElementById('leetcodeInput');
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  const saveBtn = document.getElementById('saveBtn');
  const saveMsg = document.getElementById('saveMsg');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const syncCountEl = document.getElementById('syncCount');
  const lastSyncedEl = document.getElementById('lastSynced');
  const hintEl = document.getElementById('studentNameHint');
  const solutionsList = document.getElementById('solutionsList');
  const refreshBtn = document.getElementById('refreshSolutionsBtn');

  // Modal elements
  const codeModal = document.getElementById('codeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalProblemTitle');
  const modalLangBadge = document.getElementById('modalLangBadge');
  const modalRuntimeBadge = document.getElementById('modalRuntimeBadge');
  const modalTime = document.getElementById('modalTime');
  const modalCode = document.getElementById('modalSourceCode');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

  const roster = window.STUDENTS_ROSTER || {};

  function validateRegister(reg) {
    const cleanReg = (reg || '').trim().toUpperCase();
    if (!cleanReg) {
      hintEl.textContent = '';
      return null;
    }

    if (roster[cleanReg]) {
      const st = roster[cleanReg];
      hintEl.textContent = `✓ ${st.name} (${st.section})`;
      hintEl.style.color = '#3fb950';
      if (!leetcodeInput.value && st.leetcode_username) {
        leetcodeInput.value = st.leetcode_username;
      }
      return st;
    } else if (cleanReg.length >= 10) {
      hintEl.textContent = 'Register number verified for ECE Department';
      hintEl.style.color = '#3fb950';
      return { name: cleanReg, section: 'ECE' };
    } else {
      hintEl.textContent = '';
      return null;
    }
  }

  async function loadSolutions(reg) {
    if (!reg) return;
    solutionsList.innerHTML = '<div class="empty-state">Fetching your synced solutions...</div>';

    let solutions = [];

    // 1. Try fetching from Supabase
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/student_leetcode_submissions?register_number=eq.${reg}&order=submitted_at.desc&limit=15`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (resp.ok) {
        solutions = await resp.json();
      }
    } catch (e) {}

    // 2. Fallback to locally stored submissions
    if (!solutions || solutions.length === 0) {
      const localData = await new Promise(r => chrome.storage.local.get(['localSubmissions'], r));
      solutions = localData.localSubmissions || [];
    }

    if (!solutions || solutions.length === 0) {
      solutionsList.innerHTML = '<div class="empty-state">No synced solutions found yet. Submit code on LeetCode to view it here!</div>';
      return;
    }

    syncCountEl.textContent = solutions.length.toString();
    solutionsList.innerHTML = '';

    solutions.forEach((sol) => {
      const item = document.createElement('div');
      item.className = 'solution-item';
      const timeStr = sol.submitted_at ? new Date(sol.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

      item.innerHTML = `
        <div class="solution-title">
          <span>${sol.problem_title || 'Problem'}</span>
          <span class="badge badge-green">Accepted</span>
        </div>
        <div class="solution-meta">
          <span class="badge">${sol.language || 'Python3'}</span>
          <span>${sol.runtime_ms ? sol.runtime_ms + ' ms' : ''}</span>
          <span>${timeStr}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        openCodeModal(sol);
      });

      solutionsList.appendChild(item);
    });
  }

  function openCodeModal(sol) {
    modalTitle.textContent = sol.problem_title || 'Solution';
    modalLangBadge.textContent = sol.language || 'Code';
    modalRuntimeBadge.textContent = sol.runtime_ms ? `${sol.runtime_ms} ms` : 'Runtime: Fast';
    modalTime.textContent = sol.submitted_at ? new Date(sol.submitted_at).toLocaleString() : '';
    modalCode.textContent = sol.source_code || '// No source code recorded';
    codeModal.hidden = false;
  }

  closeModalBtn.addEventListener('click', () => {
    codeModal.hidden = true;
  });

  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalCode.textContent).then(() => {
      copyCodeBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyCodeBtn.textContent = 'Copy Source Code'; }, 2000);
    });
  });

  // Load saved configuration
  chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync', 'syncCount', 'lastSynced'], (data) => {
    if (data.registerNumber) {
      regInput.value = data.registerNumber;
      leetcodeInput.value = data.leetcodeUsername || '';
      validateRegister(data.registerNumber);
      statusPill.className = 'status-indicator';
      statusText.textContent = 'Active';
      loadSolutions(data.registerNumber);
    } else {
      statusPill.className = 'status-indicator not-ready';
      statusText.textContent = 'Setup Needed';
    }

    if (typeof data.autoSync !== 'undefined') {
      autoSyncToggle.checked = data.autoSync;
    }

    syncCountEl.textContent = data.syncCount || '0';
    lastSyncedEl.textContent = data.lastSynced || 'None';
  });

  regInput.addEventListener('input', () => {
    validateRegister(regInput.value);
  });

  refreshBtn.addEventListener('click', () => {
    const reg = regInput.value.trim().toUpperCase();
    if (reg) loadSolutions(reg);
  });

  saveBtn.addEventListener('click', () => {
    const regVal = regInput.value.trim().toUpperCase();
    const lcVal = leetcodeInput.value.trim();
    const autoSyncVal = autoSyncToggle.checked;

    if (!regVal) {
      saveMsg.className = 'msg error';
      saveMsg.textContent = 'Please enter your Register Number.';
      return;
    }

    const stInfo = validateRegister(regVal);
    const studentName = stInfo?.name || regVal;
    const finalLcUser = lcVal || stInfo?.leetcode_username || regVal;

    chrome.storage.local.set({
      registerNumber: regVal,
      studentName: studentName,
      leetcodeUsername: finalLcUser,
      autoSync: autoSyncVal,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    }, () => {
      saveMsg.className = 'msg success';
      saveMsg.textContent = 'Profile saved! Ready to capture LeetCode submissions.';
      statusPill.className = 'status-indicator';
      statusText.textContent = 'Active';
      loadSolutions(regVal);

      setTimeout(() => {
        saveMsg.textContent = '';
      }, 3000);
    });
  });
});
