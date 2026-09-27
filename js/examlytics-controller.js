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
    renderDepartmentOverview();
    initRosterDirectory();
    initReportGenerator();
    initQuickActions();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReportModal(); });
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
        updateTopSolverKPI(currentLcData);
        updateDepartmentOverview();
      }
      if (ghRes && ghRes.ok) {
        currentGhData = parseCsv(await ghRes.text());
        updateTopDeployerKPI(currentGhData);
        updateDepartmentOverview();
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

  function renderDepartmentOverview() {
    const roster = typeof REGISTERED_STUDENTS !== 'undefined' && Array.isArray(REGISTERED_STUDENTS)
      ? REGISTERED_STUDENTS : [];
    const totalEl = document.getElementById('kpiTotalStudents');
    const total = roster.length || 0;
    if (totalEl) totalEl.textContent = total.toLocaleString();
    const sectionTotal = document.getElementById('sectionAnalysisTotal');
    if (sectionTotal) sectionTotal.textContent = `${total.toLocaleString()} students`;
    updateDepartmentOverview();
  }

  function updateDepartmentOverview() {
    const roster = typeof REGISTERED_STUDENTS !== 'undefined' && Array.isArray(REGISTERED_STUDENTS)
      ? REGISTERED_STUDENTS : [];
    const sections = ['A','B','C','D','E','F'];
    const grid = document.getElementById('sectionAnalysisGrid');
    const lcTotalEl = document.getElementById('kpiExamsSolvedCount');
    const lcProfilesEl = document.getElementById('kpiLcProfiles');
    const ghProfilesEl = document.getElementById('kpiGhProfiles');
    const lcOverviewSolved = document.getElementById('homeLcOverviewSolved');
    const lcOverviewProfiles = document.getElementById('homeLcOverviewProfiles');
    const ghOverviewProfiles = document.getElementById('homeGhOverviewProfiles');
    const ghOverviewActive = document.getElementById('homeGhOverviewActive');

    const n = value => Number(String(value ?? 0).replace(/,/g,'')) || 0;
    const lcRows = currentLcData || [];
    const ghRows = currentGhData || [];
    const totalSolved = lcRows.reduce((sum, r) => sum + n(r['Problems Solved']), 0);
    const lcProfiles = lcRows.filter(r => String(r['LeetCode Username'] || '').trim()).length;
    const ghProfiles = ghRows.filter(r => String(r['GitHub Username'] || '').trim()).length;
    const ghActive = ghRows.filter(r => n(r['Contributions 30 Days']) > 0 || n(r['Commits 30 Days']) > 0).length;

    if (lcTotalEl) lcTotalEl.textContent = totalSolved.toLocaleString();
    if (lcProfilesEl) lcProfilesEl.textContent = lcProfiles.toLocaleString();
    if (ghProfilesEl) ghProfilesEl.textContent = ghProfiles.toLocaleString();
    if (lcOverviewSolved) lcOverviewSolved.textContent = totalSolved.toLocaleString();
    if (lcOverviewProfiles) lcOverviewProfiles.textContent = lcProfiles.toLocaleString();
    if (ghOverviewProfiles) ghOverviewProfiles.textContent = ghProfiles.toLocaleString();
    if (ghOverviewActive) ghOverviewActive.textContent = ghActive.toLocaleString();

    if (!grid) return;
    grid.innerHTML = sections.map(sec => {
      const students = roster.filter(s => String(s.section || '').toUpperCase() === sec).length;
      const lc = lcRows.filter(r => String(r.Section || '').toUpperCase().endsWith(sec));
      const gh = ghRows.filter(r => String(r.Section || '').toUpperCase().endsWith(sec));
      const solved = lc.reduce((sum, r) => sum + n(r['Problems Solved']), 0);
      const active = gh.filter(r => n(r['Contributions 30 Days']) > 0 || n(r['Commits 30 Days']) > 0).length;
      const coverage = students ? Math.round((Math.max(lc.length, gh.length) / students) * 100) : 0;
      return `
        <article class="section-analysis-card">
          <div class="section-analysis-card-head">
            <div class="section-letter">${sec}</div>
            <div><strong>Section ${sec}</strong><span>${students} students</span></div>
            <span class="section-coverage">${Math.min(100, coverage)}% tracked</span>
          </div>
          <div class="section-analysis-metrics">
            <div><strong>${solved.toLocaleString()}</strong><span>LC solved</span></div>
            <div><strong>${active.toLocaleString()}</strong><span>GH active</span></div>
            <div><strong>${lc.length.toLocaleString()}</strong><span>LC profiles</span></div>
          </div>
        </article>`;
    }).join('');
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

  // 5. Centralized Report Center
  const REPORT_META = {
    'leetcode-top50': { title: 'LeetCode Top 50', subtitle: 'Download the top 50 LeetCode performers.', formats: ['xlsx'] },
    'github-top50': { title: 'GitHub Top 50', subtitle: 'Download the top 50 GitHub performers.', formats: ['xlsx'] },
    'leetcode-performance': { title: 'LeetCode Performance', subtitle: 'Complete LeetCode performance report.', formats: ['xlsx','csv','pdf'] },
    'github-performance': { title: 'GitHub Performance', subtitle: 'Complete GitHub performance report.', formats: ['xlsx','csv','pdf'] },
    'task-proof-pdf': { title: 'Task Submission Proof PDF', subtitle: 'Compile screenshot proofs with student details.', formats: ['pdf'] },
    'test-consolidation': { title: 'Test Consolidation', subtitle: 'Assessment submissions and marks.', formats: ['xlsx','csv','pdf'] },
    'faculty-analytics': { title: 'Faculty Analytics', subtitle: 'Faculty LeetCode and GitHub analytics.', formats: ['xlsx','csv','pdf'] },
    'student-master': { title: 'Student Master / Combined', subtitle: 'Roster with combined LeetCode and GitHub metrics.', formats: ['xlsx','csv','pdf'] },
    'date-range': { title: 'Date Range LeetCode Report', subtitle: 'Historical LeetCode activity for the selected date range.', formats: ['xlsx','csv','pdf'] },
    'task-data': { title: 'Task Submission Data', subtitle: 'Task submission records by scope.', formats: ['xlsx','csv'] }
  };

  let activeReportType = null;
  let activeReportScope = 'OVERALL';

  function cleanSection(value) {
    const s = String(value || '').trim().toUpperCase();
    if (!s || s === 'OVERALL' || s === 'ALL') return 'OVERALL';
    return s.startsWith('ECE ') ? s : `ECE ${s}`;
  }

  function sectionMatches(row, scope) {
    if (scope === 'OVERALL') return true;
    return cleanSection(row.Section || row.section) === scope;
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function rowsToCsv(rows) {
    if (!rows.length) return '';
    const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    return '\uFEFF' + [keys, ...rows.map(r => keys.map(k => r[k] ?? ''))].map(row => row.map(csvEscape).join(',')).join('\r\n');
  }

  function downloadBlob(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reportRowsWithScope(rows, scope) {
    return (rows || []).filter(r => sectionMatches(r, scope));
  }

  function excelDownload(rows, sheet, filename) {
    if (typeof XLSX === 'undefined') throw new Error('Excel library is not available. Refresh the page and try again.');
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Status: 'No records found for this scope.' }]);
    ws['!cols'] = Object.keys(rows[0] || {Status:''}).map(k => ({ wch: Math.min(34, Math.max(12, k.length + 3)) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0,31)); XLSX.writeFile(wb, filename);
  }

  function pdfTableDownload(rows, title, filename) {
    if (!window.jspdf?.jsPDF) throw new Error('PDF library is not available. Refresh the page and try again.');
    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
    doc.setFontSize(16); doc.text(title, 14, 14);
    doc.setFontSize(9); doc.setTextColor(100,116,139); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);
    const keys = Object.keys(rows[0] || {});
    const body = rows.map(r => keys.map(k => String(r[k] ?? '').slice(0,45)));
    doc.autoTable({ startY: 27, head: [keys], body: body.length ? body : [['No records found']], theme: 'striped', styles: { fontSize: 7 }, headStyles: { fillColor: [37,99,235] }, margin: { left: 10, right: 10 } });
    doc.save(filename);
  }

  async function fetchPortalRows(table) {
    const base = window.APP_CONFIG?.PORTAL_SUPABASE_URL;
    const key = window.APP_CONFIG?.PORTAL_SUPABASE_ANON_KEY;
    if (!base || !key) return [];
    const res = await fetch(`${base}/rest/v1/${table}?select=*&order=submitted_at.desc&limit=5000`, { headers: { apikey:key, Authorization:`Bearer ${key}` } });
    if (!res.ok) throw new Error(`Could not load ${table} (${res.status}).`);
    return await res.json();
  }

  async function fetchFacultyRows() {
    const base = window.APP_CONFIG?.SUPABASE_URL; const key = window.APP_CONFIG?.SUPABASE_ANON_KEY;
    if (!base || !key) return [];
    const res = await fetch(`${base}/rest/v1/faculties?select=*&order=faculty_name.asc&limit=1000`, { headers: { apikey:key, Authorization:`Bearer ${key}` } });
    if (!res.ok) throw new Error(`Could not load faculty analytics (${res.status}).`);
    return await res.json();
  }

  function setReportMessage(text, error=false) {
    const el=document.getElementById('reportsActionMessage'); if(!el) return; el.textContent=text; el.style.color=error?'#b91c1c':'#475569';
  }

  function openReportModal(type) {
    activeReportType = type; activeReportScope = 'OVERALL';
    const meta=REPORT_META[type]; const modal=document.getElementById('reportDownloadModal'); if(!modal || !meta) return;
    document.getElementById('reportModalTitle').textContent=meta.title;
    document.getElementById('reportModalSubtitle').textContent=meta.subtitle;
    document.querySelectorAll('.report-scope-option').forEach(b=>b.classList.toggle('active', b.dataset.reportScope==='OVERALL'));
    document.getElementById('reportModalSectionPickerWrap').hidden=true;
    const selected=document.getElementById('reportSectionSelect')?.value || 'ECE A';
    const picker=document.getElementById('reportModalSectionPicker'); if(picker) picker.value=selected==='OVERALL'?'ECE A':selected;
    document.getElementById('reportModalSectionLabel').textContent=selected==='OVERALL'?'Use selected section':'Section '+selected.replace('ECE ','');
    const formats=document.getElementById('reportFormatOptions');
    const labels={xlsx:'📗 Excel (.xlsx)',csv:'📄 CSV (.csv)',pdf:'📕 PDF (.pdf)'};
    formats.innerHTML=meta.formats.map(f=>`<button class="report-format-btn" type="button" data-report-format="${f}">${labels[f]}</button>`).join('');
    modal.hidden=false; document.body.classList.add('modal-open');
  }

  function closeReportModal(){ const modal=document.getElementById('reportDownloadModal'); if(modal) modal.hidden=true; document.body.classList.remove('modal-open'); }

  async function downloadReport(type, scope, format) {
    const dateFrom=document.getElementById('reportFromDate')?.value || '';
    const dateTo=document.getElementById('reportToDate')?.value || '';
    const scopeLabel=scope==='OVERALL'?'Overall':`Section_${scope.replace('ECE ','')}`;
    const stamp=new Date().toISOString().slice(0,10);

    if(type==='leetcode-top50' || type==='github-top50') {
      const source=type==='leetcode-top50'?currentLcData:currentGhData;
      let rows=reportRowsWithScope(source,scope);
      rows.sort((a,b)=> type==='leetcode-top50'
        ? Number(b['Last 7 Days']||0)-Number(a['Last 7 Days']||0)||Number(b['Problems Solved']||0)-Number(a['Problems Solved']||0)
        : Number(b['Detected Deployments']||0)-Number(a['Detected Deployments']||0)||Number(b['Contributions 30 Days']||0)-Number(a['Contributions 30 Days']||0)||Number(b['Commits 30 Days']||0)-Number(a['Commits 30 Days']||0));
      rows=rows.slice(0,50).map((r,i)=>({Rank:i+1,...r}));
      excelDownload(rows,type==='leetcode-top50'?'Top 50 LeetCode':'Top 50 GitHub',`CodeMetrix_${type==='leetcode-top50'?'LeetCode':'GitHub'}_Top50_${scopeLabel}_${stamp}.xlsx`); return;
    }

    if(type==='leetcode-performance' || type==='github-performance') {
      const rows=reportRowsWithScope(type==='leetcode-performance'?currentLcData:currentGhData,scope);
      const base=type==='leetcode-performance'?'LeetCode_Performance':'GitHub_Performance';
      if(format==='xlsx') excelDownload(rows,base,`CodeMetrix_${base}_${scopeLabel}_${stamp}.xlsx`);
      else if(format==='csv') downloadBlob(`CodeMetrix_${base}_${scopeLabel}_${stamp}.csv`,rowsToCsv(rows),'text/csv;charset=utf-8');
      else pdfTableDownload(rows,`CodeMetrix ${base} · ${scopeLabel}`,`CodeMetrix_${base}_${scopeLabel}_${stamp}.pdf`);
      return;
    }

    if(type==='student-master') {
      const roster=(typeof REGISTERED_STUDENTS!=='undefined'?REGISTERED_STUDENTS:[]).filter(r=>scope==='OVERALL'||cleanSection(r.section)===scope);
      const lc=new Map(currentLcData.map(r=>[String(r['Register Number']||'').trim(),r])); const gh=new Map(currentGhData.map(r=>[String(r['Register Number']||'').trim(),r]));
      const rows=roster.map((s,i)=>{const reg=String(s.reg_no||'').trim();const l=lc.get(reg)||{};const g=gh.get(reg)||{};return {'#':i+1,'Register Number':reg,'Student Name':s.name||'',Department:s.department||'ECE',Section:s.section||'', 'LeetCode Username':l['LeetCode Username']||'', 'LeetCode Solved':Number(l['Problems Solved']||0), 'LeetCode 7D':Number(l['Last 7 Days']||0), 'LeetCode 30D':Number(l['Last 30 Days']||0), 'GitHub Username':g['GitHub Username']||'', 'GitHub Repositories':Number(g['Repositories Total']||0), 'GitHub Contributions 30D':Number(g['Contributions 30 Days']||0), 'GitHub Commits 30D':Number(g['Commits 30 Days']||0), 'GitHub Deployments':Number(g['Detected Deployments']||0)};});
      if(format==='xlsx') excelDownload(rows,'Student Master',`CodeMetrix_Student_Master_${scopeLabel}_${stamp}.xlsx`); else if(format==='csv') downloadBlob(`CodeMetrix_Student_Master_${scopeLabel}_${stamp}.csv`,rowsToCsv(rows),'text/csv;charset=utf-8'); else pdfTableDownload(rows,'CodeMetrix Student Master / Combined',`CodeMetrix_Student_Master_${scopeLabel}_${stamp}.pdf`); return;
    }

    if(type==='date-range') {
      if(!dateFrom || !dateTo) throw new Error('Please select both From Date and To Date.');
      const res=await fetch('History.csv?t='+Date.now()); if(!res.ok) throw new Error('History.csv could not be loaded.');
      const rows=parseCsv(await res.text()).filter(r=>String(r.Date||'')>=dateFrom&&String(r.Date||'')<=dateTo&&sectionMatches(r,scope));
      const name=`CodeMetrix_LeetCode_Date_${dateFrom}_to_${dateTo}_${scopeLabel}`;
      if(format==='xlsx') excelDownload(rows,'Date Report',`${name}.xlsx`); else if(format==='csv') downloadBlob(`${name}.csv`,rowsToCsv(rows),'text/csv;charset=utf-8'); else pdfTableDownload(rows,`CodeMetrix LeetCode Date Report · ${scopeLabel} · ${dateFrom} to ${dateTo}`,`${name}.pdf`); return;
    }

    if(type==='test-consolidation') {
      let rows=await fetchPortalRows('submissions'); rows=rows.filter(r=>sectionMatches(r,scope));
      rows=rows.map((r,i)=>({'#':i+1,'Register Number':r.reg_no||r.register_number||'', 'Student Name':r.student_name||r.name||'',Department:r.department||'ECE',Section:r.section||'', 'Test Title':r.test_title||r.title||'Technical Assessment 2026','Marks Obtained':Number(r.obtained_marks||r.score||0),'Total Marks':Number(r.total_marks||0),'Percentage':r.percentage!=null?r.percentage:`${Math.round((Number(r.obtained_marks||r.score||0)/Math.max(1,Number(r.total_marks||1)))*100)}%`,'Time Taken':r.time_taken||'', 'Submitted At':r.submitted_at||''}));
      const name=`CodeMetrix_Test_Consolidation_${scopeLabel}_${stamp}`;
      if(format==='xlsx') excelDownload(rows,'Test Consolidation',`${name}.xlsx`); else if(format==='csv') downloadBlob(`${name}.csv`,rowsToCsv(rows),'text/csv;charset=utf-8'); else pdfTableDownload(rows,`CodeMetrix Test Consolidation · ${scopeLabel}`,`${name}.pdf`); return;
    }

    if(type==='task-data' || type==='task-proof-pdf') {
      let rows=(typeof DataService!=='undefined' && DataService.getSubmissionsForTask) ? await DataService.getSubmissionsForTask() : await fetchPortalRows('task_submissions');
      rows=rows.filter(r=>sectionMatches(r,scope));
      if(type==='task-data') {
        const out=rows.map((r,i)=>({'#':i+1,'Register Number':r.reg_no||r.register_number||'', 'Student Name':r.student_name||r.name||'',Department:r.department||'ECE',Section:r.section||'', 'Proof URL':r.screenshot_url||r.proof_url||'', 'Submitted At':r.submitted_at||'',Notes:r.notes||''}));
        if(format==='xlsx') excelDownload(out,'Task Submissions',`CodeMetrix_Task_Submissions_${scopeLabel}_${stamp}.xlsx`); else downloadBlob(`CodeMetrix_Task_Submissions_${scopeLabel}_${stamp}.csv`,rowsToCsv(out),'text/csv;charset=utf-8'); return;
      }
      await generateTaskProofPdf(rows,scope,scopeLabel,stamp); return;
    }

    if(type==='faculty-analytics') {
      const faculty=await fetchFacultyRows();
      const rows=faculty.filter(f=>scope==='OVERALL'||cleanSection(f.section||f.Section)===scope).map((f,i)=>({'#':i+1,'Faculty Name':f.faculty_name||f.name||'',Designation:f.designation||'',Department:f.department||'ECE',Section:f.section||f.Section||'',Email:f.email||'', 'LeetCode Username':f.leetcode_username||'', 'LeetCode Problems Solved':Number(f.total_solved||0),'LeetCode 7 Days':Number(f.last_7_days||0),'LeetCode 30 Days':Number(f.last_30_days||0),'GitHub Username':f.github_username||f.github||'','GitHub Repositories':Number(f.github_repositories||0),'Status':f.status||''}));
      const name=`CodeMetrix_Faculty_Analytics_${scopeLabel}_${stamp}`;
      if(format==='xlsx') excelDownload(rows,'Faculty Analytics',`${name}.xlsx`); else if(format==='csv') downloadBlob(`${name}.csv`,rowsToCsv(rows),'text/csv;charset=utf-8'); else pdfTableDownload(rows,`CodeMetrix Faculty Analytics · ${scopeLabel}`,`${name}.pdf`); return;
    }
  }

  async function loadImageForReport(url) {
    return new Promise(resolve=>{
      if(!url) return resolve(null); const img=new Image(); img.crossOrigin='anonymous';
      img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth||img.width;canvas.height=img.naturalHeight||img.height;canvas.getContext('2d').drawImage(img,0,0);resolve({data:canvas.toDataURL('image/jpeg',.88),width:canvas.width,height:canvas.height});}catch(e){resolve(null)}};
      img.onerror=()=>resolve(null); img.src=url;
    });
  }

  async function generateTaskProofPdf(rows,scope,scopeLabel,stamp) {
    if(!window.jspdf?.jsPDF) throw new Error('PDF library is not available.');
    const {jsPDF}=window.jspdf; const doc=new jsPDF('portrait');
    const title='CodeMetrix · Task Submission Proof Report';
    doc.setFontSize(17); doc.text(title,14,16); doc.setFontSize(9); doc.setTextColor(100,116,139); doc.text(`Scope: ${scopeLabel} · Generated: ${new Date().toLocaleString()} · Proofs: ${rows.length}`,14,23);
    if(!rows.length){doc.setTextColor(15,23,42);doc.setFontSize(11);doc.text('No submitted proofs found for this scope.',14,38);doc.save(`CodeMetrix_Task_Proofs_${scopeLabel}_${stamp}.pdf`);return;}
    for(let i=0;i<rows.length;i++){
      if(i>0) doc.addPage(); const r=rows[i];
      doc.setTextColor(15,23,42);doc.setFontSize(13);doc.text(`${r.student_name||r.name||'Student'} · ${r.reg_no||r.register_number||'—'}`,14,34);
      doc.setFontSize(9);doc.setTextColor(71,85,105);doc.text(`Department: ${r.department||'ECE'} · Section: ${cleanSection(r.section).replace('ECE ','')}`,14,41);doc.text(`Submitted: ${r.submitted_at?new Date(r.submitted_at).toLocaleString():'—'}`,14,47);
      if(r.notes) doc.text(`Remarks: ${String(r.notes).slice(0,110)}`,14,53);
      const url=r.screenshot_url||r.proof_url||''; const img=await loadImageForReport(url);
      doc.setDrawColor(226,232,240);doc.setFillColor(248,250,252);doc.roundedRect(14,60,182,210,3,3,'FD');
      if(img){const maxW=170,maxH=198,ratio=Math.min(maxW/img.width,maxH/img.height);const w=img.width*ratio,h=img.height*ratio;doc.addImage(img.data,'JPEG',20+(maxW-w)/2,66+(maxH-h)/2,w,h);} else {doc.setTextColor(100,116,139);doc.setFontSize(10);doc.text('Screenshot could not be embedded.',105,145,{align:'center'});doc.setFontSize(7);doc.text(String(url).slice(0,100),105,154,{align:'center'});}
      doc.setFontSize(8);doc.setTextColor(148,163,184);doc.text(`Task proof ${i+1} of ${rows.length}`,14,286);doc.text('CodeMetrix Academic Verification',196,286,{align:'right'});
    }
    doc.save(`CodeMetrix_Task_Proofs_${scopeLabel}_${stamp}.pdf`);
  }

  function initReportGenerator() {
    const today=new Date().toISOString().slice(0,10); const from=new Date(); from.setDate(from.getDate()-7);
    const fromEl=document.getElementById('reportFromDate'); const toEl=document.getElementById('reportToDate');
    if(fromEl && !fromEl.value) fromEl.value=from.toISOString().slice(0,10); if(toEl && !toEl.value) toEl.value=today;
    document.querySelectorAll('.report-action[data-report]').forEach(btn=>btn.addEventListener('click',()=>openReportModal(btn.dataset.report)));
    document.getElementById('closeReportDownloadModal')?.addEventListener('click',closeReportModal);
    document.querySelector('[data-close-report-modal]')?.addEventListener('click',closeReportModal);
    document.querySelectorAll('.report-scope-option').forEach(btn=>btn.addEventListener('click',()=>{
      activeReportScope=btn.dataset.reportScope; document.querySelectorAll('.report-scope-option').forEach(b=>b.classList.toggle('active',b===btn));
      document.getElementById('reportModalSectionPickerWrap').hidden=activeReportScope!=='SECTION';
    }));
    document.getElementById('reportModalSectionPicker')?.addEventListener('change',e=>{document.getElementById('reportModalSectionLabel').textContent='Section '+e.target.value.replace('ECE ','');});
    document.getElementById('reportFormatOptions')?.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-report-format]'); if(!btn||!activeReportType)return;
      const format=btn.dataset.reportFormat; const scope=activeReportScope==='OVERALL'?'OVERALL':(document.getElementById('reportModalSectionPicker')?.value||document.getElementById('reportSectionSelect')?.value||'ECE A');
      const progress=document.getElementById('reportModalProgress'); if(progress){progress.hidden=false;progress.textContent='Preparing report…';}
      try{await downloadReport(activeReportType,scope,format);setReportMessage(`${REPORT_META[activeReportType].title} downloaded successfully.`);closeReportModal();}catch(err){if(progress){progress.hidden=false;progress.textContent=err.message||'Could not generate report.';}setReportMessage(err.message||'Could not generate report.',true);}
    });
    document.getElementById('reportSectionSelect')?.addEventListener('change',e=>{document.getElementById('reportModalSectionLabel').textContent=e.target.value==='OVERALL'?'Use selected section':'Section '+e.target.value.replace('ECE ','');});
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
