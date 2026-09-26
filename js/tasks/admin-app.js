// ===================================================================
// ADMIN & FACULTY DASHBOARD - JAVASCRIPT ANALYTICS & MANAGEMENT
// ===================================================================

let allTasks = [];
let selectedTaskId = null;
let currentTask = null;
let allStudents = [];
let taskSubmissions = [];
let pendingCsvStudents = [];

// Filters state
let currentStatusFilter = 'all'; // 'all' | 'submitted' | 'pending'
let currentSectionFilter = 'all';
let currentDeptFilter = 'all';
let currentSearchQuery = '';

// DOM Elements
const taskSelector = document.getElementById('adminTaskSelector');
const activeTaskTitle = document.getElementById('activeTaskTitle');
const activeTaskBadge = document.getElementById('activeTaskStatusBadge');
const activeTaskDeadlineText = document.getElementById('activeTaskDeadlineText');

const kpiTotalStudents = document.getElementById('kpiTotalStudents');
const kpiSubmittedCount = document.getElementById('kpiSubmittedCount');
const kpiSubmittedPct = document.getElementById('kpiSubmittedPct');
const kpiProgressBar = document.getElementById('kpiProgressBar');
const kpiPendingCount = document.getElementById('kpiPendingCount');
const kpiPendingPct = document.getElementById('kpiPendingPct');
const kpiTotalSections = document.getElementById('kpiTotalSections');

const sectionCardsContainer = document.getElementById('sectionCardsContainer');
const searchInput = document.getElementById('searchInput');
const filterSectionSelect = document.getElementById('filterSectionSelect');
const filterDeptSelect = document.getElementById('filterDeptSelect');
const studentsTableBody = document.getElementById('studentsTableBody');
const filteredResultsCount = document.getElementById('filteredResultsCount');

const tabCountAll = document.getElementById('tabCountAll');
const tabCountSubmitted = document.getElementById('tabCountSubmitted');
const tabCountPending = document.getElementById('tabCountPending');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  attachAdminEvents();
  // Live auto-refresh every 12 seconds
  setInterval(loadDashboard, 12000);
});

// 1. Load All Dashboard Data
async function loadDashboard() {
  try {
    allTasks = await DataService.getAllTasks();
    populateTaskSelector();

    if (allTasks.length > 0) {
      if (!selectedTaskId) {
        const activeOne = allTasks.find(t => t.is_active) || allTasks[0];
        selectedTaskId = activeOne.id;
      }
      currentTask = allTasks.find(t => t.id === selectedTaskId) || allTasks[0];
      updateTaskHeader(currentTask);
    }

    allStudents = await DataService.getAllStudents();
    taskSubmissions = await DataService.getSubmissionsForTask(currentTask ? currentTask.id : 'task-live-01');

    populateFilterDropdowns();
    computeAnalytics();
    renderFilteredTable();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    showToast('Error loading dashboard data', true);
  }
}

// 2. Populate Task Selector Dropdown
function populateTaskSelector() {
  taskSelector.innerHTML = '';
  if (allTasks.length === 0) {
    taskSelector.innerHTML = '<option value="">No Tasks Found</option>';
    return;
  }

  allTasks.forEach(task => {
    const opt = document.createElement('option');
    opt.value = task.id;
    opt.textContent = `${task.is_active ? '● [ACTIVE] ' : ''}${task.title}`;
    if (task.id === selectedTaskId) opt.selected = true;
    taskSelector.appendChild(opt);
  });
}

