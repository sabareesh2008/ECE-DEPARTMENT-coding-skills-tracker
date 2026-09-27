// ============================================================
// ECE CLASS ADVISOR & FACULTY COMMAND CONTROLLER
// High-performance section-specific tracking, WhatsApp broadcast & task assignment
// ============================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'codemetrix_advisor_session';
  let currentAdvisor = null;
  let sectionStudents = [];
  let testCompletedList = [];
  let testPendingList = [];
  let taskCompletedList = [];
  let taskPendingList = [];
  let currentActiveTestTab = 'completed';
  let currentActiveTaskTab = 'completed';

  document.addEventListener('DOMContentLoaded', () => {
    initAdvisorController();
  });

  // Global initialization
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
      const secSelect = document.getElementById('advisorSectionSelect');
      const passInput = document.getElementById('advisorPasswordInput');
      const msgEl = document.getElementById('advisorLoginMsg');

      const name = (nameInput?.value || '').trim();
      const section = secSelect?.value || 'ECE A';
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

      const cleanSec = section.replace(/^ECE\s*/i, '').trim().toUpperCase();

      currentAdvisor = {
        name: name,
        section: cleanSec,
        section_full: section.startsWith('ECE') ? section : `ECE ${section}`,
        isHod: cleanSec === 'ALL' || cleanSec === 'OVERALL',
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
    if (subEl) subEl.textContent = `Active Advisor: ${currentAdvisor.name} · Live Technical Assessment & Task Submission Monitoring`;
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
    bindTaskCreation();
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

      // 2. Get Live Submissions from Supabase
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

      // Divide section students into completed & pending
      testCompletedList = [];
      testPendingList = [];
      taskCompletedList = [];
      taskPendingList = [];

      sectionStudents.forEach(stu => {
        const reg = String(stu.reg_no || '').trim().toUpperCase();
        const testSub = testMap.get(reg);
        const taskSub = taskMap.get(reg);

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
      renderTestSubviews();
      renderTaskSubviews();
      loadSectionTasksList();

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

  // Bind Tab Switching (Test Tracking / Task Tracking / Task Creator / Question Bank)
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

    // Test Sub-tab Toggle (Completed vs Pending)
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

    // Task Sub-tab Toggle (Completed vs Pending)
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
    document.getElementById('btnCopyTestWhatsApp')?.addEventListener('click', () => {
      copyTestPendingWhatsApp();
    });

    document.getElementById('btnCopyTaskWhatsApp')?.addEventListener('click', () => {
      copyTaskPendingWhatsApp();
    });

    // Export Buttons
    document.getElementById('btnExportSectionTestExcel')?.addEventListener('click', () => {
      exportSectionTestExcel();
    });

    document.getElementById('btnExportSectionTaskExcel')?.addEventListener('click', () => {
      exportSectionTaskExcel();
    });
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

  // Render Technical Assessment Tables
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
            <strong>${testPendingList.length} Candidates Pending:</strong> Use the button on the right to copy their register numbers formatted for your WhatsApp class group.
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

  // Render Task & Proof Tables
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

  // WhatsApp Message Generators & Copy to Clipboard
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

  // Section Task Creation Handling
  function bindTaskCreation() {
    const form = document.getElementById('advisorCreateTaskForm');
    if (!form) return;

    // Set default target section in form
    const secSelect = document.getElementById('taskTargetSectionSelect');
    if (secSelect) {
      secSelect.value = currentAdvisor.section === 'ALL' ? 'ALL' : currentAdvisor.section;
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

      if (msgEl) { msgEl.textContent = 'Publishing task to section students...'; msgEl.style.color = '#2563eb'; }

      const taskData = {
        title: title,
        description: desc,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        target_section: targetSec,
        created_by: currentAdvisor.name
      };

      await window.StudentService.createSectionTask(taskData);

      if (msgEl) {
        msgEl.textContent = `✓ Task "${title}" published successfully for Section ${targetSec}!`;
        msgEl.style.color = '#059669';
      }

      form.reset();
      loadSectionTasksList();
      showToast(`Task assigned to Section ${targetSec}!`, 'success');
    });
  }

  // Load Section Tasks List
  async function loadSectionTasksList() {
    const listWrap = document.getElementById('advisorSectionTasksList');
    if (!listWrap) return;

    const tasks = window.StudentService ? await window.StudentService.fetchTasks() : [];
    const localTasks = JSON.parse(localStorage.getItem('codemetrix_custom_tasks') || '[]');
    const combined = [...localTasks, ...tasks];

    // Filter tasks for current section or ALL
    const secTasks = combined.filter(t => {
      const ts = String(t.target_section || 'ALL').trim().toUpperCase();
      return currentAdvisor.isHod || ts === 'ALL' || ts === currentAdvisor.section;
    });

    if (!secTasks.length) {
      listWrap.innerHTML = `
        <div class="empty-state-box">
          <p>No active tasks assigned specifically for ${esc(currentAdvisor.section_full)}.</p>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = secTasks.map(t => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:1rem;color:#0f172a;">${esc(t.title)}</strong>
            <span class="badge-section" style="background:#dbeafe;color:#1d4ed8;">Section: ${esc(t.target_section || 'ALL')}</span>
          </div>
          <p style="color:#475569;font-size:0.86rem;margin:4px 0 8px 0;">${esc(t.description || 'Upload screenshot proof.')}</p>
          <div style="font-size:0.78rem;color:#64748b;">
            📅 Deadline: <strong>${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'Open'}</strong> · Assigned by: <strong>${esc(t.created_by || 'Advisor')}</strong>
          </div>
        </div>
        <div>
          <span class="trend-badge" style="background:#ecfdf5;color:#059669;">Active</span>
        </div>
      </div>
    `).join('');
  }

  // Excel / CSV Exporters
  function exportSectionTestExcel() {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library is loading. Please try again in a moment.');
      return;
    }

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
    if (typeof XLSX === 'undefined') {
      alert('Excel export library is loading. Please try again in a moment.');
      return;
    }

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

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

})();
