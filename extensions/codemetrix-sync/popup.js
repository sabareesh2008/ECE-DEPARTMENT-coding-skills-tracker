const SUPABASE_URL = "https://bmbdkmtplemvlglqbgee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl";

document.addEventListener('DOMContentLoaded', async () => {
  const regInput = document.getElementById('regNumber');
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  const saveBtn = document.getElementById('saveBtn');
  const saveMsg = document.getElementById('saveMsg');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const syncCountEl = document.getElementById('syncCount');
  const lastSyncedEl = document.getElementById('lastSynced');
  const hintEl = document.getElementById('studentNameHint');

  // Load saved configuration
  chrome.storage.local.get(['registerNumber', 'studentName', 'autoSync', 'syncCount', 'lastSynced'], (data) => {
    if (data.registerNumber) {
      regInput.value = data.registerNumber;
      if (data.studentName) {
        hintEl.textContent = `Student: ${data.studentName}`;
      }
      statusPill.className = 'status-indicator';
      statusText.textContent = 'Active';
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

  // Real-time lookup on typing register number
  regInput.addEventListener('input', async () => {
    const val = regInput.value.trim();
    if (val.length >= 10) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/students?register_number=eq.${val}&select=student_name,section`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        const rows = await resp.json();
        if (rows && rows.length > 0) {
          hintEl.textContent = `✓ ${rows[0].student_name} (${rows[0].section || 'ECE'})`;
          hintEl.style.color = '#3fb950';
          chrome.storage.local.set({ studentName: rows[0].student_name });
        } else {
          hintEl.textContent = 'Register number not found in directory';
          hintEl.style.color = '#f85149';
        }
      } catch (err) {
        // network silent
      }
    } else {
      hintEl.textContent = '';
    }
  });

  // Save button click
  saveBtn.addEventListener('click', () => {
    const regVal = regInput.value.trim();
    const autoSyncVal = autoSyncToggle.checked;

    if (!regVal) {
      saveMsg.className = 'msg error';
      saveMsg.textContent = 'Please enter your Register Number.';
      return;
    }

    chrome.storage.local.set({
      registerNumber: regVal,
      autoSync: autoSyncVal,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    }, () => {
      saveMsg.className = 'msg success';
      saveMsg.textContent = 'Profile saved! Ready to capture LeetCode submissions.';
      statusPill.className = 'status-indicator';
      statusText.textContent = 'Active';

      setTimeout(() => {
        saveMsg.textContent = '';
      }, 3000);
    });
  });
});