function updateTaskHeader(task) {
  if (!task) return;
  activeTaskTitle.textContent = task.title;
  activeTaskBadge.textContent = task.is_active ? 'Active' : 'Archived';
  activeTaskBadge.className = `badge ${task.is_active ? 'badge-live' : 'badge-closed'}`;

  if (task.deadline) {
    const d = new Date(task.deadline);
    activeTaskDeadlineText.textContent = `Deadline: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  } else {
    activeTaskDeadlineText.textContent = 'Deadline: Open';
  }
}

// 3. Populate Filter Dropdowns (Departments & Sections)
function populateFilterDropdowns() {
  const sections = new Set();
  const depts = new Set();

  allStudents.forEach(s => {
    if (s.section) sections.add(s.section);
    if (s.department) depts.add(s.department);
  });

  // Sections
  const sortedSec = Array.from(sections).sort();
  filterSectionSelect.innerHTML = '<option value="all">All Sections</option>';
  sortedSec.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec;
    opt.textContent = `Section ${sec}`;
    if (currentSectionFilter === sec) opt.selected = true;
    filterSectionSelect.appendChild(opt);
  });

  // Depts
  const sortedDept = Array.from(depts).sort();
  filterDeptSelect.innerHTML = '<option value="all">All Departments</option>';
  sortedDept.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (currentDeptFilter === d) opt.selected = true;
    filterDeptSelect.appendChild(opt);
  });
}

// 4. Compute Analytics & Render Section Cards
function computeAnalytics() {
  const total = allStudents.length;
  const submissionMap = new Map();
  taskSubmissions.forEach(sub => submissionMap.set(sub.reg_no.toUpperCase(), sub));

  let submittedCount = 0;
  allStudents.forEach(s => {
    if (submissionMap.has(s.reg_no.toUpperCase())) {
      submittedCount++;
    }
  });

  const pendingCount = total - submittedCount;
  const pctSubmitted = total > 0 ? Math.round((submittedCount / total) * 100) : 0;
  const pctPending = total > 0 ? Math.round((pendingCount / total) * 100) : 0;

  // Update KPI Cards
  kpiTotalStudents.textContent = total;
  kpiSubmittedCount.textContent = submittedCount;
  kpiSubmittedPct.textContent = `${pctSubmitted}%`;
  kpiProgressBar.style.width = `${pctSubmitted}%`;
  kpiPendingCount.textContent = pendingCount;
  kpiPendingPct.textContent = `${pctPending}%`;

  // Tab counters
  tabCountAll.textContent = total;
  tabCountSubmitted.textContent = submittedCount;
  tabCountPending.textContent = pendingCount;

  // Compute Section-wise Breakdown
  const sectionStats = {};
  allStudents.forEach(s => {
    const key = `${s.department}-${s.section}`;
    if (!sectionStats[key]) {
      sectionStats[key] = {
        department: s.department,
        section: s.section,
        total: 0,
        submitted: 0,
        pending: 0
      };
    }
    sectionStats[key].total++;
    if (submissionMap.has(s.reg_no.toUpperCase())) {
      sectionStats[key].submitted++;
    } else {
      sectionStats[key].pending++;
    }
  });

  kpiTotalSections.textContent = Object.keys(sectionStats).length;

  // Render Section Cards
  renderSectionCards(sectionStats);
}

// Render Section Cards
function renderSectionCards(sectionStats) {
  sectionCardsContainer.innerHTML = '';
  const keys = Object.keys(sectionStats).sort();

  if (keys.length === 0) {
    sectionCardsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No student sections found. Upload student roster to see section breakdown.</div>';
    return;
  }

  keys.forEach(key => {
    const item = sectionStats[key];
    const pct = item.total > 0 ? Math.round((item.submitted / item.total) * 100) : 0;

    const box = document.createElement('div');
    const isSelected = (currentSectionFilter === item.section && currentDeptFilter === item.department);
    box.className = `section-box ${isSelected ? 'active-filter' : ''}`;
    box.innerHTML = `
      <div class="section-top">
        <span class="section-name">${item.department} - Sec ${item.section}</span>
        <span class="section-percentage ${pct >= 75 ? 'high' : pct <= 40 ? 'low' : ''}">${pct}%</span>
      </div>
      <div class="section-counts">
        <span>Submitted: <strong>${item.submitted}</strong> / ${item.total}</span>
        <span>Pending: <strong style="color: var(--warning-text);">${item.pending}</strong></span>
      </div>
      <div class="section-bar-track">
        <div class="section-bar-thumb" style="width: ${pct}%;"></div>
      </div>
    `;

    // Click section card to quickly filter
    box.addEventListener('click', () => {
      if (currentSectionFilter === item.section && currentDeptFilter === item.department) {
        currentSectionFilter = 'all';
        currentDeptFilter = 'all';
      } else {
        currentSectionFilter = item.section;
        currentDeptFilter = item.department;
      }
      filterSectionSelect.value = currentSectionFilter;
      filterDeptSelect.value = currentDeptFilter;
      computeAnalytics();
      renderFilteredTable();
    });

    sectionCardsContainer.appendChild(box);
  });
}

// 5. Render Filtered Submissions Table
function renderFilteredTable() {
  const submissionMap = new Map();
  taskSubmissions.forEach(sub => submissionMap.set(sub.reg_no.toUpperCase(), sub));

  const filtered = allStudents.filter(student => {
    const isSubmitted = submissionMap.has(student.reg_no.toUpperCase());

    // Status filter
    if (currentStatusFilter === 'submitted' && !isSubmitted) return false;
    if (currentStatusFilter === 'pending' && isSubmitted) return false;

    // Section filter
    if (currentSectionFilter !== 'all' && student.section !== currentSectionFilter) return false;

    // Dept filter
    if (currentDeptFilter !== 'all' && student.department !== currentDeptFilter) return false;

    // Search query
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const matchReg = student.reg_no.toLowerCase().includes(q);
      const matchName = student.name.toLowerCase().includes(q);
      if (!matchReg && !matchName) return false;
    }

    return true;
  });

  filteredResultsCount.textContent = `Showing ${filtered.length} of ${allStudents.length} records`;

  if (filtered.length === 0) {
    studentsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No students match the current filters.
        </td>
      </tr>
    `;
    return;
  }

  studentsTableBody.innerHTML = '';
  filtered.forEach(student => {
    const sub = submissionMap.get(student.reg_no.toUpperCase());
    const isSubmitted = !!sub;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="font-family: monospace; font-size: 0.9rem; letter-spacing: 0.05em;">${student.reg_no}</strong>
      </td>
      <td>
        <div class="student-cell">
          <span class="student-name">${student.name}</span>
          <span class="student-email">${student.email || 'No email registered'}</span>
        </div>
      </td>
      <td>
        <span class="badge badge-pill">${student.department} - Sec ${student.section}</span>
      </td>
      <td>
        ${isSubmitted 
          ? `<span class="badge badge-live">✓ Submitted</span>` 
          : `<span class="badge" style="background-color: var(--warning-bg); color: var(--warning-text); border: 1px solid var(--warning-border);">⏳ Pending</span>`
        }
      </td>
      <td>
        ${isSubmitted ? new Date(sub.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '<span style="color: var(--text-muted);">-</span>'}
      </td>
      <td>
        ${isSubmitted && sub.screenshot_url ? `
          <img src="${sub.screenshot_url}" class="thumbnail-preview" alt="Proof" onclick='openScreenshotModal(${JSON.stringify(student)}, ${JSON.stringify(sub)})'>
        ` : '<span style="color: var(--text-muted); font-size: 0.8rem;">No Proof</span>'}
      </td>
      <td style="text-align: right;">
        ${isSubmitted ? `
          <button class="btn btn-outline btn-sm" onclick='openScreenshotModal(${JSON.stringify(student)}, ${JSON.stringify(sub)})'>
            View Proof
          </button>
        ` : `
          <button class="btn btn-outline btn-sm" onclick='notifySingleStudent("${student.reg_no}", "${student.name}")' title="Copy reminder text for student">
            Copy Alert
          </button>
        `}
      </td>
    `;
    studentsTableBody.appendChild(tr);
  });
}

// 6. WhatsApp Reminder Pending List Generator
function generateWhatsAppPendingText() {
  const submissionMap = new Map();
  taskSubmissions.forEach(sub => submissionMap.set(sub.reg_no.toUpperCase(), sub));

  const pendingList = allStudents.filter(student => {
    if (submissionMap.has(student.reg_no.toUpperCase())) return false;
    if (currentSectionFilter !== 'all' && student.section !== currentSectionFilter) return false;
    if (currentDeptFilter !== 'all' && student.department !== currentDeptFilter) return false;
    return true;
  });

  const sectionLabel = currentSectionFilter !== 'all' ? `Section ${currentSectionFilter}` : 'All Sections';
  const deptLabel = currentDeptFilter !== 'all' ? currentDeptFilter : 'All Departments';
  const taskName = currentTask ? currentTask.title : 'Task Submission';
  const portalUrl = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');

  let text = `📢 *TASK SUBMISSION REMINDER*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📌 *Task:* ${taskName}\n`;
  text += `🎓 *Target:* ${deptLabel} - ${sectionLabel}\n`;
  text += `⚠️ *Pending Count:* ${pendingList.length} Students\n\n`;

  if (pendingList.length === 0) {
    text += `🎉 Awesome! Everyone in this section has submitted their proof!\n`;
  } else {
    text += `*List of Pending Roll Numbers:*\n`;
    pendingList.forEach((s, idx) => {
      text += `${idx + 1}. *${s.reg_no}* - ${s.name}\n`;
    });
    text += `\n👉 *Submit your proof screenshot now:* ${portalUrl}\n`;
  }

  return text;
}

function openPendingCopyDialog() {
  const text = generateWhatsAppPendingText();
  document.getElementById('pendingCopyTextarea').value = text;
  document.getElementById('pendingCopyModal').classList.add('active');
}

function closePendingCopyModal() {
  document.getElementById('pendingCopyModal').classList.remove('active');
}

function copyPendingToClipboard() {
  const textarea = document.getElementById('pendingCopyTextarea');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('📋 Pending list copied to clipboard!');
    closePendingCopyModal();
  }).catch(() => {
    document.execCommand('copy');
    showToast('📋 Pending list copied!');
    closePendingCopyModal();
  });
}

function notifySingleStudent(regNo, name) {
  const taskName = currentTask ? currentTask.title : 'Task Submission';
  const text = `Hi ${name} (${regNo}), kindly submit your screenshot proof for "${taskName}" on the submission portal today.`;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied reminder for ${regNo}`);
  });
}

