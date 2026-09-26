// ============================================================
// CODEMETRIX UNIFIED ADMIN & FACULTY COMMAND CENTER ENGINE
// ============================================================

(function () {
  'use strict';

  // Master State
  const state = {
    activeTab: 'tab-coding',
    students: typeof REGISTERED_STUDENTS !== 'undefined' ? [...REGISTERED_STUDENTS] : [],
    leetcodeData: [],
    githubData: [],
    assessment: {
      isPublished: localStorage.getItem('portal_test_published') === 'true',
      title: localStorage.getItem('portal_test_title') || 'Technical Assessment 2026',
      duration: parseInt(localStorage.getItem('portal_test_duration') || '45', 10),
      questions: JSON.parse(localStorage.getItem('portal_assigned_questions') || '[]'),
      submissions: JSON.parse(localStorage.getItem('portal_submissions') || '[]')
    },
    tasks: {
      submissions: [],
      activeTask: null
    }
  };

  // Helper escape
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

  document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initCodingTab();
    initAssessmentTab();
    await initTasksTab();
    initStudentsTab();
  });

  // ============================================================
  // 1. TAB CONTROLLER
  // ============================================================
  function initTabs() {
    const tabBtns = document.querySelectorAll('.unified-tab-btn');
    const panes = document.querySelectorAll('.admin-tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(target);
        if (activePane) activePane.classList.add('active');
        state.activeTab = target;
      });
    });

    // Logout
    document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
      sessionStorage.removeItem('admin_logged_in');
      window.location.href = 'index.html';
    });
  }

  // ============================================================
  // 2. TAB 1: CODING ANALYTICS & REPORTS
  // ============================================================
  async function initCodingTab() {
    try {
      const [lcRes, ghRes] = await Promise.all([
        fetch('LiveData.csv?t=' + Date.now()).catch(() => null),
        fetch('GitHubLiveData.csv?t=' + Date.now()).catch(() => null)
      ]);

      if (lcRes && lcRes.ok) {
        state.leetcodeData = parseCsv(await lcRes.text());
        const lcCountEl = document.getElementById('statLeetCount');
        if (lcCountEl) lcCountEl.textContent = state.leetcodeData.length || '372';
      }
      if (ghRes && ghRes.ok) {
        state.githubData = parseCsv(await ghRes.text());
        const ghCountEl = document.getElementById('statGitCount');
        if (ghCountEl) ghCountEl.textContent = state.githubData.length || '372';
      }
    } catch (e) {
      console.warn('[Coding Tab] CSV load:', e.message);
    }

    // Top 50 LeetCode
    document.getElementById('adminDownloadTop50Leet')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading, please wait.');
      const data = [...state.leetcodeData].sort((a, b) => num(b['Last 7 Days']) - num(a['Last 7 Days']) || num(b['Problems Solved']) - num(a['Problems Solved']));
      const top = data.slice(0, 50).map((s, i) => ({
        Rank: i + 1,
        'Register Number': s['Register Number'],
        'Student Name': s['Student Name'],
        Section: s.Section,
        'LeetCode Username': s['LeetCode Username'],
        'Problems Solved': num(s['Problems Solved']),
        'Last 7 Days': num(s['Last 7 Days']),
        'Total Submissions': num(s['Total Submissions']),
        Streak: s['Current Streak'] || ''
      }));
      const ws = XLSX.utils.json_to_sheet(top);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Top 50 LeetCode');
      XLSX.writeFile(wb, `CodeMetrix_Top_50_LeetCode_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // Top 50 GitHub
    document.getElementById('adminDownloadTop50Git')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading, please wait.');
      const data = [...state.githubData].sort((a, b) => num(b['Detected Deployments']) - num(a['Detected Deployments']) || num(b['Contributions 30 Days']) - num(a['Contributions 30 Days']));
      const top = data.slice(0, 50).map((s, i) => ({
        Rank: i + 1,
        'Register Number': s['Register Number'],
        'Student Name': s['Student Name'],
        Section: s.Section,
        'GitHub Username': s['GitHub Username'],
        'Detected Deployments': num(s['Detected Deployments']),
        'Contributions (30D)': num(s['Contributions 30 Days']),
        'Commits (30D)': num(s['Commits 30 Days']),
        'Repositories Total': num(s['Repositories Total'])
      }));
      const ws = XLSX.utils.json_to_sheet(top);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Top 50 GitHub');
      XLSX.writeFile(wb, `CodeMetrix_Top_50_GitHub_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // All Faculty LeetCode
    document.getElementById('adminDownloadFacultyLeet')?.addEventListener('click', async () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading, please wait.');
      try {
        const client = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
        const { data } = await client.from('faculties').select('*').order('faculty_name', { ascending: true });
        const faculty = data || [];
        const rows = faculty.map((f, i) => ({
          Rank: i + 1,
          'Faculty Name': f.faculty_name,
          Department: f.department,
          'LeetCode Username': f.leetcode_username,
          'Problems Solved': num(f.total_solved),
          'Last 7 Days': num(f.last_7_days)
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Status: 'No faculty records' }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Faculty LeetCode');
        XLSX.writeFile(wb, `CodeMetrix_Faculty_LeetCode_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } catch (e) {
        alert('Could not download faculty report: ' + e.message);
      }
    });

    // Merged All Students
    document.getElementById('adminDownloadAllMerged')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading, please wait.');
      const roster = state.students.map((s, i) => {
        const lc = state.leetcodeData.find(x => x['Register Number'] === s.reg_no) || {};
        const gh = state.githubData.find(x => x['Register Number'] === s.reg_no) || {};
        return {
          '#': i + 1,
          'Register Number': s.reg_no,
          'Student Name': s.name,
          'Department': s.department,
          'Section': s.section,
          'LeetCode Solved': num(lc['Problems Solved']),
          'LeetCode 7D': num(lc['Last 7 Days']),
          'GitHub Contributions 30D': num(gh['Contributions 30 Days']),
          'GitHub Deployments': num(gh['Detected Deployments'])
        };
      });
      const ws = XLSX.utils.json_to_sheet(roster);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Students');
      XLSX.writeFile(wb, `CodeMetrix_Master_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  // ============================================================
  // 3. TAB 2: ASSESSMENT MANAGEMENT
  // ============================================================
  function initAssessmentTab() {
    renderAssessmentStatus();
    renderQuestionsTable();
    loadSubmissionsAndRenderAnalytics();

    // Toggle Publish
    document.getElementById('btnAdminTogglePublish')?.addEventListener('click', () => {
      state.assessment.isPublished = !state.assessment.isPublished;
      localStorage.setItem('portal_test_published', state.assessment.isPublished ? 'true' : 'false');
      renderAssessmentStatus();
    });

    // Save test settings
    document.getElementById('btnAdminSaveTestDetails')?.addEventListener('click', () => {
      const title = document.getElementById('adminTestTitleInput')?.value.trim();
      const dur = parseInt(document.getElementById('adminTestDurationInput')?.value || '45', 10);
      if (title) state.assessment.title = title;
      state.assessment.duration = dur;
      localStorage.setItem('portal_test_title', state.assessment.title);
      localStorage.setItem('portal_test_duration', String(dur));
      alert('Test configuration saved successfully.');
    });

    // Dropzone question file upload
    const dropzone = document.getElementById('adminQuestionDropzone');
    const fileInput = document.getElementById('adminQuestionFileInput');

    dropzone?.addEventListener('click', () => fileInput?.click());
    document.getElementById('btnAdminBrowseQuestionFile')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleQuestionFile(file);
    });

    // Clear questions
    document.getElementById('btnAdminClearQuestions')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all active test questions?')) {
        state.assessment.questions = [];
        localStorage.setItem('portal_assigned_questions', '[]');
        renderQuestionsTable();
      }
    });

    // Export submissions to Excel
    document.getElementById('adminExportAllSubmissionsExcel')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      const subs = state.assessment.submissions;
      if (!subs.length) return alert('No submissions recorded yet for this assessment.');
      const rows = subs.map((s, i) => ({
        '#': i + 1,
        'Register Number': s.reg_no,
        'Student Name': s.student_name,
        'Department': s.department,
        'Section': s.section,
        'Marks Obtained': s.obtained_marks,
        'Total Marks': s.total_marks,
        'Percentage': s.percentage + '%',
        'Time Taken': s.time_taken,
        'Submitted At': s.submitted_at
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
      XLSX.writeFile(wb, `Assessment_Submissions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });

    // Export submissions to PDF
    document.getElementById('adminExportAllSubmissionsPdf')?.addEventListener('click', () => {
      if (!window.jspdf || !window.jspdf.jsPDF) return alert('PDF library loading...');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape');
      doc.setFontSize(14);
      doc.text('CodeMetrix - Technical Assessment Submissions Report', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()} · Total Submissions: ${state.assessment.submissions.length}`, 14, 22);

      const tableData = state.assessment.submissions.map((s, i) => [
        i + 1, s.reg_no, s.student_name, s.section, `${s.obtained_marks}/${s.total_marks}`, `${s.percentage}%`, s.time_taken || 'Completed', s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : ''
      ]);

      doc.autoTable({
        startY: 28,
        head: [['#', 'Register No', 'Student Name', 'Section', 'Score', 'Percentage', 'Time', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
      });

      doc.save(`Assessment_Submissions_${new Date().toISOString().slice(0, 10)}.pdf`);
    });
  }

  function renderAssessmentStatus() {
    const titleEl = document.getElementById('adminPubBannerTitle');
    const descEl = document.getElementById('adminPubBannerDesc');
    const btnEl = document.getElementById('btnAdminTogglePublish');

    if (state.assessment.isPublished) {
      if (titleEl) { titleEl.textContent = 'Assessment Status: LIVE / PUBLISHED'; titleEl.style.color = '#16a34a'; }
      if (descEl) descEl.textContent = 'Students can now enter their Register Number and take the assessment.';
      if (btnEl) {
        btnEl.innerHTML = '<span>⏸️ Unpublish / Stop Test</span>';
        btnEl.style.background = '#dc2626';
        btnEl.style.borderColor = '#b91c1c';
      }
    } else {
      if (titleEl) { titleEl.textContent = 'Assessment Status: Unpublished'; titleEl.style.color = '#0f172a'; }
      if (descEl) descEl.textContent = 'Students see "No active assessment" upon login until published.';
      if (btnEl) {
        btnEl.innerHTML = '<span>🚀 Publish Test to Students</span>';
        btnEl.style.background = '#16a34a';
        btnEl.style.borderColor = '#15803d';
      }
    }
  }

  function renderQuestionsTable() {
    const tbody = document.getElementById('adminQuestionsTableBody');
    const countEl = document.getElementById('adminActiveQuestionCount');
    const qs = state.assessment.questions;

    if (countEl) countEl.textContent = qs.length;
    if (!tbody) return;

    if (!qs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No questions assigned yet. Upload a CSV/Excel file above.</td></tr>`;
      return;
    }

    tbody.innerHTML = qs.map((q, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 10px; font-weight: 700;">${i + 1}</td>
        <td style="padding: 8px 10px;"><span style="background: ${q.type === 'FIB' ? '#fef3c7' : '#dbeafe'}; color: ${q.type === 'FIB' ? '#92400e' : '#1e40af'}; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">${esc(q.type || 'MCQ')}</span></td>
        <td style="padding: 8px 10px; color: #64748b;">${esc(q.category || 'General')}</td>
        <td style="padding: 8px 10px; max-width: 400px;">${esc(q.question)}</td>
        <td style="padding: 8px 10px; font-weight: 700; color: #16a34a;">${esc(q.correctAnswer || q.correct_answer || 'A')}</td>
      </tr>
    `).join('');
  }

  function handleQuestionFile(file) {
    const alertBox = document.getElementById('adminQuestionAlert');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let rows = [];
        if (file.name.endsWith('.csv')) {
          rows = parseCsv(e.target.result);
        } else if (typeof XLSX !== 'undefined') {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        }

        if (!rows.length) throw new Error('No valid question rows found in file.');

        const questions = rows.map((r, i) => {
          const type = (r.Type || r.type || (r['Option A'] ? 'MCQ' : 'FIB')).toUpperCase().includes('FIB') ? 'FIB' : 'MCQ';
          return {
            id: i + 1,
            type: type,
            category: r.Category || r.category || 'General',
            question: r.Question || r.question || r['Question Prompt'] || '',
            options: type === 'MCQ' ? [
              r['Option A'] || r.OptionA || r.a || '',
              r['Option B'] || r.OptionB || r.b || '',
              r['Option C'] || r.OptionC || r.c || '',
              r['Option D'] || r.OptionD || r.d || ''
            ] : [],
            correctAnswer: String(r['Correct Answer'] || r.correctAnswer || r.Answer || 'A').trim(),
            explanation: r.Explanation || r.explanation || ''
          };
        }).filter(q => q.question.trim().length > 0);

        state.assessment.questions = questions;
        localStorage.setItem('portal_assigned_questions', JSON.stringify(questions));
        renderQuestionsTable();

        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.className = 'alert alert-success';
          alertBox.textContent = `✓ Successfully imported ${questions.length} questions from ${file.name}!`;
        }
      } catch (err) {
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.className = 'alert alert-danger';
          alertBox.textContent = `Error parsing question file: ${err.message}`;
        }
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }

  async function loadSubmissionsAndRenderAnalytics() {
    try {
      if (window.APP_CONFIG?.PORTAL_SUPABASE_URL) {
        const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/submissions?select=*&order=submitted_at.desc`, {
          headers: {
            'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            state.assessment.submissions = data;
            localStorage.setItem('portal_submissions', JSON.stringify(data));
          }
        }
      }
    } catch (e) {
      console.warn('[Assessment Analytics] Supabase fetch error:', e.message);
    }

    renderSectionCards();
  }

  function renderSectionCards() {
    const grid = document.getElementById('adminSectionProgressGrid');
    if (!grid) return;

    const sections = ['A', 'B', 'C', 'D', 'E', 'F'];
    const cardsHtml = sections.map(sec => {
      const enrolled = state.students.filter(s => s.section === sec).length || 62;
      const completedSubs = state.assessment.submissions.filter(s => String(s.section).toUpperCase().includes(sec));
      const completedCount = completedSubs.length;
      const pct = Math.round((completedCount / Math.max(1, enrolled)) * 100);

      return `
        <div class="stat-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 0.95rem; color: #0f172a;">Section ${sec}</strong>
            <span style="font-size: 0.8rem; font-weight: 700; color: ${pct === 100 ? '#10b981' : '#2563eb'};">${pct}%</span>
          </div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${completedCount} / ${enrolled}</div>
          <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${pct === 100 ? '#10b981' : '#2563eb'};"></div>
          </div>
          <p style="font-size: 0.75rem; color: #64748b; margin: 6px 0 0 0;">${enrolled - completedCount} pending</p>
        </div>
      `;
    }).join('');

    grid.innerHTML = cardsHtml;
  }

  // ============================================================
  // 4. TAB 3: TASK & PROOF VERIFICATION
  // ============================================================
  async function initTasksTab() {
    await fetchTaskData();
    renderTasksTable();

    // Search and filters
    document.getElementById('adminTaskSearchInput')?.addEventListener('input', renderTasksTable);
    document.getElementById('adminTaskFilterSection')?.addEventListener('change', renderTasksTable);
    document.getElementById('adminTaskFilterStatus')?.addEventListener('change', renderTasksTable);

    // WhatsApp Reminder Copy
    document.getElementById('btnAdminCopyWhatsApp')?.addEventListener('click', () => {
      const secFilter = document.getElementById('adminTaskFilterSection')?.value || 'all';
      let pendingList = state.students;
      if (secFilter !== 'all') pendingList = pendingList.filter(s => s.section === secFilter);

      const submittedRegs = new Set(state.tasks.submissions.map(s => String(s.reg_no || s.register_number).toUpperCase()));
      const pendingRolls = pendingList.filter(s => !submittedRegs.has(s.reg_no)).map(s => `${s.reg_no} (${s.name})`);

      if (!pendingRolls.length) return alert('All students in selected section have submitted their proof!');

      const text = `📢 *REMINDER: TASK PROOF SUBMISSION REQUIRED*\n\nDear Students of ECE Section ${secFilter === 'all' ? 'A-F' : secFilter},\nThe following ${pendingRolls.length} students have not uploaded their proof screenshot:\n\n` + pendingRolls.slice(0, 80).join('\n') + `\n\n👉 Please submit immediately on CodeMetrix Task Desk.`;

      navigator.clipboard.writeText(text).then(() => {
        alert(`✓ Copied ${pendingRolls.length} pending roll numbers to clipboard for WhatsApp!`);
      }).catch(() => {
        prompt('Copy WhatsApp announcement:', text);
      });
    });

    // Lightbox modal close
    document.getElementById('closeAdminProofModal')?.addEventListener('click', () => {
      const m = document.getElementById('adminProofModal');
      if (m) m.style.display = 'none';
    });

    // Compiled PDF
    document.getElementById('btnAdminExportTaskPdf')?.addEventListener('click', () => {
      if (!window.jspdf || !window.jspdf.jsPDF) return alert('PDF library loading...');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('CodeMetrix - Student Task Proof Submission Log', 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()} · Total Records: ${state.tasks.submissions.length}`, 14, 22);

      const tableData = state.tasks.submissions.map((s, i) => [
        i + 1, s.reg_no || s.register_number, s.student_name || s.name, s.section, s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'Verified', s.notes || 'Proof Attached'
      ]);

      doc.autoTable({
        startY: 28,
        head: [['#', 'Register No', 'Student Name', 'Section', 'Date', 'Notes']],
        body: tableData.length ? tableData : [['—', 'No submissions recorded', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Task_Proof_Log_${new Date().toISOString().slice(0, 10)}.pdf`);
    });

    // CSV Export
    document.getElementById('btnAdminExportTaskCsv')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel/CSV library loading...');
      const rows = state.tasks.submissions.map((s, i) => ({
        '#': i + 1,
        'Register Number': s.reg_no || s.register_number,
        'Student Name': s.student_name || s.name,
        'Department': s.department || 'ECE',
        'Section': s.section,
        'Proof URL': s.proof_url || '',
        'Submitted At': s.submitted_at || '',
        'Notes': s.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Status: 'No submissions' }]);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Task_Submissions_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    });
  }

  async function fetchTaskData() {
    try {
      if (window.APP_CONFIG?.PORTAL_SUPABASE_URL) {
        const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/task_submissions?select=*&order=submitted_at.desc`, {
          headers: {
            'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          state.tasks.submissions = Array.isArray(data) ? data : [];
        }
      }
    } catch (e) {
      console.warn('[Tasks Tab] Supabase fetch:', e.message);
    }

    const total = state.students.length || 372;
    const submitted = state.tasks.submissions.length;
    const pending = Math.max(0, total - submitted);
    const pct = Math.round((submitted / total) * 100);

    const subEl = document.getElementById('taskSubmittedCount');
    const pendEl = document.getElementById('taskPendingCount');
    const pctEl = document.getElementById('taskSubmittedPct');

    if (subEl) subEl.textContent = submitted;
    if (pendEl) pendEl.textContent = pending;
    if (pctEl) pctEl.textContent = `${pct}% completion`;
  }

  function renderTasksTable() {
    const tbody = document.getElementById('adminTaskTableBody');
    if (!tbody) return;

    const q = (document.getElementById('adminTaskSearchInput')?.value || '').trim().toUpperCase();
    const secFilter = document.getElementById('adminTaskFilterSection')?.value || 'all';
    const statFilter = document.getElementById('adminTaskFilterStatus')?.value || 'all';

    const subMap = new Map();
    state.tasks.submissions.forEach(s => {
      const r = String(s.reg_no || s.register_number || '').toUpperCase();
      if (r) subMap.set(r, s);
    });

    let displayList = state.students.map(st => {
      const sub = subMap.get(st.reg_no);
      return {
        reg_no: st.reg_no,
        name: st.name,
        section: st.section,
        department: st.department,
        status: sub ? 'submitted' : 'pending',
        submitted_at: sub ? sub.submitted_at : null,
        proof_url: sub ? sub.proof_url : null,
        notes: sub ? sub.notes : null
      };
    });

    if (q) {
      displayList = displayList.filter(s => s.reg_no.includes(q) || s.name.toUpperCase().includes(q));
    }
    if (secFilter !== 'all') {
      displayList = displayList.filter(s => s.section === secFilter);
    }
    if (statFilter !== 'all') {
      displayList = displayList.filter(s => s.status === statFilter);
    }

    if (!displayList.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748b;">No matching student task records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = displayList.map(s => {
      const proofBtn = s.proof_url
        ? `<button type="button" class="btn-portal-secondary btn-view-proof" data-url="${esc(s.proof_url)}" data-name="${esc(s.name)}" style="padding: 4px 10px; font-size: 0.8rem;">🖼️ View Screenshot</button>`
        : '<span style="color:#94a3b8; font-size: 0.8rem;">No file</span>';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: 700; font-family: monospace;">${esc(s.reg_no)}</td>
          <td style="padding: 10px; font-weight: 600;">${esc(s.name)}</td>
          <td style="padding: 10px;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">Sec ${esc(s.section)}</span></td>
          <td style="padding: 10px;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; background: ${s.status === 'submitted' ? '#dcfce7' : '#fee2e2'}; color: ${s.status === 'submitted' ? '#15803d' : '#b91c1c'};">
              ${s.status === 'submitted' ? '✓ Submitted' : '⏳ Pending'}
            </span>
          </td>
          <td style="padding: 10px; color: #64748b; font-size: 0.82rem;">${s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}</td>
          <td style="padding: 10px;">${proofBtn}</td>
        </tr>
      `;
    }).join('');

    // Attach Lightbox event
    tbody.querySelectorAll('.btn-view-proof').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const name = btn.getAttribute('data-name');
        const modal = document.getElementById('adminProofModal');
        const img = document.getElementById('adminProofModalImg');
        const title = document.getElementById('adminProofModalTitle');
        if (modal && img && url) {
          img.src = url;
          if (title) title.textContent = `Proof Screenshot · ${name}`;
          modal.style.display = 'flex';
        }
      });
    });
  }

  // ============================================================
  // 5. TAB 4: STUDENT MASTER DIRECTORY (372 STUDENTS)
  // ============================================================
  function initStudentsTab() {
    renderRosterTable();

    document.getElementById('adminRosterSearchInput')?.addEventListener('input', renderRosterTable);
    document.getElementById('adminRosterSectionSelect')?.addEventListener('change', renderRosterTable);

    document.getElementById('adminDownloadRosterExcel')?.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') return alert('Excel library loading...');
      const rows = state.students.map((s, i) => ({
        '#': i + 1,
        'Register Number': s.reg_no,
        'Student Name': s.name,
        'Department': s.department,
        'Section': s.section
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Roster 372');
      XLSX.writeFile(wb, `ECE_Student_Roster_372_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  function renderRosterTable() {
    const tbody = document.getElementById('adminRosterTableBody');
    if (!tbody) return;

    const q = (document.getElementById('adminRosterSearchInput')?.value || '').trim().toUpperCase();
    const sec = document.getElementById('adminRosterSectionSelect')?.value || 'ALL';

    let list = state.students;
    if (sec !== 'ALL') {
      list = list.filter(s => s.section === sec);
    }
    if (q) {
      list = list.filter(s => s.reg_no.includes(q) || s.name.toUpperCase().includes(q));
    }

    tbody.innerHTML = list.map((s, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 10px; color: #64748b;">${i + 1}</td>
        <td style="padding: 8px 10px; font-weight: 700; font-family: monospace; color: #2563eb;">${esc(s.reg_no)}</td>
        <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">${esc(s.name)}</td>
        <td style="padding: 8px 10px; color: #64748b;">${esc(s.department || 'ECE')}</td>
        <td style="padding: 8px 10px;"><span style="background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.8rem;">Section ${esc(s.section)}</span></td>
      </tr>
    `).join('');
  }

  // ============================================================
  // CSV PARSER HELPER
  // ============================================================
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
