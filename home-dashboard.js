(() => {
  const state = { leetcode: [], github: [], merged: [], currentUser: null, currentRole: null };
  const els = {
    leetTop: document.getElementById('top50LeetCodeButton'),
    gitTop: document.getElementById('top50GitHubButton'),
    facultyLeetCode: document.getElementById('allFacultyLeetCodeButton'),
    back: document.getElementById('homeBackButton'),
    form: document.getElementById('studentSearchForm'),
    input: document.getElementById('studentSearchInput'),
    modal: document.getElementById('studentDashboardModal'),
    close: document.getElementById('closeStudentDashboard'),
    content: document.getElementById('studentDashboardContent'),
    title: document.getElementById('studentDashboardTitle'),
    subtitle: document.getElementById('studentDashboardSubtitle'),
    message: document.getElementById('homeActionMessage'),

    // Admin Auth
    adminLoginBtn: document.getElementById('homeAdminLoginButton'),
    sectionAdminLoginBtn: document.getElementById('sectionAdminLoginButton'),
    adminLogoutBtn: document.getElementById('homeAdminLogoutButton'),
    adminSessionCard: document.getElementById('homeAdminSessionCard'),
    sessionEmail: document.getElementById('homeSessionEmail'),
    accessLabel: document.getElementById('homeAccessLabel'),
    accessNote: document.getElementById('homeAccessNote'),
    adminLoginModal: document.getElementById('homeAdminLoginModal'),
    adminLoginForm: document.getElementById('homeAdminLoginForm'),
    adminEmail: document.getElementById('homeAdminEmail'),
    adminPassword: document.getElementById('homeAdminPassword'),
    adminSignInBtn: document.getElementById('homeAdminSignInButton'),
    adminLoginMsg: document.getElementById('homeAdminLoginMessage'),
    closeAdminLogin: document.getElementById('closeHomeAdminLogin'),
    toggleAdminPassword: document.getElementById('toggleHomeAdminPassword'),

    // Unified Add Profile
    addProfileBtn: document.getElementById('homeAddProfileButton'),
    sectionAddProfileBtn: document.getElementById('sectionAddProfileButton'),
    unifiedModal: document.getElementById('homeUnifiedProfileModal'),
    closeUnifiedModal: document.getElementById('closeHomeUnifiedProfile'),
    unifiedForm: document.getElementById('homeUnifiedProfileForm'),
    regInput: document.getElementById('homeRegNumber'),
    nameInput: document.getElementById('homeStudentName'),
    yearInput: document.getElementById('homeStudentYear'),
    sectionInput: document.getElementById('homeStudentSection'),
    leetcodeInput: document.getElementById('homeLeetcodeUser'),
    githubInput: document.getElementById('homeGithubUser'),
    saveProfileBtn: document.getElementById('homeSaveProfileButton'),
    profileMsg: document.getElementById('homeProfileFormMessage'),
    dateReportButton: document.getElementById('homeOpenDateReportButton'),
    dateReportModal: document.getElementById('homeDateReportModal'),
    closeDateReport: document.getElementById('closeHomeDateReport'),
    cancelDateReport: document.getElementById('cancelHomeDateReport'),
    dateReportFrom: document.getElementById('homeDateReportFrom'),
    dateReportTo: document.getElementById('homeDateReportTo'),
    dateReportSection: document.getElementById('homeDateReportSection'),
    dateReportScope: document.getElementById('homeDateReportScope'),
    dateReportMessage: document.getElementById('homeDateReportMessage'),
    downloadDateReportCsv: document.getElementById('homeDownloadDateReportCsv'),
    downloadDateReportExcel: document.getElementById('homeDownloadDateReportExcel'),
    downloadDateReportPdf: document.getElementById('homeDownloadDateReportPdf'),

    // Solved Problems & Code Viewer Modals
    solvedModal: document.getElementById('solvedProblemsModal'),
    closeSolvedModal: document.getElementById('closeSolvedProblems'),
    solvedTitle: document.getElementById('solvedProblemsTitle'),
    solvedSubtitle: document.getElementById('solvedProblemsSubtitle'),
    solvedTableBody: document.getElementById('solvedProblemsTableBody'),
    summaryTotalSynced: document.getElementById('summaryTotalSynced'),
    summaryCleanCount: document.getElementById('summaryCleanCount'),
    summaryFlaggedCount: document.getElementById('summaryFlaggedCount'),
    summaryExtStatus: document.getElementById('summaryExtStatus'),

    solutionModal: document.getElementById('solutionCodeModal'),
    closeSolutionModal: document.getElementById('closeSolutionCode'),
    solutionProblemName: document.getElementById('solutionProblemName'),
    solutionDifficultyBadge: document.getElementById('solutionDifficultyBadge'),
    solutionMetadata: document.getElementById('solutionMetadata'),
    telemetryActiveTime: document.getElementById('telemetryActiveTime'),
    telemetryKeystrokes: document.getElementById('telemetryKeystrokes'),
    telemetryPastes: document.getElementById('telemetryPastes'),
    telemetryTabSwitches: document.getElementById('telemetryTabSwitches'),
    telemetryRiskScore: document.getElementById('telemetryRiskScore'),
    telemetryVerdict: document.getElementById('telemetryVerdict'),
    solutionAlertBanner: document.getElementById('solutionAlertBanner'),
    solutionAlertText: document.getElementById('solutionAlertText'),
    solutionCodeLang: document.getElementById('solutionCodeLang'),
    copySolutionCodeBtn: document.getElementById('copySolutionCodeBtn'),
    solutionCodeContent: document.getElementById('solutionCodeContent'),

    downloadSolvedHistoryExcelBtn: document.getElementById('downloadSolvedHistoryExcelBtn'),
    downloadSolvedHistoryPdfBtn: document.getElementById('downloadSolvedHistoryPdfBtn')
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = (v) => { const n = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
  const normalizeReg = (v) => String(v ?? '').trim().replace(/\.0$/, '');
  const normalizeText = (v) => String(v ?? '').trim().toLowerCase();

  function parseCSV(text) {
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

  async function loadFile(file){
    const r=await fetch(`${file}?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok) throw new Error(`${file} could not be loaded (${r.status})`);
    return parseCSV(await r.text());
  }

  function setMessage(text, error=false){
    els.message.textContent=text;
    els.message.className=`home-action-message ${error?'error':''}`;
    clearTimeout(setMessage.timer);
    setMessage.timer=setTimeout(()=>{els.message.textContent='';els.message.className='home-action-message';},4500);
  }

  async function loadData(){
    [state.leetcode,state.github]=await Promise.all([loadFile('LiveData.csv'),loadFile('GitHubLiveData.csv')]);
    buildMergedIndex();
  }

  function buildMergedIndex(){
    const map = new Map();
    const add = (row, source) => {
      const reg = normalizeReg(row['Register Number']);
      const key = reg || `${normalizeText(row['Student Name'])}|${normalizeText(source==='leetcode'?row['LeetCode Username']:row['GitHub Username'])}`;
      if(!key) return;
      if(!map.has(key)) map.set(key, { lc:null, gh:null });
      map.get(key)[source === 'leetcode' ? 'lc' : 'gh'] = row;
    };
    state.leetcode.forEach(r=>add(r,'leetcode'));
    state.github.forEach(r=>add(r,'github'));
    state.merged = [...map.values()];
  }

  function leetcodeSort(rows){
    return [...rows].sort((a,b)=> num(b['Last 7 Days'])-num(a['Last 7 Days']) || num(b['Problems Solved'])-num(a['Problems Solved']) || num(b['Total Submissions'])-num(a['Total Submissions']));
  }
  function githubSort(rows){
    return [...rows].sort((a,b)=> num(b['Detected Deployments'])-num(a['Detected Deployments']) || num(b['Repositories Total'])-num(a['Repositories Total']) || num(b['Contributions 30 Days'])-num(a['Contributions 30 Days']) || num(b['Commits 30 Days'])-num(a['Commits 30 Days']));
  }

  function downloadTop50(rows, type){
    if(typeof XLSX==='undefined') throw new Error('Excel library is not available. Check your internet connection and reload the page.');
    const sorted=type==='leetcode'?leetcodeSort(rows):githubSort(rows);
    const top=sorted.slice(0,50).map((s,i)=>{
      if(type==='leetcode') return {Rank:i+1,'Register Number':s['Register Number'],'Student Name':s['Student Name'],Section:s.Section,'LeetCode Username':s['LeetCode Username'],'Problems Solved':num(s['Problems Solved']),'Solved Today':num(s['Solved Today']),'Last 7 Days':num(s['Last 7 Days']),'Last 30 Days':num(s['Last 30 Days']),'Total Submissions':num(s['Total Submissions']),Easy:num(s.Easy),Medium:num(s.Medium),Hard:num(s.Hard),'Current Streak':s['Current Streak']||'','Last Problem':s['Last Problem']||'','Last Solved':s['Last Solved']||'',Status:s.Status||'', 'Updated At':s['Updated At']||''};
      return {Rank:i+1,'Register Number':s['Register Number'],'Student Name':s['Student Name'],Section:s.Section,'GitHub Username':s['GitHub Username'],'Detected Deployments':num(s['Detected Deployments']),'Repositories Total':num(s['Repositories Total']),'Contributions 30 Days':num(s['Contributions 30 Days']),'Commits 30 Days':num(s['Commits 30 Days']),'Repositories 30 Days':num(s['Repositories 30 Days']),'Latest Repository':s['Latest Repository']||'','Last Activity':s['Last Activity']||'',Status:s.Status||'', 'Updated At':s['Updated At']||''};
    });
    const ws=XLSX.utils.json_to_sheet(top); ws['!cols']=Object.keys(top[0]||{}).map(k=>({wch:Math.min(32,Math.max(12,k.length+3))}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,type==='leetcode'?'Top 50 LeetCode':'Top 50 GitHub');
    XLSX.writeFile(wb,type==='leetcode'?'CodeMetrix_Top_50_LeetCode.xlsx':'CodeMetrix_Top_50_GitHub.xlsx');
    setMessage(`Top 50 ${type==='leetcode'?'LeetCode':'GitHub'} Excel downloaded.`);
  }

  function supabaseClient(){
    if(window.supabase && typeof window.supabase.createClient==='function' && window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_ANON_KEY){
      return window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
    }
    throw new Error('Supabase is not configured on this page.');
  }

  async function downloadAllFacultyLeetCodeReport(){
    if(typeof XLSX==='undefined') throw new Error('Excel library is not available. Check your internet connection and reload the page.');
    const client=supabaseClient();
    const {data,error}=await client.from('faculties').select('*').order('faculty_name',{ascending:true});
    if(error) throw new Error(`Faculty data could not be loaded: ${error.message}`);
    const faculty=data||[];
    if(!faculty.length) throw new Error('No faculty LeetCode records are available.');

    const rows=faculty.map((f,i)=>({
      Rank:i+1,
      'Faculty ID':f.faculty_id||'',
      'Faculty Name':f.faculty_name||'',
      Designation:f.designation||'',
      Department:f.department||'',
      Email:f.email||'',
      'LeetCode Username':f.leetcode_username||'',
      'Problems Solved':num(f.total_solved),
      'Solved Today':num(f.solved_today),
      'Last 7 Days':num(f.last_7_days),
      'Last 30 Days':num(f.last_30_days),
      Easy:num(f.easy),
      Medium:num(f.medium),
      Hard:num(f.hard),
      'Total Submissions':num(f.total_submissions),
      'Last Problem':f.last_problem||'',
      'Last Solved':f.last_solved||'',
      Status:f.status||'',
      'Updated At':f.updated_at||f.tracked_at||''
    }));

    const ws=XLSX.utils.json_to_sheet(rows);
    ws['!cols']=Object.keys(rows[0]).map(k=>({wch:Math.min(34,Math.max(12,k.length+3))}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'All Faculty LeetCode');
    XLSX.writeFile(wb,`CodeMetrix_All_Faculty_LeetCode_${new Date().toISOString().slice(0,10)}.xlsx`);
    setMessage(`All faculty LeetCode report downloaded (${rows.length} faculty).`);
  }

  function downloadAllStudentsMerged(){
    if(typeof XLSX==='undefined') throw new Error('Excel library is not available. Check your internet connection and reload the page.');
    const rows = state.merged.map((item, i) => {
      const lc = item.lc || {};
      const gh = item.gh || {};
      return {
        '#': i + 1,
        'Register Number': getRegister(item),
        'Student Name': getStudentName(item),
        'Section': getSection(item),
        'LeetCode Username': lc['LeetCode Username'] || '',
        'LeetCode Solved': num(lc['Problems Solved']),
        'LeetCode Solved Today': num(lc['Solved Today']),
        'LeetCode 7 Days': num(lc['Last 7 Days']),
        'LeetCode 14 Days': num(lc['Last 14 Days']),
        'LeetCode 30 Days': num(lc['Last 30 Days']),
        'LeetCode 7D Submissions': num(lc['Last 7 Days Submissions']),
        'LeetCode Total Submissions': num(lc['Total Submissions']),
        'LeetCode Easy': num(lc['Easy']),
        'LeetCode Medium': num(lc['Medium']),
        'LeetCode Hard': num(lc['Hard']),
        'LeetCode Status': lc['Status'] || '',
        'GitHub Username': gh['GitHub Username'] || '',
        'GitHub Repos Total': num(gh['Repositories Total']),
        'GitHub Deployments': num(gh['Detected Deployments']),
        'GitHub Contributions 30D': num(gh['Contributions 30 Days']),
        'GitHub Commits 30D': num(gh['Commits 30 Days']),
        'GitHub Commits 7D': num(gh['Commits 7 Days']),
        'GitHub Status': gh['Status'] || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.min(32, Math.max(12, k.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Students');
    XLSX.writeFile(wb, `CodeMetrix_All_Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setMessage(`All students report downloaded (${rows.length} students).`);
  }

  function downloadSingleStudentReport(item){
    if(typeof XLSX==='undefined') throw new Error('Excel library is not available.');
    const lc = item.lc || {};
    const gh = item.gh || {};
    const studentName = getStudentName(item);
    const reg = getRegister(item);
    const summary = [
      ['CodeMetrix Student Performance Report'],
      ['Student Name', studentName],
      ['Register Number', reg],
      ['Section', getSection(item)],
      ['Generated On', new Date().toLocaleString()],
      [],
      ['Metric', 'LeetCode Performance', 'Metric', 'GitHub Performance'],
      ['LeetCode Username', lc['LeetCode Username'] || '—', 'GitHub Username', gh['GitHub Username'] || '—'],
      ['Problems Solved', num(lc['Problems Solved']), 'Repositories', num(gh['Repositories Total'])],
      ['Solved Today', num(lc['Solved Today']), 'Deployments', num(gh['Detected Deployments'])],
      ['Last 7 Days', num(lc['Last 7 Days']), 'Contributions (30D)', num(gh['Contributions 30 Days'])],
      ['Last 14 Days', num(lc['Last 14 Days']), 'Commits (30D)', num(gh['Commits 30 Days'])],
      ['Last 30 Days', num(lc['Last 30 Days']), 'Commits (7D)', num(gh['Commits 7 Days'])],
      ['Easy / Medium / Hard', `${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`, 'Repositories (30D)', num(gh['Repositories 30 Days'])],
      ['Latest Problem', lc['Last Problem'] || '—', 'Latest Repository', gh['Latest Repository'] || '—'],
      ['Status', lc.Status || '—', 'Status', gh.Status || '—']
    ];
    const ws = XLSX.utils.aoa_to_sheet(summary);
    ws['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 24 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student Report');
    XLSX.writeFile(wb, `Student_${reg || studentName.replace(/\s+/g,'_')}_Report.xlsx`);
    setMessage(`Student report downloaded for ${studentName}.`);
  }

  function getStudentName(item){ return item.lc?.['Student Name'] || item.gh?.['Student Name'] || 'Unknown Student'; }
  function getRegister(item){ return normalizeReg(item.lc?.['Register Number'] || item.gh?.['Register Number']); }
  function getSection(item){ return item.lc?.Section || item.gh?.Section || 'Section not available'; }

  function searchStudents(query){
    const q=normalizeText(query);
    if(!q) return [];
    return state.merged.filter(item=>{
      const fields=[
        getRegister(item), getStudentName(item), getSection(item),
        item.lc?.['LeetCode Username'], item.lc?.['LeetCode Link'],
        item.gh?.['GitHub Username'], item.gh?.['GitHub Link']
      ].map(normalizeText);
      return fields.some(v=>v && v.includes(q));
    }).sort((a,b)=>getStudentName(a).localeCompare(getStudentName(b)));
  }

  function card(title, items){
    return `<article class="student-metric-card"><div class="student-metric-card-title">${title}</div>${items.map(([k,v])=>`<div class="student-metric-row"><span>${esc(k)}</span><strong>${v}</strong></div>`).join('')}</article>`;
  }

  let currentSolvedSubmissions = [];
  let currentSolvedStudent = null;

  function openDashboard(item){
    const gh=item.gh, lc=item.lc;
    const reg = getRegister(item);
    const studentName = getStudentName(item);
    const section = getSection(item);
    const lcUser = lc?.['LeetCode Username'] || '';

    els.title.textContent=studentName;
    els.subtitle.textContent=`Register Number: ${reg||'—'} · ${section}`;

    const lcItems=lc ? [
      ['Problems Solved',num(lc['Problems Solved'])],
      ['Solved Today',num(lc['Solved Today'])],
      ['Last 7 Days',num(lc['Last 7 Days'])],
      ['7D Submissions',num(lc['Last 7 Days Submissions'])],
      ['Last 30 Days',num(lc['Last 30 Days'])],
      ['Total Submissions',num(lc['Total Submissions'])],
      ['Easy / Medium / Hard',`${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`],
      ['Submission Integrity', '<span id="homeStudentIntegrityBadge" class="integrity-badge unverified">Checking...</span>'],
      ['Current Streak',lc['Current Streak']||'—'],
      ['Last Problem',lc['Last Problem']||'—'],
      ['Last Solved',lc['Last Solved']||'—']
    ] : [['Status','No LeetCode record']];

    const ghItems=gh ? [
      ['Deployments',num(gh['Detected Deployments'])],
      ['Repositories',num(gh['Repositories Total'])],
      ['Contributions · 30 Days',num(gh['Contributions 30 Days'])],
      ['Commits · 30 Days',num(gh['Commits 30 Days'])],
      ['Commits · 7 Days',num(gh['Commits 7 Days'])],
      ['Repositories · 30 Days',num(gh['Repositories 30 Days'])],
      ['Latest Repository',gh['Latest Repository']||'—'],
      ['Last Activity',gh['Last Activity']||'—']
    ] : [['Status','No GitHub record']];

    const links=[];
    if(lc?.['LeetCode Link']) links.push(`<a class="action-button secondary" href="${esc(lc['LeetCode Link'])}" target="_blank" rel="noopener">Open LeetCode ↗</a>`);
    if(gh?.['GitHub Link']) links.push(`<a class="action-button secondary" href="${esc(gh['GitHub Link'])}" target="_blank" rel="noopener">Open GitHub ↗</a>`);
    links.push(`<button class="view-problems-action-btn" id="homeViewSolvedProblemsBtn" type="button">⚡ View Solved Problems &amp; Code</button>`);
    links.push(`<button class="action-button primary" id="downloadStudentReportBtn" type="button">📥 Download Report (Excel)</button>`);

    els.content.innerHTML=`<div class="student-dashboard-grid">${card('💻 LeetCode',lcItems)}${card('🐙 GitHub',ghItems)}</div><div class="student-dashboard-links">${links.join('')}</div>`;

    document.getElementById('downloadStudentReportBtn')?.addEventListener('click', () => {
      try { downloadSingleStudentReport(item); } catch(e){ setMessage(e.message, true); }
    });

    document.getElementById('homeViewSolvedProblemsBtn')?.addEventListener('click', () => {
      openStudentSolvedProblems(reg, studentName, section, lcUser);
    });

    // Check Integrity Status asynchronously
    if (reg) {
      checkStudentIntegrity(reg).then(status => {
        const badgeEl = document.getElementById('homeStudentIntegrityBadge');
        if (badgeEl) {
          badgeEl.className = `integrity-badge ${status.cls}`;
          badgeEl.innerHTML = status.html;
        }
      }).catch(() => {});
    }

    els.modal.hidden=false; document.body.classList.add('modal-open');
  }

  function getEffectiveVerdict(sub) {
    if (!sub) return 'CLEAN';
    if (sub.plagiarism_verdict === 'FLAGGED') return 'FLAGGED';
    if (sub.plagiarism_verdict === 'SUSPICIOUS') return 'SUSPICIOUS';

    const keys = Number(sub.keystrokes_count || 0);
    const pastes = Number(sub.paste_count || 0);
    const ratio = Number(sub.keystroke_ratio || 0);
    const isPasted = Boolean(sub.is_pasted);
    const riskScore = Number(sub.plagiarism_risk_score || 0);
    const hasAi = Boolean(sub.has_prompt_comments || (sub.ai_comment_flags && sub.ai_comment_flags.length > 0));

    // If direct paste or 0% typing with low keystrokes -> FLAGGED
    if (isPasted && keys < 40) return 'FLAGGED';
    if (pastes > 0 && (keys < 30 || ratio <= 0.20)) return 'FLAGGED';
    if (ratio <= 0.15 && keys < 60) return 'FLAGGED';
    if (riskScore >= 70 || hasAi) return 'FLAGGED';
    if (riskScore >= 45 || (pastes > 0 && ratio <= 0.35)) return 'SUSPICIOUS';

    return sub.plagiarism_verdict || 'CLEAN';
  }

  async function checkStudentIntegrity(reg) {
    try {
      const client = supabaseClient();
      const { data } = await client.from('student_leetcode_submissions').select('*').eq('register_number', reg);
      if (!data || !data.length) {
        return { cls: 'unverified', html: '⚪ No Synced Code' };
      }
      const hasFlagged = data.some(d => {
        const v = getEffectiveVerdict(d);
        return v === 'FLAGGED' || v === 'SUSPICIOUS';
      });
      if (hasFlagged) {
        return { cls: 'flagged', html: '🔴 Flagged' };
      }
      return { cls: 'clean', html: `🟢 Clean (${data.length} verified)` };
    } catch {
      return { cls: 'unverified', html: '⚪ Not Synced' };
    }
  }

  async function openStudentSolvedProblems(reg, name, section, lcUser) {
    if (!reg) return;
    currentSolvedStudent = { reg, name, section, lcUser };
    if (els.solvedTitle) els.solvedTitle.textContent = `${name} · Solved Problems`;
    if (els.solvedSubtitle) els.solvedSubtitle.textContent = `Register: ${reg} · ${section} · @${lcUser || 'leetcode'}`;
    if (els.summaryTotalSynced) els.summaryTotalSynced.textContent = '...';
    if (els.summaryCleanCount) els.summaryCleanCount.textContent = '...';
    if (els.summaryFlaggedCount) els.summaryFlaggedCount.textContent = '...';
    if (els.summaryExtStatus) els.summaryExtStatus.innerHTML = '<span style="color:var(--muted)">Checking...</span>';
    if (els.solvedTableBody) {
      els.solvedTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted);">Loading synced submissions from Supabase...</td></tr>`;
    }
    if (els.solvedModal) {
      els.solvedModal.hidden = false;
      document.body.classList.add('modal-open');
    }

    try {
      const client = supabaseClient();
      const [subRes, extRes] = await Promise.all([
        client.from('student_leetcode_submissions').select('*').eq('register_number', reg).order('submitted_at', { ascending: false }),
        client.from('extension_installed_students').select('*').eq('register_number', reg).maybeSingle()
      ]);

      const subs = subRes.data || [];
      currentSolvedSubmissions = subs;

      if (extRes.data) {
        if (els.summaryExtStatus) els.summaryExtStatus.innerHTML = `<span style="color:#34d399">🟢 Extension Active</span>`;
      } else {
        if (els.summaryExtStatus) els.summaryExtStatus.innerHTML = `<span style="color:#94a3b8">⚪ Not Installed</span>`;
      }

      const cleanCount = subs.filter(s => {
        const v = getEffectiveVerdict(s);
        return v === 'CLEAN' || v === 'LOW_RISK';
      }).length;
      const flaggedCount = subs.filter(s => {
        const v = getEffectiveVerdict(s);
        return v === 'FLAGGED' || v === 'SUSPICIOUS';
      }).length;

      if (els.summaryTotalSynced) els.summaryTotalSynced.textContent = String(subs.length);
      if (els.summaryCleanCount) els.summaryCleanCount.textContent = String(cleanCount);
      if (els.summaryFlaggedCount) els.summaryFlaggedCount.textContent = String(flaggedCount);

      if (!subs.length) {
        if (els.solvedTableBody) {
          els.solvedTableBody.innerHTML = `
            <tr>
              <td colspan="8" style="text-align:center;padding:36px;color:var(--muted);">
                <div style="font-size:1.1rem;margin-bottom:6px;color:var(--text);">No synced solutions yet</div>
                <div>Make sure the student has installed the <strong>CodeMetrix Chrome Extension</strong> and solved problems on LeetCode.</div>
              </td>
            </tr>`;
        }
        return;
      }

      if (els.solvedTableBody) {
        els.solvedTableBody.innerHTML = subs.map((sub, idx) => {
          const timeSec = Number(sub.time_spent_seconds || 0);
          const mins = Math.floor(timeSec / 60);
          const secs = timeSec % 60;
          const timeStr = timeSec > 0 ? `${mins}m ${secs}s` : (sub.is_pasted ? '⚡ 0s (Paste)' : '—');
          const keys = Number(sub.keystrokes_count || 0);
          const pastes = Number(sub.paste_count || 0);
          const ratio = Math.round(Number(sub.keystroke_ratio || 0) * 100);
          const typingStr = `⌨️ ${keys} · 📋 ${pastes} (${ratio}% typed)`;
          const dateStr = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—';
          const verdict = getEffectiveVerdict(sub);
          const verdictClass = verdict === 'FLAGGED' ? 'flagged' : (verdict === 'SUSPICIOUS' ? 'suspicious' : 'clean');
          const verdictLabel = verdict === 'FLAGGED' ? '🔴 Flagged' : (verdict === 'SUSPICIOUS' ? '⚠️ Suspicious' : '🟢 Clean');

          return `
            <tr>
              <td><strong>#${idx + 1}</strong></td>
              <td>
                <button type="button" class="problem-link-btn" data-sub-index="${idx}">
                  ⚡ ${esc(sub.problem_title)} ↗
                </button>
              </td>
              <td><span class="diff-badge ${esc(sub.problem_difficulty || 'Medium')}">${esc(sub.problem_difficulty || 'Medium')}</span></td>
              <td><span style="font-weight:600;font-size:0.8rem;text-transform:uppercase;color:#93c5fd;">${esc(sub.language)}</span></td>
              <td><small style="color:var(--muted);">${esc(dateStr)}</small></td>
              <td><strong>${esc(timeStr)}</strong></td>
              <td><small>${esc(typingStr)}</small></td>
              <td><span class="integrity-badge ${verdictClass}">${esc(verdictLabel)}</span></td>
            </tr>
          `;
        }).join('');

        els.solvedTableBody.querySelectorAll('[data-sub-index]').forEach(btn => {
          btn.addEventListener('click', () => {
            const sub = currentSolvedSubmissions[Number(btn.dataset.subIndex)];
            if (sub) openSolutionCodeViewer(sub, name, reg);
          });
        });
      }
    } catch (err) {
      if (els.solvedTableBody) {
        els.solvedTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#fca5a5;">Failed to load solutions: ${esc(err.message)}</td></tr>`;
      }
    }
  }

  function closeSolvedProblemsModal() {
    if (els.solvedModal) els.solvedModal.hidden = true;
    if (!els.solutionModal || els.solutionModal.hidden) {
      document.body.classList.remove('modal-open');
    }
  }

  function openSolutionCodeViewer(submission, studentName, reg) {
    if (!submission) return;
    if (els.solutionProblemName) els.solutionProblemName.textContent = submission.problem_title || 'Solution';
    if (els.solutionDifficultyBadge) {
      const diff = submission.problem_difficulty || 'Medium';
      els.solutionDifficultyBadge.textContent = diff;
      els.solutionDifficultyBadge.className = `diff-badge ${diff}`;
    }
    if (els.solutionMetadata) {
      const dStr = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—';
      els.solutionMetadata.textContent = `${studentName} (${reg}) · Solved on ${dStr} · Runtime: ${submission.runtime_ms || 0}ms`;
    }

    const timeSec = Number(submission.time_spent_seconds || 0);
    const mins = Math.floor(timeSec / 60);
    const secs = timeSec % 60;
    if (els.telemetryActiveTime) els.telemetryActiveTime.textContent = timeSec > 0 ? `${mins}m ${secs}s` : '0s (Instant Paste)';
    if (els.telemetryKeystrokes) els.telemetryKeystrokes.textContent = `${submission.keystrokes_count || 0} keys`;
    const ratio = Math.round(Number(submission.keystroke_ratio || 0) * 100);
    if (els.telemetryPastes) els.telemetryPastes.textContent = `${submission.paste_count || 0} (Typed: ${ratio}%)`;
    if (els.telemetryTabSwitches) els.telemetryTabSwitches.textContent = `${submission.tab_switch_count || 0}`;
    if (els.telemetryRiskScore) els.telemetryRiskScore.textContent = `${submission.plagiarism_risk_score || 0} / 100`;

    const verdict = getEffectiveVerdict(submission);
    if (els.telemetryVerdict) {
      const verdictClass = verdict === 'FLAGGED' ? 'flagged' : (verdict === 'SUSPICIOUS' ? 'suspicious' : 'clean');
      const verdictLabel = verdict === 'FLAGGED' ? '🔴 Flagged' : (verdict === 'SUSPICIOUS' ? '⚠️ Suspicious' : '🟢 Clean');
      els.telemetryVerdict.innerHTML = `<span class="integrity-badge ${verdictClass}">${verdictLabel}</span>`;
    }

    if (submission.has_prompt_comments || (submission.ai_comment_flags && submission.ai_comment_flags.length > 0) || verdict === 'FLAGGED') {
      if (els.solutionAlertBanner) {
        els.solutionAlertBanner.hidden = false;
        const alerts = [];
        if (submission.has_prompt_comments || submission.ai_comment_flags?.length) {
          alerts.push(`AI Comment Patterns: ${(submission.ai_comment_flags || []).join(', ')}`);
        }
        if (submission.is_pasted) alerts.push('Full code paste detected with minimal keystrokes');
        if (els.solutionAlertText) els.solutionAlertText.textContent = alerts.join(' | ') || 'Flagged for plagiarism inspection.';
      }
    } else {
      if (els.solutionAlertBanner) els.solutionAlertBanner.hidden = true;
    }

    if (els.solutionCodeLang) els.solutionCodeLang.textContent = (submission.language || 'CODE').toUpperCase();
    if (els.solutionCodeContent) els.solutionCodeContent.textContent = submission.source_code || '// No source code recorded';

    if (els.solutionModal) {
      els.solutionModal.hidden = false;
      document.body.classList.add('modal-open');
    }
  }

  function closeSolutionCodeModal() {
    if (els.solutionModal) els.solutionModal.hidden = true;
  }

  function downloadCurrentStudentSolvedExcel() {
    if (!currentSolvedStudent || !currentSolvedSubmissions.length) {
      throw new Error('No synced submissions found to download.');
    }
    if (typeof XLSX === 'undefined') throw new Error('Excel library is unavailable. Please reload the page.');
    const rows = currentSolvedSubmissions.map((s, idx) => {
      const timeSec = Number(s.time_spent_seconds || 0);
      const mins = Math.floor(timeSec / 60);
      const secs = timeSec % 60;
      const ratio = Math.round(Number(s.keystroke_ratio || 0) * 100);
      return {
        '#': idx + 1,
        'Problem Title': s.problem_title || 'Untitled',
        'Difficulty': s.problem_difficulty || 'Medium',
        'Language': (s.language || 'code').toUpperCase(),
        'Solved At': s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—',
        'Active Time': timeSec > 0 ? `${mins}m ${secs}s` : (s.is_pasted ? '⚡ 0s (Paste)' : '—'),
        'Keystrokes': Number(s.keystrokes_count || 0),
        'Pastes': Number(s.paste_count || 0),
        'Typing Ratio': `${ratio}% typed`,
        'Integrity Verdict': s.plagiarism_verdict || 'CLEAN',
        'Risk Score (/100)': Number(s.plagiarism_risk_score || 0),
        'AI / Paste Notes': (s.ai_comment_flags || []).join('; ') || (s.is_pasted ? 'Full code paste' : 'Clean verified')
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Solved Problems");
    XLSX.writeFile(wb, `${currentSolvedStudent.reg}_LeetCode_Solutions_${reportISODate()}.xlsx`);
  }

  function downloadCurrentStudentSolvedPdf() {
    if (!currentSolvedStudent || !currentSolvedSubmissions.length) {
      throw new Error('No synced submissions found to download.');
    }
    const w = window.open('', '_blank');
    if (!w) throw new Error('Please allow pop-ups to generate the PDF portfolio.');
    const rows = currentSolvedSubmissions.map((s, idx) => {
      const timeSec = Number(s.time_spent_seconds || 0);
      const mins = Math.floor(timeSec / 60);
      const secs = timeSec % 60;
      const timeStr = timeSec > 0 ? `${mins}m ${secs}s` : (s.is_pasted ? '⚡ 0s (Paste)' : '—');
      const ratio = Math.round(Number(s.keystroke_ratio || 0) * 100);
      const verdict = s.plagiarism_verdict || 'CLEAN';
      const color = verdict === 'FLAGGED' ? '#dc2626' : (verdict === 'SUSPICIOUS' ? '#d97706' : '#16a34a');
      return `<tr>
        <td>${idx + 1}</td>
        <td><strong>${esc(s.problem_title)}</strong></td>
        <td>${esc(s.problem_difficulty || 'Medium')}</td>
        <td>${esc((s.language || 'code').toUpperCase())}</td>
        <td>${esc(s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—')}</td>
        <td>${esc(timeStr)}</td>
        <td>${s.keystrokes_count || 0} keys / ${s.paste_count || 0} pastes (${ratio}%)</td>
        <td style="color:${color};font-weight:bold;">${esc(verdict)}</td>
      </tr>`;
    }).join('');

    w.document.write(`<!doctype html><html><head><title>${esc(currentSolvedStudent.name)} - LeetCode Portfolio</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;line-height:1.4}
      .header{border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:20px}
      h1{margin:0 0 6px 0;font-size:22px;color:#1e3a8a}
      p{margin:0;color:#555;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}
      th,td{border:1px solid #ccc;padding:8px;text-align:left}
      th{background:#f1f5f9}
      @media print{button{display:none}}
    </style></head>
    <body>
      <div class="header">
        <h1>ECE CodeMetrix · Student Problem Portfolio</h1>
        <p><strong>${esc(currentSolvedStudent.name)}</strong> (${esc(currentSolvedStudent.reg)}) · Section: <strong>${esc(currentSolvedStudent.section)}</strong> · @${esc(currentSolvedStudent.lcUser || 'leetcode')}</p>
        <p>Total Synced Verified Solutions: <strong>${currentSolvedSubmissions.length}</strong> | Generated: <strong>${new Date().toLocaleString()}</strong></p>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Problem Title</th><th>Difficulty</th><th>Language</th><th>Date</th><th>Active Time</th><th>Keystroke Ratio</th><th>Integrity</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;">
        <button onclick="window.print()" style="padding:10px 20px;font-weight:bold;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;">🖨️ Print / Save as PDF</button>
      </div>
    </body></html>`);
    w.document.close();
  }

  function showSearchResults(results, query){
    if(results.length===1){ openDashboard(results[0]); return; }
    els.title.textContent=`Search Results (${results.length})`;
    els.subtitle.textContent=`Matches for “${query}”`;
    els.content.innerHTML=`<div class="universal-search-results">${results.map((item,i)=>{
      const lc=item.lc, gh=item.gh;
      return `<button type="button" class="universal-search-result" data-result-index="${i}"><span class="universal-search-result-main"><strong>${esc(getStudentName(item))}</strong><small>${esc(getRegister(item)||'No register number')} · ${esc(getSection(item))}</small></span><span class="universal-search-result-meta"><span>${lc?'💻 LeetCode':''}</span><span>${gh?'🐙 GitHub':''}</span></span></button>`;
    }).join('')}</div>`;
    els.content.querySelectorAll('[data-result-index]').forEach(btn=>btn.addEventListener('click',()=>openDashboard(results[Number(btn.dataset.resultIndex)])));
    els.modal.hidden=false; document.body.classList.add('modal-open');
  }

  function closeDashboard(){els.modal.hidden=true;document.body.classList.remove('modal-open');}
  async function ensureData(){ if(!state.leetcode.length && !state.github.length) await loadData(); }

  // ============================================================
  // ADMIN DATE REPORT
  // ============================================================
  const reportISODate = (d = new Date()) => {
    const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return x.toISOString().slice(0, 10);
  };
  const reportOffsetDate = (days) => { const d=new Date(); d.setDate(d.getDate()+days); return reportISODate(d); };

  function openHomeDateReport() {
    if (!isAdmin()) { openAdminLogin(); return; }
    const today=reportISODate();
    if (els.dateReportFrom && !els.dateReportFrom.value) els.dateReportFrom.value=reportOffsetDate(-7);
    if (els.dateReportTo && !els.dateReportTo.value) els.dateReportTo.value=today;
    if (els.dateReportFrom) els.dateReportFrom.max=today;
    if (els.dateReportTo) els.dateReportTo.max=today;
    if (els.dateReportScope) els.dateReportScope.textContent=els.dateReportSection?.selectedOptions?.[0]?.text||'ECE Overall';
    if (els.dateReportMessage) els.dateReportMessage.textContent='';
    if (els.dateReportModal) { els.dateReportModal.hidden=false; document.body.classList.add('modal-open'); }
  }
  function closeHomeDateReport() { if(els.dateReportModal) els.dateReportModal.hidden=true; document.body.classList.remove('modal-open'); }
  function csvEscape(v) { const t=String(v??''); return /[",\n\r]/.test(t) ? '"'+t.replace(/"/g,'""')+'"' : t; }
  function downloadTextFile(filename,content,type) { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

  async function prepareHomeDateReport() {
    if(!isAdmin()) throw new Error('Administrator access required.');
    const from=els.dateReportFrom?.value, to=els.dateReportTo?.value, section=els.dateReportSection?.value||'OVERALL', today=reportISODate();
    if(!from||!to) throw new Error('Please select both From and To dates.');
    if(from>to) throw new Error('From date cannot be after To date.');
    if(to>today) throw new Error('Future dates are not available.');
    const [history,daily]=await Promise.all([loadFile('History.csv'),loadFile('DailyActivity.csv')]);
    const live=state.leetcode.length?state.leetcode:await loadFile('LiveData.csv');
    const matches=r=>section==='OVERALL'||normalizeText(r.Section)===normalizeText(section);
    const students=live.filter(matches);
    const regSet = new Set(students.map(s => normalizeReg(s['Register Number'])).filter(Boolean));

    const dailyMap=new Map();
    const dailyRows=[];
    daily.filter(r=>r.Date>=from&&r.Date<=to).forEach(r=>{
      const reg=normalizeReg(r['Register Number']);
      if(!reg || !regSet.has(reg)) return;
      const x=dailyMap.get(reg)||{solved:0,days:new Set()};
      const solved=num(r['Solved That Day']);
      x.solved+=solved;
      if(solved>0) x.days.add(r.Date);
      dailyMap.set(reg,x);
      dailyRows.push({
        'Date': r.Date,
        'Register Number': reg,
        'Student Name': r['Student Name']||'',
        'Section': r.Section||'',
        'Solved That Day': solved,
        'Source': r.Source||'DAILY_ACTIVITY'
      });
    });

    const histMap=new Map();
    history.filter(r=>r.Date<=to).forEach(r=>{
      const reg=normalizeReg(r['Register Number']);
      if(!reg || !regSet.has(reg)) return;
      const old=histMap.get(reg);
      if(!old || `${r.Date}|${r['Updated At']||''}` > (old._key || '')){
        r._key=`${r.Date}|${r['Updated At']||''}`;
        histMap.set(reg,r);
      }
    });

    const rows=students.map(r=>{
      const reg=normalizeReg(r['Register Number']);
      const d=dailyMap.get(reg)||{solved:0,days:new Set()};
      const h=histMap.get(reg)||r;
      let solvedInPeriod = d.solved;
      if (solvedInPeriod === 0 && from === to) {
        solvedInPeriod = num(h['Solved Today']);
      }
      return {
        'Register Number':reg,
        'Student Name':r['Student Name']||h['Student Name']||'',
        'Section':r.Section||h.Section||'',
        'LeetCode Username':r['LeetCode Username']||h['LeetCode Username']||'',
        'Problems Solved in Period':solvedInPeriod,
        'Active Days':d.days.size || (solvedInPeriod > 0 ? 1 : 0),
        'Problems Solved (Cumulative)':num(h['Problems Solved']||r['Problems Solved']),
        'Medium (Cumulative)':num(h.Medium||r.Medium),
        'Hard (Cumulative)':num(h.Hard||r.Hard),
        'Total Submissions (Cumulative)':num(h['Total Submissions']||r['Total Submissions']),
        'Solved on Last Snapshot':num(h['Solved Today']||r['Solved Today']),
        'Last Problem':h['Last Problem']||r['Last Problem']||'',
        'Last Solved':h['Last Solved']||r['Last Solved']||'',
        'Status':h.Status||r.Status||''
      };
    }).sort((a,b)=>a['Register Number'].localeCompare(b['Register Number'],undefined,{numeric:true}));
    return {from,to,section,scope:section==='OVERALL'?'ECE Overall':section,students:rows,dailyRows};
  }

  async function downloadHomeDateReportCsv(){
    const r=await prepareHomeDateReport();
    const cols=Object.keys(r.students[0]||{'Register Number':'','Student Name':'','Section':'','Problems Solved in Period':0,'Active Days':0});
    const lines=[['ECE CodeMetrix Date Report'],['Scope',r.scope],['From',r.from],['To',r.to],[],cols,...r.students.map(x=>cols.map(c=>x[c]??''))];
    downloadTextFile(`ECE_LeetCode_Report_${r.from}_to_${r.to}.csv`,'\uFEFF'+lines.map(x=>x.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    closeHomeDateReport();
    setMessage('Date report downloaded successfully.');
  }

  async function downloadHomeDateReportExcel(){
    const r=await prepareHomeDateReport();
    if(typeof XLSX==='undefined')throw new Error('Excel library is unavailable. Please reload the page.');
    
    // Fetch integrity audit telemetry for this period
    let periodSubmissions = [];
    try {
      const client = supabaseClient();
      if (client) {
        let q = client.from('student_leetcode_submissions')
          .select('register_number, student_name, section, problem_title, plagiarism_verdict, is_pasted, keystrokes_count, paste_count, submitted_at');
        if (r.from) q = q.gte('submitted_at', `${r.from}T00:00:00.000Z`);
        if (r.to) q = q.lte('submitted_at', `${r.to}T23:59:59.999Z`);
        if (r.section && r.section !== 'OVERALL' && r.section !== 'ALL') q = q.eq('section', r.section);
        const { data } = await q;
        if (data) periodSubmissions = data;
      }
    } catch {}

    const subMap = new Map();
    periodSubmissions.forEach(sub => {
      const reg = normalizeReg(sub.register_number);
      if (!reg) return;
      const st = subMap.get(reg) || { clean: 0, flagged: 0, total: 0 };
      st.total++;
      const effVerdict = getEffectiveVerdict(sub);
      if (effVerdict === 'FLAGGED' || effVerdict === 'SUSPICIOUS') {
        st.flagged++;
      } else {
        st.clean++;
      }
      subMap.set(reg, st);
    });

    const auditRows = r.students.map(st => {
      const reg = normalizeReg(st['Register Number']);
      const subInfo = subMap.get(reg) || { clean: 0, flagged: 0, total: 0 };
      const solvedInPeriod = st['Problems Solved in Period'] || subInfo.total;
      const cleanCount = subInfo.clean;
      const flaggedCount = subInfo.flagged;
      const pasteRatio = (cleanCount + flaggedCount) > 0 ? Math.round((flaggedCount / (cleanCount + flaggedCount)) * 100) : (flaggedCount > 0 ? 100 : 0);

      let actionStatus = '⚪ No Synced Activity';
      if (solvedInPeriod > 0 || subInfo.total > 0) {
        if (flaggedCount > 0 && flaggedCount >= (cleanCount + flaggedCount)) {
          actionStatus = '🚨 [TAKE ACTION - 100% COPY-PASTED]';
        } else if (flaggedCount > 0) {
          actionStatus = '⚠️ [SUSPICIOUS - High Plagiarism]';
        } else {
          actionStatus = '🟢 [CLEAN - Verified Code]';
        }
      }

      return {
        'Register Number': reg,
        'Student Name': st['Student Name'],
        'Section': st['Section'],
        'LeetCode Username': st['LeetCode Username'],
        'Problems Solved in Period': solvedInPeriod,
        'Clean Solves (🟢)': cleanCount,
        'Flagged Solves (🔴)': flaggedCount,
        'Copy-Paste %': `${pasteRatio}%`,
        'Action Status': actionStatus
      };
    }).sort((a, b) => b['Flagged Solves (🔴)'] - a['Flagged Solves (🔴)'] || b['Problems Solved in Period'] - a['Problems Solved in Period']);

    const wb=XLSX.utils.book_new();
    const wsSummary=XLSX.utils.json_to_sheet(r.students);
    const wsAudit=XLSX.utils.json_to_sheet(auditRows);
    const wsDaily=XLSX.utils.json_to_sheet(r.dailyRows||[]);
    XLSX.utils.book_append_sheet(wb,wsSummary,"Summary");
    XLSX.utils.book_append_sheet(wb,wsAudit,"Copy-Paste & Integrity Audit");
    XLSX.utils.book_append_sheet(wb,wsDaily,"Daily Activity");
    XLSX.writeFile(wb,`ECE_LeetCode_Report_${r.from}_to_${r.to}.xlsx`);
    closeHomeDateReport();
    setMessage('Excel date report downloaded successfully with Integrity Audit tab.');
  }

  async function downloadHomeDateReportPdf(){
    const r=await prepareHomeDateReport();
    const w=window.open('','_blank');
    if(!w)throw new Error('Please allow pop-ups to generate the PDF report.');
    const cols=['Register Number','Student Name','Section','Problems Solved in Period','Active Days','Problems Solved (Cumulative)','Medium (Cumulative)','Hard (Cumulative)','Total Submissions (Cumulative)','Last Problem','Last Solved','Status'];
    const rows=r.students.map(x=>'<tr>'+cols.map(c=>'<td>'+esc(x[c])+'</td>').join('')+'</tr>').join('');
    w.document.write('<!doctype html><html><head><title>CodeMetrix Date Report</title><style>body{font-family:Arial;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #aaa;padding:5px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body><h1>ECE CodeMetrix Date Report</h1><p><b>'+esc(r.scope)+'</b> · '+esc(r.from)+' to '+esc(r.to)+'</p><table><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><p><button onclick="window.print()">Print / Save as PDF</button></p></body></html>');
    w.document.close();
    closeHomeDateReport();
    setMessage('PDF report opened. Choose Save as PDF.');
  }

  // ============================================================
  // ADMIN AUTHENTICATION
  // ============================================================
  function isAdmin() {
    return state.currentRole === 'admin';
  }

  function updateAdminUI() {
    document.querySelectorAll('.admin-only').forEach((element) => {
      element.hidden = !isAdmin();
    });

    if (els.adminLoginBtn) els.adminLoginBtn.hidden = isAdmin();
    if (els.sectionAdminLoginBtn) els.sectionAdminLoginBtn.hidden = isAdmin();
    if (els.adminSessionCard) els.adminSessionCard.hidden = !isAdmin();

    if (isAdmin()) {
      if (els.sessionEmail) els.sessionEmail.textContent = state.currentUser?.email || 'Administrator';
      if (els.accessLabel) els.accessLabel.textContent = 'Admin Access';
      if (els.accessNote) els.accessNote.textContent = 'Add Profile enabled';
    } else {
      if (els.accessLabel) els.accessLabel.textContent = 'Public Access';
      if (els.accessNote) els.accessNote.textContent = 'No login required';
    }
  }

  async function fetchAdminRole(user) {
    const client = supabaseClient();
    const { data, error } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error || data?.role !== 'admin') {
      throw new Error('This account is not authorized as an administrator.');
    }
    return 'admin';
  }

  function openAdminLogin() {
    if (els.adminLoginMsg) els.adminLoginMsg.textContent = '';
    if (els.adminLoginModal) {
      els.adminLoginModal.hidden = false;
      document.body.classList.add('modal-open');
    }
  }

  function closeAdminLoginModal() {
    if (els.adminLoginModal) {
      els.adminLoginModal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    if (!els.adminSignInBtn) return;

    els.adminSignInBtn.disabled = true;
    els.adminSignInBtn.textContent = 'Checking...';

    try {
      const client = supabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: els.adminEmail.value.trim(),
        password: els.adminPassword.value
      });

      if (error) throw error;

      const role = await fetchAdminRole(data.user);
      state.currentUser = data.user;
      state.currentRole = role;

      els.adminPassword.value = '';
      closeAdminLoginModal();
      updateAdminUI();
      setMessage('Logged in as Administrator.');
    } catch (error) {
      const client = supabaseClient();
      await client.auth.signOut().catch(() => {});
      state.currentUser = null;
      state.currentRole = null;
      updateAdminUI();

      if (els.adminLoginMsg) {
        els.adminLoginMsg.textContent = error.message;
        els.adminLoginMsg.className = 'form-message error';
      }
    } finally {
      els.adminSignInBtn.disabled = false;
      els.adminSignInBtn.textContent = 'Login';
    }
  }

  async function restoreAdminSession() {
    try {
      const client = supabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) {
        updateAdminUI();
        return;
      }
      state.currentRole = await fetchAdminRole(session.user);
      state.currentUser = session.user;
    } catch {
      state.currentUser = null;
      state.currentRole = null;
    }
    updateAdminUI();
  }

  async function adminLogout() {
    try {
      const client = supabaseClient();
      await client.auth.signOut();
    } catch {}
    state.currentUser = null;
    state.currentRole = null;
    updateAdminUI();
    setMessage('Logged out.');
  }

  // ============================================================
  // UNIFIED ADD PROFILE (LEETCODE + GITHUB)
  // ============================================================
  function openAddProfileModal() {
    if (!isAdmin()) {
      openAdminLogin();
      return;
    }
    if (els.unifiedForm) els.unifiedForm.reset();
    if (els.yearInput) els.yearInput.value = '2';
    if (els.profileMsg) els.profileMsg.textContent = '';
    if (els.unifiedModal) {
      els.unifiedModal.hidden = false;
      document.body.classList.add('modal-open');
    }
  }

  function closeAddProfileModal() {
    if (els.unifiedModal) {
      els.unifiedModal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  }

  async function triggerBackgroundSync() {
    try {
      const client = supabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session?.access_token) return;

      const endpoint = `${window.APP_CONFIG?.SUPABASE_URL || ''}/functions/v1/super-action`;
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'sync_all' })
      });
    } catch (err) {
      console.warn('Background sync trigger notice:', err);
    }
  }

  async function handleSaveUnifiedProfile(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const regNumber = els.regInput?.value.trim() || '';
    const studentName = els.nameInput?.value.trim() || '';
    const yearVal = Number(els.yearInput?.value) || 2;
    const sectionVal = els.sectionInput?.value || '';
    const leetcodeUser = els.leetcodeInput?.value.trim().replace(/\s+/g, '') || null;
    const githubUser = els.githubInput?.value.trim().replace(/\s+/g, '') || null;

    if (!regNumber || !studentName || !sectionVal) {
      if (els.profileMsg) {
        els.profileMsg.textContent = 'Please provide Register Number, Student Name, and Section.';
        els.profileMsg.className = 'form-message error';
      }
      return;
    }

    if (!leetcodeUser && !githubUser) {
      if (els.profileMsg) {
        els.profileMsg.textContent = 'Please provide at least one username (LeetCode or GitHub).';
        els.profileMsg.className = 'form-message error';
      }
      return;
    }

    els.saveProfileBtn.disabled = true;
    els.saveProfileBtn.textContent = 'Saving...';

    try {
      const client = supabaseClient();

      // Check if student with register_number already exists
      const { data: existing, error: lookupErr } = await client
        .from('students')
        .select('id, register_number, leetcode_username, github_username')
        .eq('register_number', regNumber)
        .maybeSingle();

      if (lookupErr) throw lookupErr;

      const payload = {
        register_number: regNumber,
        student_name: studentName,
        year: yearVal,
        section: sectionVal,
        leetcode_username: leetcodeUser || existing?.leetcode_username || null,
        github_username: githubUser || existing?.github_username || null
      };

      let result;
      if (existing?.id) {
        result = await client
          .from('students')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await client
          .from('students')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error && String(result.error.message || "").toLowerCase().includes("year")) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.year;
        if (existing?.id) {
          result = await client
            .from('students')
            .update(fallbackPayload)
            .eq('id', existing.id)
            .select()
            .single();
        } else {
          result = await client
            .from('students')
            .insert(fallbackPayload)
            .select()
            .single();
        }
      }

      if (result.error) throw result.error;

      if (els.profileMsg) {
        els.profileMsg.textContent = 'Student profile saved successfully!';
        els.profileMsg.className = 'form-message success';
      }

      let syncAction = 'sync_all';
      if (leetcodeUser && !githubUser) syncAction = 'trigger_leetcode_sync';
      if (githubUser && !leetcodeUser) syncAction = 'trigger_github_sync';

      setMessage(`Student ${studentName} saved. Starting automated tracker sync...`);
      triggerBackgroundSync(syncAction).catch(() => {});

      setTimeout(closeAddProfileModal, 900);
    } catch (err) {
      if (els.profileMsg) {
        els.profileMsg.textContent = err.message || 'Failed to save student.';
        els.profileMsg.className = 'form-message error';
      }
    } finally {
      els.saveProfileBtn.disabled = false;
      els.saveProfileBtn.textContent = 'Save Student';
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================
  els.leetTop?.addEventListener('click', async () => {
    try { await ensureData(); downloadTop50(state.leetcode, 'leetcode'); } catch (e) { setMessage(e.message, true); }
  });
  els.gitTop?.addEventListener('click', async () => {
    try { await ensureData(); downloadTop50(state.github, 'github'); } catch (e) { setMessage(e.message, true); }
  });
  els.facultyLeetCode?.addEventListener('click', async () => {
    try { await downloadAllFacultyLeetCodeReport(); } catch (e) { setMessage(e.message, true); }
  });

  els.form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const query=els.input.value.trim();
    if(!query){setMessage('Enter a register number, name, LeetCode username or GitHub username.',true);return;}
    try{
      await ensureData();
      const results=searchStudents(query);
      if(!results.length){setMessage(`No student found for “${query}”.`,true);return;}
      showSearchResults(results,query);
    }catch(err){setMessage(err.message,true);}
  });
  els.close?.addEventListener('click',closeDashboard);
  els.modal?.addEventListener('click',e=>{if(e.target.matches('[data-close-student-dashboard]'))closeDashboard();});
  
  // Solved Problems & Solution Code Modal Listeners
  els.closeSolvedModal?.addEventListener('click', closeSolvedProblemsModal);
  els.solvedModal?.addEventListener('click', e => { if (e.target.matches('[data-close-solved-problems]')) closeSolvedProblemsModal(); });
  els.closeSolutionModal?.addEventListener('click', closeSolutionCodeModal);
  els.solutionModal?.addEventListener('click', e => { if (e.target.matches('[data-close-solution-code]')) closeSolutionCodeModal(); });

  els.downloadSolvedHistoryExcelBtn?.addEventListener('click', () => {
    try { downloadCurrentStudentSolvedExcel(); } catch (e) { setMessage(e.message, true); }
  });
  els.downloadSolvedHistoryPdfBtn?.addEventListener('click', () => {
    try { downloadCurrentStudentSolvedPdf(); } catch (e) { setMessage(e.message, true); }
  });

  els.copySolutionCodeBtn?.addEventListener('click', async () => {
    const code = els.solutionCodeContent?.textContent || '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      const originalText = els.copySolutionCodeBtn.textContent;
      els.copySolutionCodeBtn.textContent = '✅ Copied!';
      setTimeout(() => { if (els.copySolutionCodeBtn) els.copySolutionCodeBtn.textContent = originalText; }, 2000);
    } catch {
      setMessage('Failed to copy code to clipboard', true);
    }
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!els.solutionModal?.hidden) closeSolutionCodeModal();
      else if(!els.solvedModal?.hidden) closeSolvedProblemsModal();
      else if(!els.modal?.hidden) closeDashboard();
      if(!els.adminLoginModal?.hidden) closeAdminLoginModal();
      if(!els.unifiedModal?.hidden) closeAddProfileModal();
      closeHomeDateReport();
    }
  });
  els.back?.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='leetcode.html';});

  // Date Report Events
  els.dateReportButton?.addEventListener('click', openHomeDateReport);
  els.closeDateReport?.addEventListener('click', closeHomeDateReport);
  els.cancelDateReport?.addEventListener('click', closeHomeDateReport);
  els.dateReportModal?.addEventListener('click', e => { if(e.target.matches('[data-close-home-date-report]')) closeHomeDateReport(); });
  els.dateReportSection?.addEventListener('change', () => { if(els.dateReportScope) els.dateReportScope.textContent=els.dateReportSection.selectedOptions?.[0]?.text||'ECE Overall'; });
  els.downloadDateReportCsv?.addEventListener('click', async()=>{try{await downloadHomeDateReportCsv();}catch(e){if(els.dateReportMessage){els.dateReportMessage.textContent=e.message;els.dateReportMessage.className='form-message error';}}});
  els.downloadDateReportExcel?.addEventListener('click', async()=>{try{await downloadHomeDateReportExcel();}catch(e){if(els.dateReportMessage){els.dateReportMessage.textContent=e.message;els.dateReportMessage.className='form-message error';}}});
  els.downloadDateReportPdf?.addEventListener('click', async()=>{try{await downloadHomeDateReportPdf();}catch(e){if(els.dateReportMessage){els.dateReportMessage.textContent=e.message;els.dateReportMessage.className='form-message error';}}});

  // Admin Events
  els.adminLoginBtn?.addEventListener('click', openAdminLogin);
  els.sectionAdminLoginBtn?.addEventListener('click', openAdminLogin);
  els.adminLogoutBtn?.addEventListener('click', adminLogout);
  els.adminLoginForm?.addEventListener('submit', handleAdminLogin);
  els.closeAdminLogin?.addEventListener('click', closeAdminLoginModal);
  els.adminLoginModal?.addEventListener('click', e => {
    if (e.target.matches('[data-close-home-admin-login]')) closeAdminLoginModal();
  });
  els.toggleAdminPassword?.addEventListener('click', () => {
    const showing = els.adminPassword.type === 'text';
    els.adminPassword.type = showing ? 'password' : 'text';
    els.toggleAdminPassword.textContent = showing ? 'Show' : 'Hide';
  });

  // Unified Profile Events
  els.addProfileBtn?.addEventListener('click', openAddProfileModal);
  els.sectionAddProfileBtn?.addEventListener('click', openAddProfileModal);
  els.closeUnifiedModal?.addEventListener('click', closeAddProfileModal);
  els.unifiedModal?.addEventListener('click', e => {
    if (e.target.matches('[data-close-unified-profile]')) closeAddProfileModal();
  });
  els.unifiedForm?.addEventListener('submit', handleSaveUnifiedProfile);

  // Initialize
  loadData().catch(()=>{});
  restoreAdminSession().catch(()=>{});
})();