// 7. Export CSV / Excel Report
function exportCSVReport() {
  const submissionMap = new Map();
  taskSubmissions.forEach(sub => submissionMap.set(sub.reg_no.toUpperCase(), sub));

  const headers = ['Register No', 'Student Name', 'Department', 'Section', 'Email', 'Status', 'Submitted At', 'Screenshot URL', 'Notes'];
  const rows = [headers];

  allStudents.forEach(student => {
    const sub = submissionMap.get(student.reg_no.toUpperCase());
    const isSubmitted = !!sub;
    rows.push([
      `"${student.reg_no}"`,
      `"${student.name}"`,
      `"${student.department}"`,
      `"${student.section}"`,
      `"${student.email || ''}"`,
      `"${isSubmitted ? 'Submitted' : 'Pending'}"`,
      `"${isSubmitted ? new Date(sub.submitted_at).toLocaleString() : ''}"`,
      `"${isSubmitted && sub.screenshot_url ? sub.screenshot_url : ''}"`,
      `"${isSubmitted && sub.notes ? sub.notes.replace(/"/g, '""') : ''}"`
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  const filename = `Task_Report_${currentTask ? currentTask.title.replace(/[^a-zA-Z0-9]/g, '_') : 'Export'}.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📊 Report CSV downloaded successfully');
}

// 8. Bulk Download Screenshots as ZIP
async function downloadProofsZip() {
  if (taskSubmissions.length === 0) {
    alert('No submissions found for this task yet.');
    return;
  }

  showToast('📦 Bundling proof screenshots into ZIP...');
  const zip = new JSZip();
  const studentMap = new Map();
  allStudents.forEach(s => studentMap.set(s.reg_no.toUpperCase(), s));

  let count = 0;
  for (const sub of taskSubmissions) {
    if (!sub.screenshot_url) continue;
    const student = studentMap.get(sub.reg_no.toUpperCase());
    const deptSec = student ? `${student.department}_Sec${student.section}` : 'General';
    const filename = `${deptSec}/${sub.reg_no}_proof.png`;

    try {
      if (sub.screenshot_url.startsWith('data:image')) {
        const base64Data = sub.screenshot_url.split(',')[1];
        zip.file(filename, base64Data, { base64: true });
        count++;
      } else {
        const response = await fetch(sub.screenshot_url);
        const blob = await response.blob();
        zip.file(filename, blob);
        count++;
      }
    } catch (err) {
      console.warn(`Could not fetch proof for ${sub.reg_no}:`, err);
    }
  }

  if (count === 0) {
    alert('No screenshot files could be downloaded.');
    return;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const taskSlug = currentTask ? currentTask.title.replace(/[^a-zA-Z0-9]/g, '_') : 'Task';
  saveAs(content, `Proofs_${taskSlug}.zip`);
  showToast(`✅ Successfully downloaded ${count} proofs in ZIP!`);
}

// ===================================================================
// 8B. COMPILED ALL-IN-ONE PDF GENERATOR (Single PDF for All / Section)
// ===================================================================

function openPdfExportModal() {
  const select = document.getElementById('pdfSectionSelect');
  select.innerHTML = '<option value="all">🌐 All Sections Combined (Single Master PDF)</option>';

  // Unique sections from all students
  const sections = Array.from(
    new Set(allStudents.map(s => String(s.section || '').trim().toUpperCase()).filter(Boolean))
  ).sort();

  sections.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec;
    opt.textContent = `Section ${sec} Only`;
    if (currentSectionFilter === sec) opt.selected = true;
    select.appendChild(opt);
  });

  document.getElementById('pdfProgressBox').style.display = 'none';
  document.getElementById('btnGeneratePDF').disabled = false;
  document.getElementById('pdfExportModal').classList.add('active');
}

function closePdfExportModal() {
  document.getElementById('pdfExportModal').classList.remove('active');
  const btn = document.getElementById('btnGeneratePDF');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = 'Download PDF';
  }
  const box = document.getElementById('pdfProgressBox');
  if (box) box.style.display = 'none';
}

// Convert image URL to high-resolution JPEG Data URL for jsPDF
async function loadImageForPdf(url) {
  if (!url) return null;
  
  if (url.startsWith('data:image')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ data: url, width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (!res.ok) throw new Error('Fetch status ' + res.status);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ data: dataUrl, width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch (err) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}

async function generateCompiledPDF() {
  if (!taskSubmissions || taskSubmissions.length === 0) {
    alert('No submissions found to export.');
    return;
  }

  const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFClass) {
    alert('PDF library is loading. Please wait a moment and try again.');
    return;
  }

  const scope = document.getElementById('pdfSectionSelect').value;
  const studentMap = new Map();
  allStudents.forEach(s => studentMap.set(String(s.reg_no).trim().toUpperCase(), s));

  // Filter submissions by scope
  const exportList = taskSubmissions.filter(sub => {
    if (!sub.screenshot_url) return false;
    if (scope === 'all') return true;
    const student = studentMap.get(String(sub.reg_no).trim().toUpperCase());
    const sec = student ? student.section : sub.section;
    return String(sec).toUpperCase() === scope.toUpperCase();
  });

  if (exportList.length === 0) {
    alert(`No screenshot proofs found for Section ${scope}.`);
    return;
  }

  const btnGen = document.getElementById('btnGeneratePDF');
  const progressBox = document.getElementById('pdfProgressBox');
  const progressBar = document.getElementById('pdfProgressBar');
  const progressTitle = document.getElementById('pdfProgressTitle');
  const progressSub = document.getElementById('pdfProgressSub');

  btnGen.disabled = true;
  progressBox.style.display = 'block';
  progressBar.style.width = '0%';

  try {
    const doc = new jsPDFClass({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const taskTitle = currentTask ? currentTask.title : 'Task Submission Report';
    const totalPages = exportList.length + 1; // 1 cover page + N student pages

    // ==========================================
    // PAGE 1: PROFESSIONAL COVER / SUMMARY DOSSIER
    // ==========================================
    // Top banner
    doc.setFillColor(15, 23, 42); // Slate #0f172a
    doc.rect(0, 0, 210, 48, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('TASK SUBMISSION PROOF DOSSIER', 15, 22);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // #cbd5e1
    doc.text(taskTitle.substring(0, 85), 15, 32);

    // Meta Details Box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 56, 180, 36, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 56, 180, 36, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT OVERVIEW', 22, 66);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const scopeLabel = scope === 'all' ? 'All Sections Combined (Master Report)' : `Section ${scope} Only`;
    doc.text(`Scope: ${scopeLabel}`, 22, 73);
    doc.text(`Total Submitted Proofs: ${exportList.length} Students`, 22, 79);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 22, 85);

    // Summary Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 102, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('#', 18, 107);
    doc.text('REGISTER NO', 28, 107);
    doc.text('STUDENT NAME', 65, 107);
    doc.text('SECTION', 130, 107);
    doc.text('PAGE NO', 170, 107);

    // List First 25 students on cover summary
    let y = 117;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    const previewList = exportList.slice(0, 22);
    previewList.forEach((sub, idx) => {
      const student = studentMap.get(String(sub.reg_no).trim().toUpperCase()) || {};
      const reg = sub.reg_no || student.reg_no;
      const name = (student.name || sub.student_name || 'Student').substring(0, 32);
      const sec = student.section || sub.section || '-';

      doc.text(`${idx + 1}`, 18, y);
      doc.text(reg, 28, y);
      doc.text(name, 65, y);
      doc.text(`Sec ${sec}`, 130, y);
      doc.text(`Page ${idx + 2}`, 172, y);

      // Light separator
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 2, 195, y + 2);
      y += 7.2;
    });

    if (exportList.length > 22) {
      doc.setTextColor(100, 116, 139);
      doc.text(`... and ${exportList.length - 22} more student proofs attached below`, 105, y + 4, { align: 'center' });
    }

    // Cover Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Generated via TaskDesk Academic Verification System', 15, 290);
    doc.text(`Cover Page (1 of ${totalPages})`, 195, 290, { align: 'right' });

    // ==========================================
    // SUBSEQUENT PAGES: 1 PAGE PER PROOF
    // ==========================================
    for (let i = 0; i < exportList.length; i++) {
      const sub = exportList[i];
      const student = studentMap.get(String(sub.reg_no).trim().toUpperCase()) || {};
      const reg = sub.reg_no || student.reg_no;
      const name = student.name || sub.student_name || 'Student';
      const dept = student.department || sub.department || 'ECE';
      const sec = student.section || sub.section || '-';

      // Update progress
      const pct = Math.round(((i + 1) / exportList.length) * 100);
      progressBar.style.width = `${pct}%`;
      progressTitle.textContent = `Formatting Page ${i + 1} of ${exportList.length}...`;
      progressSub.textContent = `Rendering proof for ${name} (${reg})`;

      // Allow UI tick
      await new Promise(r => setTimeout(r, 10));

      doc.addPage();

      // Top Student Info Card (30mm)
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(15, 12, 180, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`${name}   |   ${reg}`, 20, 20);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      const subDate = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A';
      doc.text(`Department: ${dept}   |   Section: ${sec}   |   Submitted: ${subDate}`, 20, 27);

      if (sub.notes) {
        doc.text(`Remarks: ${sub.notes.substring(0, 90)}`, 20, 34);
      }

      // Embed Screenshot
      try {
        const imgObj = await loadImageForPdf(sub.screenshot_url);
        if (imgObj && imgObj.data) {
          const maxW = 180;
          const maxH = 230;
          const imgW = imgObj.width || 800;
          const imgH = imgObj.height || 600;
          const ratio = Math.min(maxW / imgW, maxH / imgH);
          const w = imgW * ratio;
          const h = imgH * ratio;
          const x = 15 + (maxW - w) / 2;
          const y = 44 + (maxH - h) / 2;

          // Shadow / border frame
          doc.setFillColor(248, 250, 252);
          doc.rect(15, 42, 180, 235, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(15, 42, 180, 235, 'S');

          // Draw the image
          doc.addImage(imgObj.data, 'JPEG', x, y, w, h);
        } else {
          // Placeholder if image failed
          doc.setFillColor(241, 245, 249);
          doc.rect(15, 42, 180, 80, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(15, 42, 180, 80, 'S');
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(10);
          doc.text('Screenshot proof image could not be loaded directly', 105, 78, { align: 'center' });
          doc.setFontSize(8);
          doc.text(String(sub.screenshot_url).substring(0, 85), 105, 88, { align: 'center' });
        }
      } catch (imgErr) {
        console.warn('Image rendering note:', imgErr);
      }

      // Page Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('TaskDesk Academic Verification System', 15, 290);
      doc.text(`Page ${i + 2} of ${totalPages}`, 195, 290, { align: 'right' });
    }

    // Save PDF
    const cleanScope = scope === 'all' ? 'All_Sections_Combined' : `Section_${scope}`;
    const cleanTask = taskTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const filename = `TaskProofs_${cleanTask}_${cleanScope}.pdf`;

    doc.save(filename);
    showToast(`✅ Successfully downloaded ${exportList.length} proofs in PDF!`);
    closePdfExportModal();

  } catch (err) {
    console.error('PDF generation error:', err);
    alert('Failed to generate PDF: ' + err.message);
  } finally {
    btnGen.disabled = false;
    progressBox.style.display = 'none';
  }
}

// 9. Screenshot Modal Lightbox
function openScreenshotModal(student, sub) {
  document.getElementById('modalStudentTitle').textContent = `${student.name} (${student.reg_no})`;
  document.getElementById('modalStudentMeta').textContent = `${student.department} - Section ${student.section}`;
  document.getElementById('lightboxImg').src = sub.screenshot_url;
  document.getElementById('lightboxNotes').textContent = sub.notes ? `Remarks: "${sub.notes}"` : '';
  document.getElementById('lightboxTimestamp').textContent = `Submitted: ${new Date(sub.submitted_at).toLocaleString()}`;
  document.getElementById('btnDownloadSingleImg').href = sub.screenshot_url;
  document.getElementById('screenshotModal').classList.add('active');
}

function closeScreenshotModal() {
  document.getElementById('screenshotModal').classList.remove('active');
}

// 10. New Task Modal Handlers
function openNewTaskModal() {
  document.getElementById('newTaskModal').classList.add('active');
}

function closeNewTaskModal() {
  document.getElementById('newTaskModal').classList.remove('active');
}

async function handleCreateNewTask(e) {
  e.preventDefault();
  const title = document.getElementById('taskTitleInput').value.trim();
  const description = document.getElementById('taskDescInput').value.trim();
  const deadline = document.getElementById('taskDeadlineInput').value;
  const is_active = document.getElementById('taskSetActiveCheckbox').checked;

  if (!title) {
    alert('Please enter a task title.');
    return;
  }

  try {
    const created = await DataService.createTask({
      title,
      description,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      is_active
    });

    showToast('Task created successfully!');
    closeNewTaskModal();
    selectedTaskId = created.id;
    await loadDashboard();
  } catch (err) {
    alert('Failed to create task: ' + err.message);
  }
}

// 11. Student Roster Modal (CSV & Manual)
function openRosterModal() {
  document.getElementById('rosterModal').classList.add('active');
}

function closeRosterModal() {
  document.getElementById('rosterModal').classList.remove('active');
  pendingCsvStudents = [];
  document.getElementById('csvParsedPreview').style.display = 'none';
}

function downloadSampleCSV() {
  const sample = `reg_no,name,department,section,email\n717822P101,Aarav Sharma,CSE,A,aarav.sharma@college.edu\n717822P102,Abhinav Patel,CSE,A,abhinav.patel@college.edu\n717822P201,Harish Raghavan,CSE,B,harish.r@college.edu`;
  const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'student_roster_template.csv');
}

function handleCsvFileSelect(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseStudentCSV(text);
  };
  reader.readAsText(file);
}

function parseStudentCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    alert('CSV must contain a header row and at least one student row.');
    return;
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const regIdx = headers.indexOf('reg_no') >= 0 ? headers.indexOf('reg_no') : headers.indexOf('regno');
  const nameIdx = headers.indexOf('name');
  const deptIdx = headers.indexOf('department') >= 0 ? headers.indexOf('department') : headers.indexOf('dept');
  const secIdx = headers.indexOf('section') >= 0 ? headers.indexOf('section') : headers.indexOf('sec');
  const emailIdx = headers.indexOf('email');

  if (regIdx === -1 || nameIdx === -1 || deptIdx === -1 || secIdx === -1) {
    alert('CSV must contain columns: reg_no, name, department, section');
    return;
  }

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols[regIdx] && cols[nameIdx]) {
      students.push({
        reg_no: cols[regIdx].toUpperCase(),
        name: cols[nameIdx],
        department: cols[deptIdx] ? cols[deptIdx].toUpperCase() : 'GENERAL',
        section: cols[secIdx] ? cols[secIdx].toUpperCase() : 'A',
        email: emailIdx >= 0 && cols[emailIdx] ? cols[emailIdx] : ''
      });
    }
  }

  pendingCsvStudents = students;
  document.getElementById('csvCountMessage').textContent = `Parsed ${students.length} students from CSV. Ready to save!`;
  document.getElementById('csvParsedPreview').style.display = 'block';
}

async function commitRosterImport() {
  if (pendingCsvStudents.length === 0) return;
  try {
    await DataService.bulkInsertStudents(pendingCsvStudents);
    showToast(`Imported ${pendingCsvStudents.length} students into roster!`);
    closeRosterModal();
    await loadDashboard();
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}

async function handleManualStudentAdd(e) {
  e.preventDefault();
  const reg_no = document.getElementById('manRegNo').value.trim().toUpperCase();
  const name = document.getElementById('manName').value.trim();
  const department = document.getElementById('manDept').value.trim().toUpperCase();
  const section = document.getElementById('manSec').value.trim().toUpperCase();

  if (!reg_no || !name || !department || !section) {
    alert('Please fill all fields');
    return;
  }

  try {
    await DataService.bulkInsertStudents([{ reg_no, name, department, section }]);
    showToast(`Added ${name} (${reg_no})`);
    document.getElementById('addSingleStudentForm').reset();
    await loadDashboard();
  } catch (err) {
    alert('Failed to add student: ' + err.message);
  }
}

// 12. Attach All Event Listeners
function attachAdminEvents() {
  taskSelector.addEventListener('change', async (e) => {
    selectedTaskId = e.target.value;
    currentTask = allTasks.find(t => t.id === selectedTaskId);
    updateTaskHeader(currentTask);
    taskSubmissions = currentTask ? await DataService.getSubmissionsForTask(currentTask.id) : [];
    computeAnalytics();
    renderFilteredTable();
  });

  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim();
    renderFilteredTable();
  });

  filterSectionSelect.addEventListener('change', (e) => {
    currentSectionFilter = e.target.value;
    computeAnalytics();
    renderFilteredTable();
  });

  filterDeptSelect.addEventListener('change', (e) => {
    currentDeptFilter = e.target.value;
    computeAnalytics();
    renderFilteredTable();
  });

  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.getAttribute('data-status');
      renderFilteredTable();
    });
  });

  const refreshBtn = document.getElementById('btnRefreshData');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '⏳ Loading...';
      await loadDashboard();
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '🔄 Refresh';
      showToast('Dashboard data refreshed!');
    });
  }

  document.getElementById('btnCopyWhatsAppPending').addEventListener('click', openPendingCopyDialog);
  document.getElementById('btnExportCSV').addEventListener('click', exportCSVReport);
  document.getElementById('btnDownloadZip').addEventListener('click', downloadProofsZip);
  document.getElementById('btnOpenPdfModal').addEventListener('click', openPdfExportModal);
  document.getElementById('btnGeneratePDF').addEventListener('click', generateCompiledPDF);
  document.getElementById('btnNewTask').addEventListener('click', openNewTaskModal);
  document.getElementById('btnManageStudents').addEventListener('click', openRosterModal);

  document.getElementById('newTaskForm').addEventListener('submit', handleCreateNewTask);

  const csvDrop = document.getElementById('csvDropzone');
  const csvInput = document.getElementById('csvFileInput');
  csvDrop.addEventListener('click', () => csvInput.click());
  csvInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleCsvFileSelect(e.target.files[0]);
    }
  });

  document.getElementById('btnCommitImport').addEventListener('click', commitRosterImport);
  document.getElementById('addSingleStudentForm').addEventListener('submit', handleManualStudentAdd);
}

// 13. Toast Notification Helper
function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.className = `toast ${isError ? 'error' : 'success'} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}
