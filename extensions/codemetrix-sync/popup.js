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
  const hintEl = document.getElementById('studentNameHint');
  const refreshCountBtn = document.getElementById('refreshCountBtn');

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

  async function fetchLiveCount(reg) {
    if (!reg) {
      syncCountEl.textContent = '0';
      return;
    }
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/student_leetcode_submissions?register_number=eq.${reg}&select=id`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact',
          'Range': '0-0'
        }
      });
      const countHeader = resp.headers.get('content-range');
      if (countHeader) {
        const total = countHeader.split('/')[1];
        if (total && total !== '*') {
          syncCountEl.textContent = total;
          chrome.storage.local.set({ syncCount: total });
          return;
        }
      }
      const data = await resp.json();
      const num = Array.isArray(data) ? data.length.toString() : '0';
      syncCountEl.textContent = num;
      chrome.storage.local.set({ syncCount: num });
    } catch (e) {
      syncCountEl.textContent = '0';
    }
  }

  async function verifyAndRegisterInstall(reg, name, section, lcUser, autoSync) {
    if (!reg) throw new Error('Register number is required.');

    const payload = {
      register_number: reg,
      student_name: name || reg,
      section: section || 'ECE',
      leetcode_username: lcUser || '',
      extension_version: chrome.runtime?.getManifest()?.version || '1.0.0',
      auto_sync_enabled: autoSync !== false,
      last_active_at: new Date().toISOString()
    };

    const saveResp = await fetch(`${SUPABASE_URL}/rest/v1/extension_installed_students`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });

    if (!saveResp.ok) {
      const errJson = await saveResp.json().catch(() => ({}));
      throw new Error(errJson.message || `Database registration failed (${saveResp.status})`);
    }
  }

  // Load saved configuration
  chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync'], (data) => {
    if (data.registerNumber) {
      regInput.value = data.registerNumber;
      leetcodeInput.value = data.leetcodeUsername || '';
      const stInfo = validateRegister(data.registerNumber);
      statusPill.className = 'status-indicator';
      statusText.textContent = 'Active';
      fetchLiveCount(data.registerNumber);

      // Heartbeat on popup open
      verifyAndRegisterInstall(
        data.registerNumber,
        data.studentName || stInfo?.name,
        stInfo?.section,
        data.leetcodeUsername,
        data.autoSync
      ).catch(() => {});
    } else {
      statusPill.className = 'status-indicator not-ready';
      statusText.textContent = 'Setup Needed';
      syncCountEl.textContent = '0';
    }

    if (typeof data.autoSync !== 'undefined') {
      autoSyncToggle.checked = data.autoSync;
      if (!data.autoSync && data.registerNumber) {
        statusPill.className = 'status-indicator not-ready';
        statusText.textContent = 'Disabled (Turned Off)';
      }
    }
  });

  autoSyncToggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ autoSync: isEnabled });
    chrome.storage.local.get(['registerNumber'], (data) => {
      if (data.registerNumber) {
        if (isEnabled) {
          statusPill.className = 'status-indicator';
          statusText.textContent = 'Active';
        } else {
          statusPill.className = 'status-indicator not-ready';
          statusText.textContent = 'Disabled (Turned Off)';
        }

        fetch(`${SUPABASE_URL}/rest/v1/extension_installed_students?register_number=eq.${encodeURIComponent(data.registerNumber)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            auto_sync_enabled: isEnabled,
            last_active_at: new Date().toISOString()
          })
        }).catch(() => {});
      }
    });
  });

  regInput.addEventListener('input', () => {
    validateRegister(regInput.value);
  });

  refreshCountBtn.addEventListener('click', () => {
    const regVal = regInput.value.trim().toUpperCase();
    if (regVal) fetchLiveCount(regVal);
  });

  saveBtn.addEventListener('click', async () => {
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
    const section = stInfo?.section || 'ECE';

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Profile...';

    try {
      // 1. Upsert into Supabase
      await verifyAndRegisterInstall(regVal, studentName, section, finalLcUser, autoSyncVal);

      // 2. Save locally in Chrome Storage
      chrome.storage.local.set({
        registerNumber: regVal,
        studentName: studentName,
        leetcodeUsername: finalLcUser,
        autoSync: autoSyncVal,
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY
      }, () => {
        try {
          if (chrome.runtime && chrome.runtime.setUninstallURL) {
            chrome.runtime.setUninstallURL(
              `https://bmbdkmtplemvlglqbgee.supabase.co/rest/v1/extension_installed_students?register_number=eq.${encodeURIComponent(regVal)}`
            );
          }
        } catch (e) {}

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile';
        saveMsg.className = 'msg success';
        saveMsg.textContent = '✓ Profile saved & active!';
        statusPill.className = 'status-indicator';
        statusText.textContent = 'Active';
        fetchLiveCount(regVal);

        setTimeout(() => {
          saveMsg.textContent = '';
        }, 3500);
      });
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile';
      saveMsg.className = 'msg error';
      saveMsg.textContent = err.message || 'Registration failed.';
    }
  });

  const resetBtn = document.getElementById('resetBtn');
  resetBtn?.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      regInput.value = '';
      leetcodeInput.value = '';
      hintEl.textContent = '';
      syncCountEl.textContent = '0';
      statusPill.className = 'status-indicator not-ready';
      statusText.textContent = 'Setup Needed';
      saveMsg.className = 'msg success';
      saveMsg.textContent = 'Local extension data cleared!';
      setTimeout(() => {
        saveMsg.textContent = '';
      }, 3000);
    });
  });
});
