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

  // Load saved configuration
  chrome.storage.local.get(['registerNumber', 'studentName', 'leetcodeUsername', 'autoSync', 'syncCount', 'lastSynced'], (data) => {
    if (data.registerNumber) {
      regInput.value = data.registerNumber;
      leetcodeInput.value = data.leetcodeUsername || '';
      validateRegister(data.registerNumber);
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
  regInput.addEventListener('input', () => {
    validateRegister(regInput.value);
  });

  // Save button click
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

      setTimeout(() => {
        saveMsg.textContent = '';
      }, 3000);
    });
  });
});
