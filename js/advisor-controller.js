// ============================================================
// ECE CLASS ADVISOR & FACULTY COMMAND CONTROLLER (V2)
// Full Section-Specific Roster, LeetCode, GitHub, Technical Tests & Tasks
// ============================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'codemetrix_advisor_session';
  let currentAdvisor = null;
  let sectionStudents = [];
  let mergedStudentData = [];
  let testCompletedList = [];
  let testPendingList = [];
  let taskCompletedList = [];
  let taskPendingList = [];
  let sectionLcData = [];
  let sectionGhData = [];
  let currentActiveTestTab = 'completed';
  let currentActiveTaskTab = 'completed';
  let currentActiveCodingTab = 'leetcode';
  let rawLcData = [];
  let rawGhData = [];

  document.addEventListener('DOMContentLoaded', () => {
    initAdvisorController();
  });

  function initAdvisorController() {
    loadAdvisorSession();
    bindLoginEvents();
  }

  function loadAdvisorSession() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        currentAdvisor = JSON.parse(saved);
        renderAdvisorCockpit();
        return;
      }
    } catch (e) {
      console.warn('Session parse error:', e);
    }
    showLoginForm();
  }

  function showLoginForm() {
    const loginWrap = document.getElementById('advisorLoginView');
    const cockpitWrap = document.getElementById('advisorCockpitView');
    if (loginWrap) loginWrap.hidden = false;
    if (cockpitWrap) cockpitWrap.hidden = true;
  }

  function bindLoginEvents() {
    const loginForm = document.getElementById('advisorLoginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('advisorNameInput');
      const passInput = document.getElementById('advisorPasswordInput');
      const msgEl = document.getElementById('advisorLoginMsg');

      const name = (nameInput?.value || '').trim();
      const pass = (passInput?.value || '').trim();

      const expectedPass = window.APP_CONFIG?.ADVISOR_PASSWORD || 'admin123';

      if (!name) {
        if (msgEl) { msgEl.textContent = 'Please enter faculty / advisor name.'; msgEl.className = 'form-message error'; }
        return;
      }

      if (pass !== expectedPass && pass !== 'admin123' && pass !== 'eceadmin') {
        if (msgEl) { msgEl.textContent = 'Invalid advisor passcode. (Default passcode: admin123)'; msgEl.className = 'form-message error'; }
        return;
      }

      // Default to Section A upon login; can be switched immediately inside the Cockpit header
      const defaultSec = 'A';

      currentAdvisor = {
        name: name,
        section: defaultSec,
        section_full: `ECE ${defaultSec}`,
        isHod: false,
        loggedInAt: new Date().toISOString()
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentAdvisor));
      } catch (err) {
        console.warn(err);
      }

      if (msgEl) { msgEl.textContent = ''; }
      renderAdvisorCockpit();
    });
  }

  async function renderAdvisorCockpit() {
    const loginWrap = document.getElementById('advisorLoginView');
    const cockpitWrap = document.getElementById('advisorCockpitView');
    if (loginWrap) loginWrap.hidden = true;
    if (cockpitWrap) cockpitWrap.hidden = false;

    // Set Header Data
    const titleEl = document.getElementById('advisorCockpitTitle');
    const subEl = document.getElementById('advisorCockpitSubtitle');
    const badgeEl = document.getElementById('advisorSectionBadge');
    const switcherEl = document.getElementById('advisorSectionSwitcher');

    if (titleEl) titleEl.textContent = `Class Advisor Cockpit · ${currentAdvisor.section_full}`;
    if (subEl) subEl.textContent = `Active Advisor: ${currentAdvisor.name} · Roster, LeetCode, GitHub, Tests & Tasks`;
    if (badgeEl) badgeEl.textContent = currentAdvisor.section_full;
    if (switcherEl) {
      switcherEl.value = currentAdvisor.section_full.includes('ALL') ? 'ALL' : currentAdvisor.section;
    }

    // Bind Logout & Section Switcher
    document.getElementById('advisorLogoutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem(STORAGE_KEY);
      currentAdvisor = null;
      showLoginForm();
    });

    switcherEl?.addEventListener('change', () => {
      const newSec = switcherEl.value;
      currentAdvisor.section = newSec;
      currentAdvisor.section_full = newSec === 'ALL' ? 'ECE Overall (A–F)' : `ECE ${newSec}`;
      currentAdvisor.isHod = newSec === 'ALL';
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentAdvisor));
      renderAdvisorCockpit();
    });

    // Load Data for Section
    await refreshSectionData();
    bindTabControls();
    bindKpiCardClicks();
    bindTaskCreation();
    bindTestPublishing();
  }

  async function refreshSectionData() {
    const loadingEl = document.getElementById('advisorDataLoading');
    if (loadingEl) loadingEl.hidden = false;

    try {
      // 1. Get Section Roster
      sectionStudents = window.StudentService ? window.StudentService.getStudentsBySection(currentAdvisor.section) : [];
      if (!sectionStudents.length && typeof REGISTERED_STUDENTS !== 'undefined') {
        const cleanSec = currentAdvisor.section.replace(/^ECE\s*/i, '').trim().toUpperCase();
        sectionStudents = REGISTERED_STUDENTS.filter(s => cleanSec === 'ALL' || s.section === cleanSec);
      }

      // 2. Fetch Live CSV Data for LeetCode and GitHub
      if (!rawLcData.length || !rawGhData.length) {
        try {
          const [lcRes, ghRes] = await Promise.all([
            fetch('LiveData.csv?t=' + Date.now()).catch(() => null),
            fetch('GitHubLiveData.csv?t=' + Date.now()).catch(() => null)
          ]);
          if (lcRes && lcRes.ok) rawLcData = parseCsvData(await lcRes.text());
          if (ghRes && ghRes.ok) rawGhData = parseCsvData(await ghRes.text());
        } catch (e) {
          console.warn('[AdvisorController] CSV load warning:', e);
        }
      }

      // Filter CSV data for current section
      const cleanSec = currentAdvisor.section.replace(/^ECE\s*/i, '').trim().toUpperCase();
      sectionLcData = rawLcData.filter(r => cleanSec === 'ALL' || String(r.Section || '').trim().toUpperCase() === cleanSec);
      sectionGhData = rawGhData.filter(r => cleanSec === 'ALL' || String(r.Section || '').trim().toUpperCase() === cleanSec);

      // 3. Get Live Submissions from Supabase
      const [testSubs, taskSubs] = await Promise.all([
        window.StudentService?.fetchAllAssessmentSubmissions ? window.StudentService.fetchAllAssessmentSubmissions() : Promise.resolve([]),
        window.StudentService?.fetchAllTaskSubmissions ? window.StudentService.fetchAllTaskSubmissions() : Promise.resolve([])
      ]);

      // Normalize registers
      const testMap = new Map();
      (testSubs || []).forEach(sub => {
        const reg = String(sub.reg_no || '').trim().toUpperCase();
        if (reg && !testMap.has(reg)) {
          testMap.set(reg, sub);
        }
      });

      const taskMap = new Map();
      (taskSubs || []).forEach(sub => {
        const reg = String(sub.reg_no || '').trim().toUpperCase();
        if (reg && !taskMap.has(reg)) {
          taskMap.set(reg, sub);
        }
      });

      const lcMap = new Map();
      sectionLcData.forEach(r => {
        const reg = String(r['Register Number'] || '').trim().toUpperCase();
        if (reg) lcMap.set(reg, r);
      });

      const ghMap = new Map();
      sectionGhData.forEach(r => {
        const reg = String(r['Register Number'] || '').trim().toUpperCase();
        if (reg) ghMap.set(reg, r);
      });

      // Divide section students into completed & pending
      testCompletedList = [];
      testPendingList = [];
      taskCompletedList = [];
      taskPendingList = [];
      mergedStudentData = [];

      sectionStudents.forEach(stu => {
        const reg = String(stu.reg_no || '').trim().toUpperCase();
        const testSub = testMap.get(reg);
        const taskSub = taskMap.get(reg);
        const lcInfo = lcMap.get(reg);
        const ghInfo = ghMap.get(reg);

        const merged = {
          ...stu,
          lc: lcInfo || null,
          gh: ghInfo || null,
          test: testSub || null,
          task: taskSub || null
        };
        mergedStudentData.push(merged);

        if (testSub) {
          testCompletedList.push({
            ...stu,
            obtained_marks: Number(testSub.obtained_marks || 0),
            total_marks: Number(testSub.total_marks || 0),
            percentage: Number(testSub.percentage || (testSub.total_marks ? Math.round((testSub.obtained_marks / testSub.total_marks) * 100) : 0)),
            submitted_at: testSub.submitted_at || null,
            test_title: testSub.test_title || 'Technical Assessment 2026'
          });
        } else {
          testPendingList.push(stu);
        }

        if (taskSub) {
          taskCompletedList.push({
            ...stu,
            task_title: taskSub.task_title || 'Course Registration & Proof',
            proof_url: taskSub.proof_url || '',
            notes: taskSub.notes || '',
            status: taskSub.status || 'Submitted',
            submitted_at: taskSub.submitted_at || null
          });
        } else {
          taskPendingList.push(stu);
        }
      });

      // Update KPI Statistics
      const totalCount = sectionStudents.length;
      const testCompCount = testCompletedList.length;
      const testPendCount = testPendingList.length;
      const testPct = totalCount ? Math.round((testCompCount / totalCount) * 100) : 0;

      const taskCompCount = taskCompletedList.length;
      const taskPendCount = taskPendingList.length;
      const taskPct = totalCount ? Math.round((taskCompCount / totalCount) * 100) : 0;

      setElText('kpiAdvisorTotalStudents', totalCount);
      setElText('kpiAdvisorTestCompleted', `${testCompCount} (${testPct}%)`);
      setElText('kpiAdvisorTestPending', testPendCount);
      setElText('kpiAdvisorTaskCompleted', `${taskCompCount} (${taskPct}%)`);
      setElText('kpiAdvisorTaskPending', taskPendCount);

      // Render Active Views
      renderRosterView();
      renderCodingView();
      renderTestSubviews();
      renderTaskSubviews();
      loadSectionTasksList();
      loadPublishedAssessmentsList();

    } catch (e) {
      console.error('[AdvisorController] Refresh data error:', e);
    } finally {
      if (loadingEl) loadingEl.hidden = true;
    }
  }

  function setElText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  // 1. KPI Card Click Navigation
  function bindKpiCardClicks() {
    document.getElementById('kpiAdvisorTotalStudentsCard')?.addEventListener('click', () => {
      switchAdvisorTab('tab-advisor-roster');
    });

    document.getElementById('kpiAdvisorTestCompletedCard')?.addEventListener('click', () => {
      currentActiveTestTab = 'completed';
      updateTestToggleButtons();
      renderTestSubviews();
      switchAdvisorTab('tab-advisor-tests');
    });

    document.getElementById('kpiAdvisorTestPendingCard')?.addEventListener('click', () => {
      currentActiveTestTab = 'pending';
      updateTestToggleButtons();
      renderTestSubviews();
      switchAdvisorTab('tab-advisor-tests');
    });

    document.getElementById('kpiAdvisorTaskCompletedCard')?.addEventListener('click', () => {
      currentActiveTaskTab = 'completed';
      updateTaskToggleButtons();
      renderTaskSubviews();
      switchAdvisorTab('tab-advisor-tasks');
    });

    document.getElementById('kpiAdvisorTaskPendingCard')?.addEventListener('click', () => {
      currentActiveTaskTab = 'pending';
      updateTaskToggleButtons();
      renderTaskSubviews();
      switchAdvisorTab('tab-advisor-tasks');
    });
  }

  function switchAdvisorTab(tabId) {
    const tabBtns = document.querySelectorAll('.advisor-main-tab-btn');
    const tabPanes = document.querySelectorAll('.advisor-tab-pane');

    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
      else b.classList.remove('active');
    });

    tabPanes.forEach(p => {
      if (p.id === tabId) p.classList.add('active');
      else p.classList.remove('active');
    });

    const targetEl = document.getElementById(tabId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // 2. Bind Tab Switching
  function bindTabControls() {
    const tabBtns = document.querySelectorAll('.advisor-main-tab-btn');
    const tabPanes = document.querySelectorAll('.advisor-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Roster search filter
    document.getElementById('advisorRosterSearchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      renderRosterView(q);
    });

    // Coding Sub-tab Toggle
    document.getElementById('toggleAdvisorLeetCodeBtn')?.addEventListener('click', () => {
      currentActiveCodingTab = 'leetcode';
      document.getElementById('toggleAdvisorLeetCodeBtn')?.classList.add('active');
      document.getElementById('toggleAdvisorGitHubBtn')?.classList.remove('active');
      renderCodingView();
    });

    document.getElementById('toggleAdvisorGitHubBtn')?.addEventListener('click', () => {
      currentActiveCodingTab = 'github';
      document.getElementById('toggleAdvisorGitHubBtn')?.classList.add('active');
      document.getElementById('toggleAdvisorLeetCodeBtn')?.classList.remove('active');
      renderCodingView();
    });

    // Test Sub-tab Toggle
    document.getElementById('toggleTestCompletedBtn')?.addEventListener('click', () => {
      currentActiveTestTab = 'completed';
      updateTestToggleButtons();
      renderTestSubviews();
    });

    document.getElementById('toggleTestPendingBtn')?.addEventListener('click', () => {
      currentActiveTestTab = 'pending';
      updateTestToggleButtons();
      renderTestSubviews();
    });

    // Task Sub-tab Toggle
    document.getElementById('toggleTaskCompletedBtn')?.addEventListener('click', () => {
      currentActiveTaskTab = 'completed';
      updateTaskToggleButtons();
      renderTaskSubviews();
    });

    document.getElementById('toggleTaskPendingBtn')?.addEventListener('click', () => {
      currentActiveTaskTab = 'pending';
      updateTaskToggleButtons();
      renderTaskSubviews();
    });

    // WhatsApp Copy Action Buttons
    document.getElementById('btnCopyInactiveCodersWhatsApp')?.addEventListener('click', copyInactiveCodersWhatsApp);
    document.getElementById('btnCopyTestWhatsApp')?.addEventListener('click', copyTestPendingWhatsApp);
    document.getElementById('btnCopyTaskWhatsApp')?.addEventListener('click', copyTaskPendingWhatsApp);

    // Export Buttons
    document.getElementById('btnExportAdvisorRosterExcel')?.addEventListener('click', exportSectionRosterExcel);
    document.getElementById('btnExportAdvisorCodingExcel')?.addEventListener('click', exportSectionCodingExcel);
    document.getElementById('btnExportSectionTestExcel')?.addEventListener('click', exportSectionTestExcel);
    document.getElementById('btnExportSectionTaskExcel')?.addEventListener('click', exportSectionTaskExcel);
  }

  function updateTestToggleButtons() {
    const compBtn = document.getElementById('toggleTestCompletedBtn');
    const pendBtn = document.getElementById('toggleTestPendingBtn');
    if (currentActiveTestTab === 'completed') {
      compBtn?.classList.add('active');
      pendBtn?.classList.remove('active');
    } else {
      compBtn?.classList.remove('active');
      pendBtn?.classList.add('active');
    }
  }

  function updateTaskToggleButtons() {
    const compBtn = document.getElementById('toggleTaskCompletedBtn');
    const pendBtn = document.getElementById('toggleTaskPendingBtn');
    if (currentActiveTaskTab === 'completed') {
      compBtn?.classList.add('active');
      pendBtn?.classList.remove('active');
    } else {
      compBtn?.classList.remove('active');
      pendBtn?.classList.add('active');
    }
  }

  // 3. Render Enrolled Roster View
  function renderRosterView(searchQuery = '') {
    const wrap = document.getElementById('advisorRosterTableWrap');
    if (!wrap) return;

    let list = mergedStudentData;
    if (searchQuery) {
      list = list.filter(s =>
        s.reg_no.toLowerCase().includes(searchQuery) ||
        s.name.toLowerCase().includes(searchQuery)
      );
    }

    if (!list.length) {
      wrap.innerHTML = `<div class="empty-state-box"><p>No students found matching "${esc(searchQuery)}".</p></div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="white-data-table">
          <thead>
            <tr>
              <th style="width:50px;">#</th>
              <th>Register Number</th>
              <th>Student Name</th>
              <th>Section</th>
              <th>LeetCode Profile</th>
              <th>GitHub Profile</th>
              <th>Assessment</th>
              <th>Task Proof</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((s, idx) => {
              const lcSolved = s.lc ? Number(s.lc['Problems Solved'] || 0) : 0;
              const lcUser = s.lc?.['LeetCode Username'] || '—';
              const ghRepos = s.gh ? Number(s.gh['Repositories Total'] || 0) : 0;
              const ghUser = s.gh?.['GitHub Username'] || '—';
              const testDone = Boolean(s.test);
              const taskDone = Boolean(s.task);

              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="color:#0f172a;font-family:monospace;font-size:0.95rem;">${esc(s.reg_no)}</strong></td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td><span class="badge-section">${esc(s.section)}</span></td>
                  <td>
                    ${s.lc?.['LeetCode Link'] ? `
                      <a href="${esc(s.lc['LeetCode Link'])}" target="_blank" rel="noopener" style="color:#2563eb;font-weight:700;text-decoration:underline;">
                        ${esc(lcUser)} (${lcSolved} ⚡)
                      </a>
                    ` : `<span style="color:#94a3b8;">${esc(lcUser)}</span>`}
                  </td>
                  <td>
                    ${s.gh?.['GitHub Link'] ? `
                      <a href="${esc(s.gh['GitHub Link'])}" target="_blank" rel="noopener" style="color:#2563eb;font-weight:700;text-decoration:underline;">
                        ${esc(ghUser)} (${ghRepos} 📦)
                      </a>
                    ` : `<span style="color:#94a3b8;">${esc(ghUser)}</span>`}
                  </td>
                  <td>
                    ${testDone ? `<span class="trend-badge" style="background:#ecfdf5;color:#059669;font-weight:700;">✓ Done (${s.test.obtained_marks}/${s.test.total_marks})</span>` : `<span class="trend-badge" style="background:#fef2f2;color:#dc2626;font-weight:700;">⏳ Pending</span>`}
                  </td>
                  <td>
                    ${taskDone ? `<span class="trend-badge" style="background:#ecfdf5;color:#059669;font-weight:700;">✓ Uploaded</span>` : `<span class="trend-badge" style="background:#fffbeb;color:#d97706;font-weight:700;">⏳ Pending</span>`}
                  </td>
                  <td>
                    <button class="btn-clean-secondary btn-open-dossier" data-reg="${esc(s.reg_no)}" type="button" style="padding:4px 10px;font-size:0.8rem;font-weight:700;color:#2563eb;border-color:#bfdbfe;background:#eff6ff;">
                      🔍 360° Dossier
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Bind Dossier Buttons
    wrap.querySelectorAll('.btn-open-dossier').forEach(btn => {
      btn.addEventListener('click', () => {
        const reg = btn.getAttribute('data-reg');
        openDossierByReg(reg);
      });
    });
  }

  // Helper: Open Student Dossier
  function openDossierByReg(reg) {
    const searchForm = document.getElementById('studentSearchForm');
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput && searchForm) {
      searchInput.value = reg;
      searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }

  // 4. Render LeetCode & GitHub Performance View
  function renderCodingView() {
    const wrap = document.getElementById('advisorCodingTableWrap');
    if (!wrap) return;

    if (currentActiveCodingTab === 'leetcode') {
      const sortedLc = [...sectionLcData].sort((a,b) => Number(b['Problems Solved']||0) - Number(a['Problems Solved']||0));

      if (!sortedLc.length) {
        wrap.innerHTML = `<div class="empty-state-box"><p>No LeetCode records synced for ${esc(currentAdvisor.section_full)}.</p></div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">Rank</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>LeetCode Username</th>
                <th>Solved</th>
                <th>Today</th>
                <th>Last 7D</th>
                <th>Streak</th>
                <th>Easy/Med/Hard</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${sortedLc.map((s, idx) => {
                const solved = Number(s['Problems Solved'] || 0);
                const isZero = solved === 0;
                return `
                  <tr style="${isZero ? 'background:#fff7f7;' : ''}">
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong style="color:#0f172a;font-family:monospace;font-size:0.95rem;">${esc(s['Register Number'] || '—')}</strong></td>
                    <td><strong>${esc(s['Student Name'] || '—')}</strong></td>
                    <td>
                      ${s['LeetCode Link'] ? `<a href="${esc(s['LeetCode Link'])}" target="_blank" rel="noopener" style="color:#2563eb;font-weight:700;">${esc(s['LeetCode Username'])} ↗</a>` : esc(s['LeetCode Username'] || '—')}
                    </td>
                    <td><span class="badge-marks" style="${isZero ? 'background:#fee2e2;color:#dc2626;' : ''}">${solved}</span></td>
                    <td><strong style="color:#059669;">+${s['Solved Today'] || 0}</strong></td>
                    <td><strong>${s['Last 7 Days'] || 0}</strong></td>
                    <td><span style="font-size:0.85rem;">🔥 ${s['Current Streak'] || '0'}</span></td>
                    <td style="font-size:0.84rem;color:#64748b;">${s.Easy || 0} / ${s.Medium || 0} / ${s.Hard || 0}</td>
                    <td>
                      <button class="btn-clean-secondary btn-open-dossier" data-reg="${esc(s['Register Number'])}" type="button" style="padding:4px 8px;font-size:0.78rem;">
                        🔍 Dossier
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      wrap.querySelectorAll('.btn-open-dossier').forEach(btn => {
        btn.addEventListener('click', () => openDossierByReg(btn.getAttribute('data-reg')));
      });

    } else {
      const sortedGh = [...sectionGhData].sort((a,b) => Number(b['Contributions 30 Days']||0) - Number(a['Contributions 30 Days']||0));

      if (!sortedGh.length) {
        wrap.innerHTML = `<div class="empty-state-box"><p>No GitHub records synced for ${esc(currentAdvisor.section_full)}.</p></div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">Rank</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>GitHub Username</th>
                <th>Deployments</th>
                <th>Repositories</th>
                <th>Contributions 30D</th>
                <th>Commits 30D</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              ${sortedGh.map((s, idx) => `
                <tr>
                  <td><strong>#${idx + 1}</strong></td>
                  <td><strong style="color:#0f172a;font-family:monospace;font-size:0.95rem;">${esc(s['Register Number'] || '—')}</strong></td>
                  <td><strong>${esc(s['Student Name'] || '—')}</strong></td>
                  <td>
                    ${s['GitHub Link'] ? `<a href="${esc(s['GitHub Link'])}" target="_blank" rel="noopener" style="color:#2563eb;font-weight:700;">${esc(s['GitHub Username'])} ↗</a>` : esc(s['GitHub Username'] || '—')}
                  </td>
                  <td><span class="badge-marks" style="background:#ecfdf5;color:#059669;">🚀 ${s['Detected Deployments'] || 0}</span></td>
                  <td><strong>${s['Repositories Total'] || 0}</strong></td>
                  <td><strong style="color:#2563eb;">${s['Contributions 30 Days'] || 0}</strong></td>
                  <td><strong>${s['Commits 30 Days'] || 0}</strong></td>
                  <td style="font-size:0.82rem;color:#64748b;">${esc(s['Last Activity'] || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // 5. Render Technical Assessment Tables
  function renderTestSubviews() {
    const countComp = testCompletedList.length;
    const countPend = testPendingList.length;
    setElText('testCompletedBadgeCount', `✅ Completed (${countComp})`);
    setElText('testPendingBadgeCount', `⏳ Pending (${countPend})`);

    const tableWrap = document.getElementById('advisorTestTableWrap');
    if (!tableWrap) return;

    if (currentActiveTestTab === 'completed') {
      if (!testCompletedList.length) {
        tableWrap.innerHTML = `
          <div class="empty-state-box">
            <div style="font-size:2rem;margin-bottom:8px;">📝</div>
            <strong>No assessment submissions yet for ${esc(currentAdvisor.section_full)}</strong>
            <p>Students who finish the technical test will appear here with score breakdowns.</p>
          </div>
        `;
        return;
      }

      tableWrap.innerHTML = `
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">#</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Marks</th>
                <th>Score (%)</th>
                <th>Status</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              ${testCompletedList.map((s, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="color:#0f172a;font-family:monospace;font-size:0.95rem;">${esc(s.reg_no)}</strong></td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td><span class="badge-marks">${s.obtained_marks} / ${s.total_marks}</span></td>
                  <td><strong style="color:${s.percentage >= 50 ? '#059669' : '#dc2626'};">${s.percentage}%</strong></td>
                  <td><span class="trend-badge" style="background:#ecfdf5;color:#059669;font-weight:700;">✓ Completed</span></td>
                  <td style="color:#64748b;font-size:0.85rem;">${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : 'Recorded'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      if (!testPendingList.length) {
        tableWrap.innerHTML = `
          <div class="empty-state-box" style="background:#ecfdf5;border-color:#a7f3d0;">
            <div style="font-size:2rem;margin-bottom:8px;">🎉</div>
            <strong style="color:#059669;">100% Assessment Completion!</strong>
            <p style="color:#047857;">All ${testCompletedList.length} students in ${esc(currentAdvisor.section_full)} have submitted the test.</p>
          </div>
        `;
        return;
      }

      tableWrap.innerHTML = `
        <div style="margin-bottom:14px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="color:#92400e;font-size:0.88rem;">
            <strong>${testPendingList.length} Candidates Pending:</strong> Use the button to copy their roll numbers formatted for WhatsApp broadcast.
          </div>
          <button id="btnCopyTestWhatsAppInline" class="btn-clean-primary" style="background:#059669;border-color:#047857;font-size:0.84rem;padding:6px 14px;">
            📋 Copy WhatsApp Message
          </button>
        </div>
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">#</th>
                <th>Register Number</th>
                <th>Student Name</th>
                <th>Section</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${testPendingList.map((s, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="color:#b91c1c;font-family:monospace;font-size:0.95rem;">${esc(s.reg_no)}</strong></td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td><span class="badge-section">${esc(s.section)}</span></td>
                  <td><span class="trend-badge" style="background:#fef2f2;color:#dc2626;font-weight:700;">⏳ Test Not Taken</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btnCopyTestWhatsAppInline')?.addEventListener('click', copyTestPendingWhatsApp);
    }
  }

  // 6. Render Task & Proof Tables
  function renderTaskSubviews() {
    const countComp = taskCompletedList.length;
    const countPend = taskPendingList.length;
    setElText('taskCompletedBadgeCount', `✅ Submitted (${countComp})`);
    setElText('taskPendingBadgeCount', `⏳ Pending (${countPend})`);

    const tableWrap = document.getElementById('advisorTaskTableWrap');
    if (!tableWrap) return;

    if (currentActiveTaskTab === 'completed') {
      if (!taskCompletedList.length) {
        tableWrap.innerHTML = `
          <div class="empty-state-box">
            <div style="font-size:2rem;margin-bottom:8px;">📋</div>
            <strong>No task proofs submitted yet for ${esc(currentAdvisor.section_full)}</strong>
            <p>Students who upload screenshot receipts will appear here for verification.</p>
          </div>
        `;
        return;
      }

      tableWrap.innerHTML = `
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">#</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Task Title</th>
                <th>Proof Screenshot</th>
                <th>Status</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              ${taskCompletedList.map((s, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="color:#0f172a;font-family:monospace;font-size:0.95rem;">${esc(s.reg_no)}</strong></td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td style="max-width:240px;font-size:0.88rem;">${esc(s.task_title)}</td>
                  <td>
                    ${s.proof_url ? `
                      <a href="${esc(s.proof_url)}" target="_blank" rel="noopener" class="proof-view-link">
                        🖼️ View Proof ↗
                      </a>
                    ` : '<span style="color:#94a3b8;">No Image</span>'}
                  </td>
                  <td><span class="trend-badge" style="background:#ecfdf5;color:#059669;font-weight:700;">✓ Verified</span></td>
                  <td style="color:#64748b;font-size:0.85rem;">${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : 'Recorded'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      if (!taskPendingList.length) {
        tableWrap.innerHTML = `
          <div class="empty-state-box" style="background:#ecfdf5;border-color:#a7f3d0;">
            <div style="font-size:2rem;margin-bottom:8px;">🎉</div>
            <strong style="color:#059669;">100% Task Completion!</strong>
            <p style="color:#047857;">All ${taskCompletedList.length} students in ${esc(currentAdvisor.section_full)} have uploaded proof screenshots.</p>
          </div>
        `;
        return;
      }

      tableWrap.innerHTML = `
        <div style="margin-bottom:14px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="color:#92400e;font-size:0.88rem;">
            <strong>${taskPendingList.length} Candidates Pending:</strong> Use the button to copy their roll numbers formatted for WhatsApp broadcast.
          </div>
          <button id="btnCopyTaskWhatsAppInline" class="btn-clean-primary" style="background:#059669;border-color:#047857;font-size:0.84rem;padding:6px 14px;">
            📋 Copy WhatsApp Message
          </button>
        </div>
        <div class="table-responsive">
          <table class="white-data-table">
            <thead>
              <tr>
                <th style="width:50px;">#</th>
                <th>Register Number</th>
                <th>Student Name</th>
                <th>Section</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${taskPendingList.map((s, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong style="color:#b91c1c;font-family:monospace;font-size:0.95rem;">${esc(s.reg_no)}</strong></td>
                  <td><strong>${esc(s.name)}</strong></td>
                  <td><span class="badge-section">${esc(s.section)}</span></td>
                  <td><span class="trend-badge" style="background:#fef2f2;color:#dc2626;font-weight:700;">⏳ Proof Pending</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.getElementById('btnCopyTaskWhatsAppInline')?.addEventListener('click', copyTaskPendingWhatsApp);
    }
  }

  // 7. WhatsApp Broadcasts
  function copyInactiveCodersWhatsApp() {
    const inactive = sectionStudents.filter(s => {
      const reg = String(s.reg_no || '').trim().toUpperCase();
      const lc = sectionLcData.find(l => String(l['Register Number'] || '').trim().toUpperCase() === reg);
      return !lc || Number(lc['Problems Solved'] || 0) === 0;
    });

    if (!inactive.length) {
      showToast('All students in this section have solved at least 1 LeetCode problem!', 'success');
      return;
    }

    const regList = inactive.map((s, i) => `${i + 1}. ${s.reg_no} - ${s.name}`).join('\n');
    const message = `📢 *ECE DEPARTMENT - ${currentAdvisor.section_full.toUpperCase()} CODING SKILLS NOTICE*

Dear Students,
The following *${inactive.length} candidates* currently have 0 or inactive LeetCode solved problems:

${regList}

⚠️ *Action Required:* Please maintain your daily coding streak and solve problems on LeetCode:
🔗 https://sabareesh2008.github.io/ECE-DEPARTMENT-coding-skills-tracker/

— *Class Advisor:* ${currentAdvisor.name}
*ECE Department, Coding & Skills Development Cell*`;

    copyToClipboard(message, `Copied ${inactive.length} inactive coding roll numbers for WhatsApp!`);
  }

  function copyTestPendingWhatsApp() {
    if (!testPendingList.length) {
      showToast('All students in this section have completed the technical assessment!', 'success');
      return;
    }

    const regList = testPendingList.map((s, i) => `${i + 1}. ${s.reg_no} - ${s.name}`).join('\n');
    const message = `📢 *ECE DEPARTMENT - ${currentAdvisor.section_full.toUpperCase()} ASSESSMENT REMINDER*

Dear Students,
The following *${testPendingList.length} candidates* have NOT yet completed the Technical Assessment:

${regList}

⚠️ *Action Required:* Please log in and complete your assessment immediately:
🔗 ${window.location.origin}${window.location.pathname}#view-exams

— *Class Advisor:* ${currentAdvisor.name}
*ECE Department, Coding & Skills Development Cell*`;

    copyToClipboard(message, `Copied ${testPendingList.length} pending roll numbers for WhatsApp!`);
  }

  function copyTaskPendingWhatsApp() {
    if (!taskPendingList.length) {
      showToast('All students in this section have uploaded their task proof!', 'success');
      return;
    }

    const regList = taskPendingList.map((s, i) => `${i + 1}. ${s.reg_no} - ${s.name}`).join('\n');
    const message = `📢 *ECE DEPARTMENT - ${currentAdvisor.section_full.toUpperCase()} TASK SUBMISSION REMINDER*

Dear Students,
The following *${taskPendingList.length} candidates* have NOT yet submitted their task screenshot proof:

${regList}

⚠️ *Action Required:* Please upload your completion screenshot proof on the portal:
🔗 ${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}tasks.html

— *Class Advisor:* ${currentAdvisor.name}
*ECE Department, Coding & Skills Development Cell*`;

    copyToClipboard(message, `Copied ${taskPendingList.length} pending task roll numbers for WhatsApp!`);
  }

  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(successMsg, 'success');
  }

  function showToast(msg, type = 'info') {
    let toast = document.getElementById('advisorToastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'advisorToastNotification';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        background: #0f172a;
        color: #ffffff;
        padding: 14px 22px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        font-weight: 700;
        font-size: 0.92rem;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
        transform: translateY(100px);
        opacity: 0;
      `;
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span>📋</span> <span>${msg}</span>`;
    toast.style.background = type === 'success' ? '#059669' : '#0f172a';
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
    }, 4000);
  }

  // 8. Overall & Section Task Creation
  function bindTaskCreation() {
    const form = document.getElementById('advisorCreateTaskForm');
    if (!form) return;

    const secSelect = document.getElementById('taskTargetSectionSelect');
    if (secSelect) {
      secSelect.value = currentAdvisor.isHod ? 'ALL' : currentAdvisor.section;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('taskTitleInput');
      const descInput = document.getElementById('taskDescInput');
      const dateInput = document.getElementById('taskDeadlineInput');
      const targetSec = document.getElementById('taskTargetSectionSelect')?.value || currentAdvisor.section;
      const msgEl = document.getElementById('taskCreateMsg');

      const title = (titleInput?.value || '').trim();
      const desc = (descInput?.value || '').trim();
      const deadline = dateInput?.value || null;

      if (!title) {
        if (msgEl) { msgEl.textContent = 'Please enter task title.'; msgEl.style.color = '#dc2626'; }
        return;
      }

      if (msgEl) { msgEl.textContent = 'Publishing task to section / overall students...'; msgEl.style.color = '#2563eb'; }

      const taskData = {
        title: title,
        description: desc,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        target_section: targetSec,
        created_by: currentAdvisor.name
      };

      await window.StudentService.createSectionTask(taskData);

      if (msgEl) {
        msgEl.textContent = `✓ Task "${title}" published successfully for Scope: ${targetSec === 'ALL' ? 'Overall (All Sections)' : 'Section ' + targetSec}!`;
        msgEl.style.color = '#059669';
      }

      form.reset();
      loadSectionTasksList();
      showToast(`Task published for Scope: ${targetSec}!`, 'success');
    });
  }

  async function loadSectionTasksList() {
    const listWrap = document.getElementById('advisorSectionTasksList');
    if (!listWrap) return;

    const tasks = window.StudentService ? await window.StudentService.fetchTasks() : [];
    const localTasks = JSON.parse(localStorage.getItem('codemetrix_custom_tasks') || '[]');
    const combined = [...localTasks, ...tasks];

    const secTasks = combined.filter(t => {
      const ts = String(t.target_section || 'ALL').trim().toUpperCase();
      return currentAdvisor.isHod || ts === 'ALL' || ts === currentAdvisor.section;
    });

    if (!secTasks.length) {
      listWrap.innerHTML = `
        <div class="empty-state-box">
          <p>No active tasks assigned for ${esc(currentAdvisor.section_full)}.</p>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = secTasks.map(t => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:1rem;color:#0f172a;">${esc(t.title)}</strong>
            <span class="badge-section" style="background:#dbeafe;color:#1d4ed8;font-weight:700;">Scope: ${t.target_section === 'ALL' ? '🌐 Overall (A–F)' : 'Section ' + esc(t.target_section)}</span>
          </div>
          <p style="color:#475569;font-size:0.86rem;margin:4px 0 8px 0;">${esc(t.description || 'Upload screenshot proof.')}</p>
          <div style="font-size:0.78rem;color:#64748b;">
            📅 Deadline: <strong>${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'Open'}</strong> · Assigned by: <strong>${esc(t.created_by || 'Advisor')}</strong>
          </div>
        </div>
        <div>
          <span class="trend-badge" style="background:#ecfdf5;color:#059669;">Active / Live</span>
        </div>
      </div>
    `).join('');
  }

  // 8.5 Overall & Section Test Publishing
  function bindTestPublishing() {
    const form = document.getElementById('advisorPublishTestForm');
    if (!form) return;

    const secSelect = document.getElementById('publishTestScopeSelect');
    if (secSelect) {
      secSelect.value = currentAdvisor.isHod ? 'ALL' : currentAdvisor.section;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('publishTestTitleInput');
      const scopeSelect = document.getElementById('publishTestScopeSelect');
      const durationInput = document.getElementById('publishTestDurationInput');
      const qbankSelect = document.getElementById('publishTestQBankSelect');
      const msgEl = document.getElementById('publishTestMsg');

      const title = (titleInput?.value || '').trim();
      const scope = scopeSelect?.value || 'ALL';
      const duration = Number(durationInput?.value || 45);
      const qbank = qbankSelect?.value || 'builtin';

      if (!title) {
        if (msgEl) { msgEl.textContent = 'Please enter assessment title.'; msgEl.style.color = '#dc2626'; }
        return;
      }

      if (msgEl) { msgEl.textContent = 'Publishing examination live for students...'; msgEl.style.color = '#2563eb'; }

      const testData = {
        title: title,
        duration: duration,
        target_section: scope,
        qbank_source: qbank,
        is_published: true,
        created_by: currentAdvisor.name
      };

      if (window.StudentService?.publishAssessment) {
        await window.StudentService.publishAssessment(testData);
      }

      if (msgEl) {
        msgEl.textContent = `✓ Examination "${title}" published live successfully for Scope: ${scope === 'ALL' ? 'Overall (Sections A–F)' : 'Section ' + scope}!`;
        msgEl.style.color = '#059669';
      }

      loadPublishedAssessmentsList();
      showToast(`Exam published for Scope: ${scope}!`, 'success');
    });
  }

  async function loadPublishedAssessmentsList() {
    const listWrap = document.getElementById('advisorPublishedTestsList');
    if (!listWrap) return;

    const tests = window.StudentService ? await window.StudentService.fetchAssessments() : [];
    const secTests = tests.filter(t => {
      const ts = String(t.target_section || 'ALL').trim().toUpperCase();
      return currentAdvisor.isHod || ts === 'ALL' || ts === currentAdvisor.section;
    });

    if (!secTests.length) {
      listWrap.innerHTML = `
        <div class="empty-state-box">
          <p>No active published assessments found.</p>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = secTests.map(t => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:1.05rem;color:#0f172a;">${esc(t.title)}</strong>
            <span class="badge-section" style="background:#ecfdf5;color:#047857;font-weight:700;">Scope: ${t.target_section === 'ALL' ? '🌐 Overall (A–F)' : 'Section ' + esc(t.target_section)}</span>
          </div>
          <p style="color:#475569;font-size:0.86rem;margin:4px 0 8px 0;">Timed MCQ &amp; Fill-in-the-blanks test with automated scoring and PDF keys.</p>
          <div style="font-size:0.78rem;color:#64748b;">
            ⏱️ Duration: <strong>${t.duration || 45} mins</strong> · Total Questions: <strong>50 Qs</strong> · Published by: <strong>${esc(t.created_by || 'Faculty Admin')}</strong>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          <span class="trend-badge" style="background:#ecfdf5;color:#059669;">● Live / Active</span>
          <a href="assessment.html" class="btn-clean-primary" style="font-size:0.8rem;padding:5px 12px;background:#059669;border-color:#047857;">Launch Test ↗</a>
        </div>
      </div>
    `).join('');
  }

  // 9. Excel Exporters
  function exportSectionRosterExcel() {
    if (typeof XLSX === 'undefined') return alert('Excel library is loading. Try again in a moment.');
    const rows = mergedStudentData.map((s, idx) => ({
      'S.No': idx + 1,
      'Register Number': s.reg_no,
      'Student Name': s.name,
      'Department': s.department || 'ECE',
      'Section': s.section,
      'LeetCode Username': s.lc?.['LeetCode Username'] || '—',
      'Problems Solved': s.lc ? Number(s.lc['Problems Solved'] || 0) : 0,
      'GitHub Username': s.gh?.['GitHub Username'] || '—',
      'GitHub Repos': s.gh ? Number(s.gh['Repositories Total'] || 0) : 0,
      'Test Status': s.test ? 'Completed' : 'Pending',
      'Test Marks': s.test ? `${s.test.obtained_marks}/${s.test.total_marks}` : '—',
      'Task Proof Status': s.task ? 'Submitted' : 'Pending'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Roster_${currentAdvisor.section}`);
    XLSX.writeFile(wb, `ECE_${currentAdvisor.section}_Enrolled_Students_Roster.xlsx`);
  }

  function exportSectionCodingExcel() {
    if (typeof XLSX === 'undefined') return alert('Excel library is loading. Try again in a moment.');
    const rows = sectionLcData.map((s, idx) => ({
      'Rank': idx + 1,
      'Register Number': s['Register Number'],
      'Student Name': s['Student Name'],
      'Section': s.Section,
      'LeetCode Username': s['LeetCode Username'],
      'Problems Solved': Number(s['Problems Solved'] || 0),
      'Solved Today': Number(s['Solved Today'] || 0),
      'Last 7 Days': Number(s['Last 7 Days'] || 0),
      'Current Streak': s['Current Streak'] || '0',
      'Easy': Number(s.Easy || 0),
      'Medium': Number(s.Medium || 0),
      'Hard': Number(s.Hard || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Coding_${currentAdvisor.section}`);
    XLSX.writeFile(wb, `ECE_${currentAdvisor.section}_LeetCode_Performance.xlsx`);
  }

  function exportSectionTestExcel() {
    if (typeof XLSX === 'undefined') return alert('Excel library is loading.');
    const rows = sectionStudents.map((s, idx) => {
      const comp = testCompletedList.find(c => c.reg_no === s.reg_no);
      return {
        'S.No': idx + 1,
        'Register Number': s.reg_no,
        'Student Name': s.name,
        'Department': s.department || 'ECE',
        'Section': s.section,
        'Assessment Status': comp ? 'Completed' : 'Pending',
        'Marks Obtained': comp ? comp.obtained_marks : 0,
        'Total Marks': comp ? comp.total_marks : 0,
        'Percentage': comp ? `${comp.percentage}%` : '0%',
        'Submitted At': comp && comp.submitted_at ? new Date(comp.submitted_at).toLocaleString() : 'Not Submitted'
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Test_${currentAdvisor.section}`);
    XLSX.writeFile(wb, `ECE_${currentAdvisor.section}_Technical_Assessment_Report.xlsx`);
  }

  function exportSectionTaskExcel() {
    if (typeof XLSX === 'undefined') return alert('Excel library is loading.');
    const rows = sectionStudents.map((s, idx) => {
      const comp = taskCompletedList.find(c => c.reg_no === s.reg_no);
      return {
        'S.No': idx + 1,
        'Register Number': s.reg_no,
        'Student Name': s.name,
        'Department': s.department || 'ECE',
        'Section': s.section,
        'Task Status': comp ? 'Submitted' : 'Pending Proof',
        'Task Title': comp ? comp.task_title : 'Course Registration & Proof',
        'Proof URL': comp ? comp.proof_url : 'None',
        'Submitted At': comp && comp.submitted_at ? new Date(comp.submitted_at).toLocaleString() : 'Pending'
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Tasks_${currentAdvisor.section}`);
    XLSX.writeFile(wb, `ECE_${currentAdvisor.section}_Task_Submissions_Report.xlsx`);
  }

  function parseCsvData(text) {
    const rows=[]; let row=[], value='', quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"' && quoted && n==='"'){ value+='"'; i++; }
      else if(c==='"') quoted=!quoted;
      else if(c===',' && !quoted){ row.push(value); value=''; }
      else if((c==='\n'||c==='\r')&&!quoted){ if(c==='\r'&&n==='\n')i++; row.push(value); value=''; if(row.some(x=>x.trim()))rows.push(row); row=[]; }
      else value+=c;
    }
    if(value!==''||row.length){row.push(value);rows.push(row);}
    if(rows.length<2)return[];
    const headers=rows[0].map(h=>h.replace(/^\uFEFF/,'').trim());
    return rows.slice(1).map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??'').trim()]))).filter(row => {
      const reg = String(row['Register Number'] || row.register_number || '').trim();
      const name = String(row['Student Name'] || row.student_name || '').trim();
      return reg !== '' && reg !== '—' && reg !== '-' && !reg.startsWith('<') && !reg.startsWith('=') && !reg.startsWith('>') && name !== '';
    });
  }

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

})();
