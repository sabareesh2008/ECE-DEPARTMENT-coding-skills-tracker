// ============================================================
// EXAMLYTICS INTERACTIVE SIDEBAR & VIEW CONTROLLER
// Powers seamless single-page switching between modules
// ============================================================

(function () {
  'use strict';

  const viewTitles = {
    'view-dashboard': { title: 'Dashboard', sub: 'Good morning, ECE Scholars · 372 Students active across Sections A–F' },
    'view-exams': { title: 'Available Exams', sub: 'Timed MCQ & Fill-in-the-blanks technical examinations with live proctoring' },
    'view-leetcode': { title: 'LeetCode Tracker', sub: 'Live synchronized problem solving, streaks, and anti-cheat forensics' },
    'view-github': { title: 'GitHub Tracker', sub: 'Contributions, repositories, commits, and detected live deployments' },
    'view-tasks': { title: 'Task Submissions Desk', sub: 'Student course registration and certification proof verification' },
    'view-leaderboard': { title: 'Department Leaderboard', sub: 'Top 50 rankings across LeetCode & GitHub engineering profiles' },
    'view-roster': { title: 'Student Master Directory', sub: 'Official 372-student roster across Sections A through F' },
    'view-admin': { title: 'Faculty & Admin Command', sub: 'Assessment configuration, question bank management, and announcements' },
    'view-reports': { title: 'Reports & Exports', sub: 'Custom date range analytics, Excel spreadsheets, and PDF documents' }
  };

  let currentLcData = [];
  let currentGhData = [];

  document.addEventListener('DOMContentLoaded', () => {
    initSidebarNavigation();
    initTopSearch();
    loadLiveLeaderboards();
    initRosterDirectory();
    initReportGenerator();
    initQuickActions();
  });

  // 1. Sidebar Navigation Controller
  function initSidebarNavigation() {
    const navBtns = document.querySelectorAll('.nav-item-btn[data-view]');
    const viewPanes = document.querySelectorAll('.feature-view-pane');
    const titleEl = document.getElementById('pageViewTitle');
    const subEl = document.getElementById('pageViewSubtitle');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        navBtns.forEach(b => b.classList.remove('active'));
        viewPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(viewId);
        if (targetPane) {
          targetPane.classList.add('active');
        }

        const meta = viewTitles[viewId] || { title: 'Examlytics', sub: 'CodeMetrix Platform' };
        if (titleEl) titleEl.textContent = meta.title;
        if (subEl) subEl.textContent = meta.sub;

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Sidebar Admin Login Icon
    document.getElementById('sidebarAdminLoginBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('homeAdminLoginModal');
      if (modal) {
        modal.hidden = false;
        document.body.classList.add('modal-open');
      }
    });
  }

  // 2. Global Top Search Input
  function initTopSearch() {
    const topInput = document.getElementById('topSearchInput');
    const searchForm = document.getElementById('studentSearchForm');
    const searchInput = document.getElementById('studentSearchInput');

    topInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = topInput.value.trim();
        if (val) {
          if (searchInput) searchInput.value = val;
          if (searchForm) {
            searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
          }
        }
      }
    });
  }

  // 3. Load & Render Live LeetCode & GitHub Tables
  async function loadLiveLeaderboards() {
    try {
      const [lcRes, ghRes] = await Promise.all([
        fetch('LiveData.csv?t=' + Date.now()).catch(() => null),
        fetch('GitHubLiveData.csv?t=' + Date.now()).catch(() => null)
      ]);

      if (lcRes && lcRes.ok) {
        currentLcData = parseCsv(await lcRes.text());
        renderLeetCodeTable(currentLcData);
        updateTopSolverKPI(currentLcData);
      }
      if (ghRes && ghRes.ok) {
        currentGhData = parseCsv(await ghRes.text());
        renderGitHubTable(currentGhData);
        updateTopDeployerKPI(currentGhData);
      }
    } catch (e) {
      console.warn('[Examlytics Controller] Leaderboard fetch error:', e);
    }

    // LeetCode Section Filter Pills
    document.querySelectorAll('[data-lc-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-lc-sec]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sec = btn.getAttribute('data-lc-sec');
        let filtered = currentLcData;
        if (sec !== 'ALL') {
          filtered = currentLcData.filter(r => (r.Section || '').toUpperCase() === sec);
        }
        renderLeetCodeTable(filtered);
      });
    });
  }

  function renderLeetCodeTable(rows) {
    const tbody = document.getElementById('leetcodeEmbeddedTbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No LeetCode records found.</td></tr>`;
      return;
    }

    const sorted = [...rows].sort((a, b) => Number(b['Problems Solved'] || 0) - Number(a['Problems Solved'] || 0));

    tbody.innerHTML = sorted.slice(0, 100).map((r, i) => `
      <tr>
        <td style="font-weight:700;color:var(--primary);">${i + 1}</td>
        <td style="font-family:monospace;font-weight:700;">${r['Register Number'] || '—'}</td>
        <td style="font-weight:600;">${r['Student Name'] || '—'}</td>
        <td><span style="background:var(--bg-subtle);padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">${r.Section || '—'}</span></td>
        <td><a href="https://leetcode.com/u/${r['LeetCode Username']}/" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:none;font-weight:600;">@${r['LeetCode Username'] || '—'}</a></td>
        <td style="font-weight:800;color:#10b981;">${r['Problems Solved'] || 0}</td>
        <td>${r['Last 7 Days'] || 0}</td>
        <td><span class="badge-clean-pill warning">🔥 ${r['Current Streak'] || '0d'}</span></td>
        <td><span class="badge-clean-pill success">Active</span></td>
      </tr>
    `).join('');
  }

  function renderGitHubTable(rows) {
    const tbody = document.getElementById('githubEmbeddedTbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No GitHub records found.</td></tr>`;
      return;
    }

    const sorted = [...rows].sort((a, b) => Number(b['Detected Deployments'] || 0) - Number(a['Detected Deployments'] || 0) || Number(b['Contributions 30 Days'] || 0) - Number(a['Contributions 30 Days'] || 0));

    tbody.innerHTML = sorted.slice(0, 100).map((r, i) => `
      <tr>
        <td style="font-weight:700;color:#0f172a;">${i + 1}</td>
        <td style="font-family:monospace;font-weight:700;">${r['Register Number'] || '—'}</td>
        <td style="font-weight:600;">${r['Student Name'] || '—'}</td>
        <td><span style="background:var(--bg-subtle);padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:600;">${r.Section || '—'}</span></td>
        <td><a href="https://github.com/${r['GitHub Username']}" target="_blank" rel="noopener" style="color:#0f172a;text-decoration:none;font-weight:600;">@${r['GitHub Username'] || '—'}</a></td>
        <td style="font-weight:800;color:var(--primary);">${r['Detected Deployments'] || 0}</td>
        <td>${r['Contributions 30 Days'] || 0}</td>
        <td>${r['Commits 30 Days'] || 0}</td>
        <td>${r['Repositories Total'] || 0}</td>
      </tr>
    `).join('');
  }

  function updateTopSolverKPI(rows) {
    const sorted = [...rows].sort((a, b) => Number(b['Problems Solved'] || 0) - Number(a['Problems Solved'] || 0));
    if (sorted.length > 0) {
      const top = sorted[0];
      const el = document.getElementById('leadTopSolverName');
      const meta = document.getElementById('leadTopSolverMeta');
      if (el) el.textContent = top['Student Name'] || 'Top Solver';
      if (meta) meta.textContent = `${top['Problems Solved'] || 0} Solved · ${top.Section || 'ECE'}`;
    }
  }

  function updateTopDeployerKPI(rows) {
    const sorted = [...rows].sort((a, b) => Number(b['Detected Deployments'] || 0) - Number(a['Detected Deployments'] || 0));
    if (sorted.length > 0) {
      const top = sorted[0];
      const el = document.getElementById('leadTopDeployerName');
      const meta = document.getElementById('leadTopDeployerMeta');
      if (el) el.textContent = top['Student Name'] || 'Top Deployer';
      if (meta) meta.textContent = `${top['Detected Deployments'] || 0} Deployments · ${top.Section || 'ECE'}`;
    }
  }

  // 4. Student Roster Directory
  function initRosterDirectory() {
    const students = typeof REGISTERED_STUDENTS !== 'undefined' ? REGISTERED_STUDENTS : [];
    const tbody = document.getElementById('rosterDirectoryTbody');
    const searchInput = document.getElementById('rosterFilterInput');
    const secSelect = document.getElementById('rosterSectionSelect');

    const render = () => {
      if (!tbody) return;
      const q = (searchInput?.value || '').trim().toUpperCase();
      const sec = secSelect?.value || 'ALL';

      let list = students;
      if (sec !== 'ALL') {
        list = list.filter(s => s.section === sec);
      }
      if (q) {
        list = list.filter(s => s.reg_no.includes(q) || s.name.toUpperCase().includes(q));
      }

      tbody.innerHTML = list.map((s, i) => `
        <tr>
          <td style="color:var(--text-muted);">${i + 1}</td>
          <td style="font-family:monospace;font-weight:700;color:var(--primary);">${s.reg_no}</td>
          <td style="font-weight:600;">${s.name}</td>
          <td style="color:var(--text-secondary);">${s.department || 'ECE'}</td>
          <td><span style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:4px;font-size:0.8rem;font-weight:700;">Section ${s.section}</span></td>
          <td>
            <button type="button" class="btn-clean-secondary btn-inspect-student" data-reg="${s.reg_no}" style="padding:4px 10px;font-size:0.8rem;">Inspect Dossier ↗</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-inspect-student').forEach(btn => {
        btn.addEventListener('click', () => {
          const reg = btn.getAttribute('data-reg');
          const input = document.getElementById('studentSearchInput');
          const form = document.getElementById('studentSearchForm');
          if (input && form && reg) {
            input.value = reg;
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
        });
      });
    };

    searchInput?.addEventListener('input', render);
    secSelect?.addEventListener('change', render);
    render();

    // Export Master Roster to Excel
    document.getElementById('btnDownloadMasterRosterExcel')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      const rows = students.map((s, i) => ({
        '#': i + 1,
        'Register Number': s.reg_no,
        'Student Name': s.name,
        'Department': s.department,
        'Section': s.section
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Roster 372');
      XLSX.writeFile(wb, `ECE_Student_Master_Roster_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  // 5. Custom Date Range Report Generator
  function initReportGenerator() {
    document.getElementById('btnGenerateExcelReport')?.addEventListener('click', () => {
      const from = document.getElementById('reportFromDate')?.value;
      const to = document.getElementById('reportToDate')?.value;
      const sec = document.getElementById('reportSectionSelect')?.value || 'OVERALL';

      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      let rows = currentLcData;
      if (sec !== 'OVERALL') {
        rows = rows.filter(r => (r.Section || '').toUpperCase() === sec);
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Report ${sec}`);
      XLSX.writeFile(wb, `CodeMetrix_Report_${sec}_${from || 'from'}_${to || 'to'}.xlsx`);
    });
  }

  // 6. Quick Action Downloads
  function initQuickActions() {
    const downloadTopLeet = () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      const data = [...currentLcData].sort((a, b) => Number(b['Problems Solved'] || 0) - Number(a['Problems Solved'] || 0));
      const top = data.slice(0, 50);
      const ws = XLSX.utils.json_to_sheet(top);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Top 50 LeetCode');
      XLSX.writeFile(wb, `CodeMetrix_Top_50_LeetCode_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const downloadTopGit = () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      const data = [...currentGhData].sort((a, b) => Number(b['Detected Deployments'] || 0) - Number(a['Detected Deployments'] || 0));
      const top = data.slice(0, 50);
      const ws = XLSX.utils.json_to_sheet(top);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Top 50 GitHub');
      XLSX.writeFile(wb, `CodeMetrix_Top_50_GitHub_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    document.getElementById('btnDownloadTop50LeetEmbedded')?.addEventListener('click', downloadTopLeet);
    document.getElementById('btnDownloadTop50GitEmbedded')?.addEventListener('click', downloadTopGit);
    document.getElementById('btnDownloadTop50LeetTab')?.addEventListener('click', downloadTopLeet);
    document.getElementById('btnDownloadTop50GitTab')?.addEventListener('click', downloadTopGit);

    // Quick WhatsApp Reminder
    document.getElementById('btnQuickWhatsAppCopy')?.addEventListener('click', () => {
      const students = typeof REGISTERED_STUDENTS !== 'undefined' ? REGISTERED_STUDENTS : [];
      const text = `📢 *EXAMLYTICS NOTIFICATION*\n\nDear Students,\nPlease ensure your coding streaks and task proofs are updated today on the CodeMetrix portal.`;
      navigator.clipboard.writeText(text).then(() => {
        alert('✓ Copied notification announcement to clipboard!');
      }).catch(() => prompt('Copy text:', text));
    });
  }

  // Helper CSV parser
  function parseCsv(text) {
    const rows = []; let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && quoted && n === '"') { value += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) { row.push(value); value = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && n === '\n') i++;
        row.push(value); value = '';
        if (row.some(x => x.trim())) rows.push(row);
        row = [];
      }
      else value += c;
    }
    if (value !== '' || row.length) { row.push(value); rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
    return rows.slice(1).map(cells => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])));
  }

})();
