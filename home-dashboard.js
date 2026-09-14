(() => {
  const state = { leetcode: [], github: [], merged: [], currentUser: null, currentRole: null, profileVerification: { leetcode: false, github: false } };
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
    profileStatus: document.getElementById('homeProfileStatus'),
    requestProfileBtn: document.getElementById('homeRequestProfileButton'),
    profileRequestModal: document.getElementById('homeProfileRequestModal'),
    closeProfileRequest: document.getElementById('closeHomeProfileRequest'),
    profileRequestForm: document.getElementById('homeProfileRequestForm'),
    requestReg: document.getElementById('requestRegNumber'),
    requestName: document.getElementById('requestStudentName'),
    requestYear: document.getElementById('requestYear'),
    requestDepartment: document.getElementById('requestDepartment'),
    requestSection: document.getElementById('requestSection'),
    requestLcUser: document.getElementById('requestLeetcodeUsername'),
    requestLcLink: document.getElementById('requestLeetcodeLink'),
    requestGhUser: document.getElementById('requestGithubUsername'),
    requestGhLink: document.getElementById('requestGithubLink'),
    verifyLc: document.getElementById('verifyLeetcodeButton'),
    verifyGh: document.getElementById('verifyGithubButton'),
    requestLcStatus: document.getElementById('requestLeetcodeStatus'),
    requestGhStatus: document.getElementById('requestGithubStatus'),
    requestMessage: document.getElementById('homeProfileRequestMessage'),
    submitRequest: document.getElementById('submitProfileRequestButton'),
    profileRequestsBtn: document.getElementById('homeProfileRequestsButton'),
    profileRequestsModal: document.getElementById('homeProfileRequestsModal'),
    closeProfileRequests: document.getElementById('closeHomeProfileRequests'),
    profileRequestsContent: document.getElementById('profileRequestsContent'),
    profileRequestCount: document.getElementById('profileRequestCount'),
    bulkAddRequestsBtn: document.getElementById('bulkAddProfileRequestsButton'),
    downloadProfileRequestsExcel: document.getElementById('downloadProfileRequestsExcel'),
    downloadProfileRequestsCsv: document.getElementById('downloadProfileRequestsCsv'),
    profileRequestsMessage: document.getElementById('homeProfileRequestsMessage'),

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
    downloadDateReportPdf: document.getElementById('homeDownloadDateReportPdf')
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
    return rows.slice(1).map(cells=>Object.fromEntries(headers.map((h,i)=>[h,(cells[i]??'').trim()])));
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
    // Keep the existing live tracker data untouched, but also load the error logs
    // so a student with a platform error can still be opened in the dashboard.
    const [leetcodeRows, githubRows, leetcodeErrors, githubErrors] = await Promise.all([
      loadFile('LiveData.csv'),
      loadFile('GitHubLiveData.csv'),
      loadFile('LeetCode_Errors.csv').catch(() => []),
      loadFile('GitHubErrors.csv').catch(() => [])
    ]);
    state.leetcode = leetcodeRows;
    state.github = githubRows;

    // Error rows are only added when the corresponding live row is missing.
    // This prevents duplicate students and does not alter existing tracker data.
    const lcRegs = new Set(state.leetcode.map(r => normalizeReg(r['Register Number'])).filter(Boolean));
    leetcodeErrors.forEach(r => {
      const reg = normalizeReg(r['Register Number']);
      if (reg && !lcRegs.has(reg)) {
        state.leetcode.push(r);
        lcRegs.add(reg);
      }
    });

    const ghRegs = new Set(state.github.map(r => normalizeReg(r['Register Number'])).filter(Boolean));
    githubErrors.forEach(r => {
      const reg = normalizeReg(r['Register Number']);
      if (reg && !ghRegs.has(reg)) {
        state.github.push({
          'Register Number': reg,
          'Student Name': r['Student Name'] || '',
          'GitHub Username': r['GitHub Username'] || '',
          'GitHub Link': r['GitHub Username'] ? `https://github.com/${r['GitHub Username']}` : '',
          Status: r['Error Message'] || r['Error Type'] || 'Error',
          'Updated At': r['Checked At'] || ''
        });
        ghRegs.add(reg);
      }
    });

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
        'LeetCode Suspicious Score': lc['Suspicious Score'] !== undefined ? `${lc['Suspicious Score']}%` : '0%',
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
      ['Suspicious Score', lc['Suspicious Score'] !== undefined ? `${lc['Suspicious Score']}% (${lc['Suspicious Label']||'Normal'})` : '0% (Normal)', 'Latest Repository', gh['Latest Repository'] || '—'],
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

  function profileRequestClient() { return supabaseClient(); }

  function setProfileRequestMessage(text, error = false) {
    if (els.requestMessage) {
      els.requestMessage.textContent = text;
      els.requestMessage.className = `form-message ${error ? 'error' : 'success'}`;
    }
  }

  function setVerification(kind, ok, text, verifying = false) {
    const target = kind === 'leetcode' ? els.requestLcStatus : els.requestGhStatus;
    state.profileVerification[kind] = !!ok;
    if (target) {
      target.textContent = text;
      target.className = `profile-check-status ${verifying ? 'verifying' : (ok ? 'valid' : (text === 'Not verified' || text === '⚪ Not verified' ? '' : 'invalid'))}`;
    }
    updateRequestSubmitState();
  }

  function updateRequestSubmitState() {
    if (els.submitRequest) {
      const canSubmit = state.profileVerification.leetcode && state.profileVerification.github;
      els.submitRequest.disabled = !canSubmit;
    }
  }

  function resetRequestVerification() {
    state.profileVerification = { leetcode: false, github: false };
    if (els.requestLcStatus) {
      els.requestLcStatus.textContent = '⚪ Not verified';
      els.requestLcStatus.className = 'profile-check-status';
    }
    if (els.requestGhStatus) {
      els.requestGhStatus.textContent = '⚪ Not verified';
      els.requestGhStatus.className = 'profile-check-status';
    }
    updateRequestSubmitState();
  }

  function openProfileRequestModal() {
    if (els.profileRequestForm) els.profileRequestForm.reset();
    if (els.requestYear) els.requestYear.value = '2';
    if (els.requestDepartment) els.requestDepartment.value = 'ECE';
    if (els.requestMessage) {
      els.requestMessage.textContent = '';
      els.requestMessage.className = 'form-message';
    }
    resetRequestVerification();
    const modal = els.profileRequestModal || document.getElementById('homeProfileRequestModal');
    if (modal) {
      modal.hidden = false;
      modal.removeAttribute('hidden');
      modal.style.display = 'grid';
      document.body.classList.add('modal-open');
    }
  }

  function closeProfileRequestModal() {
    const modal = els.profileRequestModal || document.getElementById('homeProfileRequestModal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
  }

  window.openProfileRequestModal = openProfileRequestModal;
  window.closeProfileRequestModal = closeProfileRequestModal;

  async function invokeProfileRequest(body) {
    const endpoint = `${window.APP_CONFIG?.SUPABASE_URL || ''}/functions/v1/profile-request`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': window.APP_CONFIG?.SUPABASE_ANON_KEY || ''
    };
    const client = profileRequestClient();
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  }

  function normalizeProfileUrl(value, host) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') return null;
      if (u.hostname.toLowerCase() !== host) return null;
      return u;
    } catch {
      return null;
    }
  }

  function profileFormValues() {
    return {
      register_number: els.requestReg?.value.trim() || '',
      student_name: els.requestName?.value.trim() || '',
      year: Number(els.requestYear?.value) || 2,
      department: els.requestDepartment?.value.trim() || 'ECE',
      section: els.requestSection?.value || '',
      leetcode_username: els.requestLcUser?.value.trim().replace(/\s+/g, '') || '',
      leetcode_link: els.requestLcLink?.value.trim() || '',
      github_username: els.requestGhUser?.value.trim().replace(/\s+/g, '') || '',
      github_link: els.requestGhLink?.value.trim() || ''
    };
  }

  async function verifyRequestedProfile(kind) {
    const v = profileFormValues();
    const user = kind === 'leetcode' ? v.leetcode_username : v.github_username;
    const link = kind === 'leetcode' ? v.leetcode_link : v.github_link;
    const host = kind === 'leetcode' ? 'leetcode.com' : 'github.com';
    const url = normalizeProfileUrl(link, host);

    if (!user || !url) {
      setVerification(kind, false, '✕ Invalid profile');
      setProfileRequestMessage(`Please enter a valid ${kind === 'leetcode' ? 'LeetCode' : 'GitHub'} username and https://${host}/ profile link.`, true);
      return;
    }

    const button = kind === 'leetcode' ? els.verifyLc : els.verifyGh;
    if (button) {
      button.disabled = true;
      button.textContent = 'Verifying...';
    }
    setVerification(kind, false, '⏳ Verifying...', true);

    try {
      const result = await invokeProfileRequest({
        action: 'validate',
        platform: kind,
        username: user,
        profile_link: link
      });
      setVerification(kind, true, '✓ Verified');
      setProfileRequestMessage(`${kind === 'leetcode' ? 'LeetCode' : 'GitHub'} profile verified successfully.`);
      if (kind === 'leetcode' && result.canonical_link && els.requestLcLink) {
        els.requestLcLink.value = result.canonical_link;
      }
      if (kind === 'github' && result.canonical_link && els.requestGhLink) {
        els.requestGhLink.value = result.canonical_link;
      }
    } catch (err) {
      setVerification(kind, false, '✕ Invalid profile');
      setProfileRequestMessage(err.message || `Could not verify ${kind} profile.`, true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = kind === 'leetcode' ? 'Verify LeetCode' : 'Verify GitHub';
      }
    }
  }

  async function submitProfileRequest(event) {
    event.preventDefault();
    const v = profileFormValues();
    if (!v.register_number || !v.student_name || !v.section || !v.leetcode_username || !v.github_username) {
      setProfileRequestMessage('Please complete all required fields.', true);
      return;
    }
    if (!(state.profileVerification.leetcode && state.profileVerification.github)) {
      setProfileRequestMessage('Please verify both LeetCode and GitHub profiles before submitting.', true);
      return;
    }
    if (els.submitRequest) {
      els.submitRequest.disabled = true;
      els.submitRequest.textContent = 'Submitting...';
    }
    try {
      const result = await invokeProfileRequest({ action: 'submit', request: v });
      setProfileRequestMessage(result.message || 'Profile request submitted successfully.');
      setVerification('leetcode', true, '✓ Verified');
      setVerification('github', true, '✓ Verified');
      setMessage('Profile request submitted successfully. It will be reviewed and approved by faculty.');
      setTimeout(closeProfileRequestModal, 1200);
    } catch (err) {
      setProfileRequestMessage(err.message || 'Could not submit profile request.', true);
      updateRequestSubmitState();
    } finally {
      if (els.submitRequest) {
        els.submitRequest.textContent = 'Submit Request';
      }
    }
  }

  async function checkPublicProfileStatus(query) {
    if (!els.profileStatus) return;
    const q = String(query || '').trim();
    if (!q) {
      els.profileStatus.innerHTML = '';
      return;
    }

    const localMatches = searchStudents(q);
    if (localMatches.length > 0) {
      const first = localMatches[0];
      const name = getStudentName(first);
      const reg = getRegister(first);
      const sec = getSection(first);
      els.profileStatus.innerHTML = `
        <div class="profile-status-badge badge-active">
          <span class="status-dot active"></span>
          <div class="profile-status-text">
            <strong>Profile Active</strong>
            <small>${esc(reg || '')} · ${esc(name)} (${esc(sec)})</small>
          </div>
        </div>
      `;
      return;
    }

    els.profileStatus.innerHTML = `
      <div class="profile-status-badge badge-pending">
        <span class="status-dot pending"></span>
        <div class="profile-status-text">
          <span>Checking profile status…</span>
        </div>
      </div>
    `;

    try {
      const result = await invokeProfileRequest({ action: 'status', query: q });
      const status = String(result.status || 'NOT_FOUND').toUpperCase();

      if (status === 'ACTIVE') {
        els.profileStatus.innerHTML = `
          <div class="profile-status-badge badge-active">
            <span class="status-dot active"></span>
            <div class="profile-status-text">
              <strong>Profile Active</strong>
              <small>${esc(result.register_number || '')} · ${esc(result.student_name || '')}</small>
            </div>
          </div>
        `;
      } else if (status === 'PENDING') {
        els.profileStatus.innerHTML = `
          <div class="profile-status-badge badge-pending">
            <span class="status-dot pending"></span>
            <div class="profile-status-text">
              <strong>Request Pending</strong>
              <small>Profile request is waiting for administrator approval.</small>
            </div>
          </div>
        `;
      } else if (status === 'REJECTED') {
        els.profileStatus.innerHTML = `
          <div class="profile-status-badge badge-rejected">
            <span class="status-dot rejected"></span>
            <div class="profile-status-text">
              <strong>Request Rejected</strong>
              <small>Please submit a new request with verified details.</small>
            </div>
          </div>
        `;
      } else {
        els.profileStatus.innerHTML = `
          <div class="profile-status-badge badge-not-found">
            <span class="status-dot not-found"></span>
            <div class="profile-status-text">
              <strong>Profile Not Found</strong>
              <small>Use "Request Profile" to onboard your details.</small>
            </div>
          </div>
        `;
      }
    } catch (err) {
      els.profileStatus.innerHTML = `
        <div class="profile-status-badge badge-unavailable">
          <span class="status-dot unavailable"></span>
          <div class="profile-status-text">
            <strong>Status Unavailable</strong>
            <small>Unable to retrieve status at this moment.</small>
          </div>
        </div>
      `;
    }
  }

  function openProfileRequestsModal() {
    if (!isAdmin()) {
      openAdminLogin();
      return;
    }
    const modal = els.profileRequestsModal || document.getElementById('homeProfileRequestsModal');
    if (modal) {
      modal.hidden = false;
      modal.removeAttribute('hidden');
      modal.style.display = 'grid';
      document.body.classList.add('modal-open');
    }
    loadProfileRequests().catch(err => setProfileRequestsMessage(err.message, true));
  }

  function closeProfileRequestsModal() {
    const modal = els.profileRequestsModal || document.getElementById('homeProfileRequestsModal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('hidden', '');
      modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
  }

  window.openProfileRequestsModal = openProfileRequestsModal;
  window.closeProfileRequestsModal = closeProfileRequestsModal;

  function setProfileRequestsMessage(text, error = false) {
    if (els.profileRequestsMessage) {
      els.profileRequestsMessage.textContent = text;
      els.profileRequestsMessage.className = `form-message ${error ? 'error' : 'success'}`;
    }
  }

  function renderProfileRequests(rows) {
    const list = rows || [];
    if (els.profileRequestCount) els.profileRequestCount.textContent = `${list.length} pending`;
    if (!els.profileRequestsContent) return;

    if (!list.length) {
      els.profileRequestsContent.innerHTML = '<div class="profile-requests-empty">No pending profile requests at this time.</div>';
      return;
    }

    els.profileRequestsContent.innerHTML = `
      <table class="profile-requests-table">
        <thead>
          <tr>
            <th>Register Number</th>
            <th>Name</th>
            <th>Year</th>
            <th>Section</th>
            <th>LeetCode</th>
            <th>GitHub</th>
            <th>Requested At</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr>
              <td><strong>${esc(r.register_number)}</strong></td>
              <td>${esc(r.student_name)}</td>
              <td>Year ${esc(r.year)}</td>
              <td>${esc(r.section)}</td>
              <td>
                <a class="table-link" href="${esc(r.leetcode_link)}" target="_blank" rel="noopener" title="${esc(r.leetcode_link)}">
                  💻 ${esc(r.leetcode_username)}
                </a>
              </td>
              <td>
                <a class="table-link" href="${esc(r.github_link)}" target="_blank" rel="noopener" title="${esc(r.github_link)}">
                  🐙 ${esc(r.github_username)}
                </a>
              </td>
              <td>${esc(r.requested_at ? new Date(r.requested_at).toLocaleString() : '—')}</td>
              <td><span class="profile-request-status-pill">🟡 Pending</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function loadProfileRequests() {
    if (!isAdmin()) return;
    const client = supabaseClient();
    const { data, error } = await client
      .from('profile_requests')
      .select('*')
      .eq('status', 'Pending')
      .order('requested_at', { ascending: true });

    if (error) throw error;
    renderProfileRequests(data || []);
  }

  async function bulkAddProfileRequests() {
    if (!isAdmin()) return;
    const button = els.bulkAddRequestsBtn;
    if (button) {
      button.disabled = true;
      button.textContent = 'Processing...';
    }
    setProfileRequestsMessage('');
    try {
      const client = supabaseClient();
      const { data: rows, error } = await client
        .from('profile_requests')
        .select('*')
        .eq('status', 'Pending')
        .order('requested_at', { ascending: true });

      if (error) throw error;
      if (!rows?.length) {
        setProfileRequestsMessage('There are no pending requests to process.');
        return;
      }

      const confirmed = window.confirm(`Process ${rows.length} pending profile request(s)?\n\n• Existing register numbers will be UPDATED\n• New register numbers will be ADDED\n• Historical metrics and activity will remain intact`);
      if (!confirmed) return;

      let added = 0;
      let updated = 0;
      let failed = 0;
      const failures = [];

      for (const r of rows) {
        try {
          const regClean = String(r.register_number || '').trim();
          if (!regClean) throw new Error('Missing register number.');

          const { data: existing, error: findErr } = await client
            .from('students')
            .select('id, register_number')
            .ilike('register_number', regClean)
            .maybeSingle();

          if (findErr) throw findErr;

          const payload = {
            register_number: regClean,
            student_name: String(r.student_name || '').trim(),
            year: Number(r.year) || 2,
            department: String(r.department || 'ECE').trim(),
            section: String(r.section || '').trim(),
            leetcode_username: String(r.leetcode_username || '').trim(),
            github_username: String(r.github_username || '').trim(),
            leetcode_link: String(r.leetcode_link || '').trim(),
            github_link: String(r.github_link || '').trim()
          };

          let result;
          if (existing?.id) {
            result = await client.from('students').update(payload).eq('id', existing.id);
          } else {
            result = await client.from('students').insert(payload);
          }

          if (result.error) throw result.error;

          const { error: markErr } = await client
            .from('profile_requests')
            .update({
              status: 'Approved',
              processed_at: new Date().toISOString(),
              processed_by: state.currentUser?.id || null,
              admin_note: existing?.id ? 'Existing profile updated' : 'New profile added'
            })
            .eq('id', r.id);

          if (markErr) throw markErr;
          existing?.id ? updated++ : added++;
        } catch (err) {
          failed++;
          failures.push(`${r.register_number}: ${err.message || 'Error'}`);
        }
      }

      await loadProfileRequests();
      const summaryMsg = `Bulk processing complete — Added: ${added} | Updated: ${updated} | Failed: ${failed}`;
      setProfileRequestsMessage(failed ? `${summaryMsg}\nFailures: ${failures.slice(0, 3).join(' | ')}` : summaryMsg, failed > 0 && added === 0 && updated === 0);

      if (added || updated) {
        setMessage('Profile requests processed successfully. Tracker directory updated.');
        loadData().catch(() => {});
      }
    } catch (err) {
      setProfileRequestsMessage(err.message || 'Bulk processing failed.', true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Bulk Add / Update All';
      }
    }
  }

  async function downloadProfileRequestsExcel() {
    if (!isAdmin()) throw new Error('Admin authentication required.');
    if (typeof XLSX === 'undefined') throw new Error('Excel export library is unavailable. Please check your network and reload.');
    const client = supabaseClient();
    const { data: rows, error } = await client
      .from('profile_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    if (!rows || !rows.length) throw new Error('No profile requests found to export.');

    const sheetData = rows.map((r, i) => ({
      '#': i + 1,
      'Register Number': r.register_number || '',
      'Student Name': r.student_name || '',
      'Year': r.year ? `Year ${r.year}` : '',
      'Department': r.department || 'ECE',
      'Section': r.section || '',
      'LeetCode Username': r.leetcode_username || '',
      'LeetCode Link': r.leetcode_link || '',
      'GitHub Username': r.github_username || '',
      'GitHub Link': r.github_link || '',
      'Status': r.status || 'Pending',
      'Requested At': r.requested_at ? new Date(r.requested_at).toLocaleString() : '',
      'Processed At': r.processed_at ? new Date(r.processed_at).toLocaleString() : '',
      'Admin Note': r.admin_note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws['!cols'] = Object.keys(sheetData[0] || {}).map(k => ({ wch: Math.min(36, Math.max(12, k.length + 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Profile Requests');
    XLSX.writeFile(wb, `CodeMetrix_Profile_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setProfileRequestsMessage(`Downloaded ${rows.length} profile request(s) to Excel.`);
  }

  async function downloadProfileRequestsCsv() {
    if (!isAdmin()) throw new Error('Admin authentication required.');
    const client = supabaseClient();
    const { data: rows, error } = await client
      .from('profile_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    if (!rows || !rows.length) throw new Error('No profile requests found to export.');

    const headers = ['#', 'Register Number', 'Student Name', 'Year', 'Department', 'Section', 'LeetCode Username', 'LeetCode Link', 'GitHub Username', 'GitHub Link', 'Status', 'Requested At', 'Processed At', 'Admin Note'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        `"${String(r.register_number || '').replace(/"/g, '""')}"`,
        `"${String(r.student_name || '').replace(/"/g, '""')}"`,
        `"${r.year ? `Year ${r.year}` : ''}"`,
        `"${String(r.department || 'ECE').replace(/"/g, '""')}"`,
        `"${String(r.section || '').replace(/"/g, '""')}"`,
        `"${String(r.leetcode_username || '').replace(/"/g, '""')}"`,
        `"${String(r.leetcode_link || '').replace(/"/g, '""')}"`,
        `"${String(r.github_username || '').replace(/"/g, '""')}"`,
        `"${String(r.github_link || '').replace(/"/g, '""')}"`,
        `"${String(r.status || 'Pending').replace(/"/g, '""')}"`,
        `"${r.requested_at ? new Date(r.requested_at).toLocaleString().replace(/"/g, '""') : ''}"`,
        `"${r.processed_at ? new Date(r.processed_at).toLocaleString().replace(/"/g, '""') : ''}"`,
        `"${String(r.admin_note || '').replace(/"/g, '""')}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CodeMetrix_Profile_Requests_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setProfileRequestsMessage(`Downloaded ${rows.length} profile request(s) to CSV.`);
  }

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

  function getStatusInfo(record, platformName) {
    const username = record ? String(record[`${platformName} Username`] || '').trim() : '';
    const raw = record ? String(record.Status || '').trim() : '';
    const lower = raw.toLowerCase();

    if (!record || !username || username === '—' || username === '-' || lower.includes('not added') || lower === 'not added') {
      return {
        text: 'Not Added',
        badgeClass: 'status-error',
        badgeHtml: `<span class="status status-error" style="color:#f87171!important; background:rgba(239,68,68,0.22)!important; border:1px solid rgba(248,113,113,0.5)!important;">🔴 Not Added</span>`
      };
    }

    if (lower.includes('not found') || lower.includes('could not resolve') || lower.includes('worker error') || lower.includes('stale') || lower.includes('error') || lower.includes('invalid') || lower.includes('fail')) {
      let label = 'Error';
      if (lower.includes('not found')) label = 'User Not Found';
      else if (lower.includes('worker error') || lower.includes('could not resolve')) label = 'Worker Error';
      else if (lower.includes('stale')) label = 'Stale / Error';
      return {
        text: raw,
        badgeClass: 'status-error',
        badgeHtml: `<span class="status status-error" style="color:#f87171!important; background:rgba(239,68,68,0.22)!important; border:1px solid rgba(248,113,113,0.5)!important;" title="${esc(raw)}">🔴 ${esc(label)}</span>`
      };
    }

    if (lower === 'pending' || lower.includes('verifying') || lower.includes('queued')) {
      return {
        text: 'Pending',
        badgeClass: 'status-pending',
        badgeHtml: `<span class="status status-pending" style="color:#facc15!important; background:rgba(234,179,8,0.2)!important; border:1px solid rgba(250,204,21,0.5)!important;">🟡 Pending</span>`
      };
    }

    if (lower === 'success' || lower === 'active') {
      return {
        text: 'Success',
        badgeClass: 'status-success',
        badgeHtml: `<span class="status status-success" style="color:#4ade80!important; background:rgba(34,197,94,0.2)!important; border:1px solid rgba(74,222,128,0.5)!important;">🟢 Success</span>`
      };
    }

    return {
      text: raw || 'Error',
      badgeClass: 'status-error',
      badgeHtml: `<span class="status status-error" style="color:#f87171!important; background:rgba(239,68,68,0.22)!important; border:1px solid rgba(248,113,113,0.5)!important;" title="${esc(raw)}">🔴 ${esc(raw || 'Error')}</span>`
    };
  }

  function card(title, items, badgeHtml = ''){
    return `
      <article class="student-metric-card">
        <div class="student-metric-card-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span>${title}</span>
          ${badgeHtml || ''}
        </div>
        ${items.map(([k, v, isHtml]) => `
          <div class="student-metric-row">
            <span>${esc(k)}</span>
            <strong>${isHtml ? v : esc(v)}</strong>
          </div>
        `).join('')}
      </article>
    `;
  }

  function openDashboard(item){
    const gh = item.gh, lc = item.lc;
    const studentName = getStudentName(item);
    const regNum = getRegister(item) || '—';
    const sectionName = getSection(item);

    const lcStat = getStatusInfo(lc, 'LeetCode');
    const ghStat = getStatusInfo(gh, 'GitHub');

    els.subtitle.innerHTML = `Register Number: ${esc(regNum)} · ${esc(sectionName)} &nbsp;&nbsp;|&nbsp;&nbsp; 💻 ${lcStat.badgeHtml} &nbsp;&nbsp; 🐙 ${ghStat.badgeHtml}`;

    let suspiciousText = '🟢 0% Normal';
    if (lc) {
      const score = Math.round(Number(lc['Suspicious Score']) || 0);
      let label = lc['Suspicious Label'] || (score <= 20 ? 'Normal' : (score <= 40 ? 'Low' : (score <= 60 ? 'Suspicious' : (score <= 80 ? 'High' : 'Very High'))));
      let emoji = score <= 20 ? '🟢' : (score <= 40 ? '🟡' : (score <= 60 ? '🟠' : (score <= 80 ? '🔴' : '🚨')));
      suspiciousText = `${emoji} ${score}% ${label}`;
    }

    const lcItems = lc ? [
      ['Status', lcStat.badgeHtml, true],
      ['Problems Solved', num(lc['Problems Solved'])],
      ['Suspicious Score', suspiciousText],
      ['Solved Today', num(lc['Solved Today'])],
      ['Last 7 Days', num(lc['Last 7 Days'])],
      ['7D Submissions', num(lc['Last 7 Days Submissions'])],
      ['Last 30 Days', num(lc['Last 30 Days'])],
      ['Total Submissions', num(lc['Total Submissions'])],
      ['Easy / Medium / Hard', `${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`],
      ['Current Streak', lc['Current Streak'] || '—'],
      ['Last Problem', lc['Last Problem'] || '—'],
      ['Last Solved', lc['Last Solved'] || '—']
    ] : [['Status', lcStat.badgeHtml, true]];

    const ghItems = gh ? [
      ['Status', ghStat.badgeHtml, true],
      ['Deployments', num(gh['Detected Deployments'])],
      ['Repositories', num(gh['Repositories Total'])],
      ['Contributions · 30 Days', num(gh['Contributions 30 Days'])],
      ['Commits · 30 Days', num(gh['Commits 30 Days'])],
      ['Commits · 7 Days', num(gh['Commits 7 Days'])],
      ['Repositories · 30 Days', num(gh['Repositories 30 Days'])],
      ['Latest Repository', gh['Latest Repository'] || '—'],
      ['Last Activity', gh['Last Activity'] || '—']
    ] : [['Status', ghStat.badgeHtml, true]];

    const links = [];
    if (lc?.['LeetCode Link']) links.push(`<a class="action-button secondary" href="${esc(lc['LeetCode Link'])}" target="_blank" rel="noopener">Open LeetCode ↗</a>`);
    if (gh?.['GitHub Link']) links.push(`<a class="action-button secondary" href="${esc(gh['GitHub Link'])}" target="_blank" rel="noopener">Open GitHub ↗</a>`);
    links.push(`<button class="action-button primary" id="downloadStudentReportBtn" type="button">📥 Download Report (Excel)</button>`);

    els.content.innerHTML = `<div class="student-dashboard-grid">${card('💻 LeetCode', lcItems, lcStat.badgeHtml)}${card('🐙 GitHub', ghItems, ghStat.badgeHtml)}</div><div class="student-dashboard-links">${links.join('')}</div>`;

    document.getElementById('downloadStudentReportBtn')?.addEventListener('click', () => {
      try { downloadSingleStudentReport(item); } catch(e){ setMessage(e.message, true); }
    });

    els.modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function showSearchResults(results, query){
    if(results.length===1){ openDashboard(results[0]); return; }
    els.title.textContent=`Search Results (${results.length})`;
    els.subtitle.textContent=`Matches for “${query}”`;
    els.content.innerHTML=`<div class="universal-search-results">${results.map((item,i)=>{
      const lcStat = getStatusInfo(item.lc, 'LeetCode');
      const ghStat = getStatusInfo(item.gh, 'GitHub');
      return `<button type="button" class="universal-search-result" data-result-index="${i}">
        <span class="universal-search-result-main">
          <strong>${esc(getStudentName(item))}</strong>
          <small>${esc(getRegister(item)||'No register number')} · ${esc(getSection(item))}</small>
        </span>
        <span class="universal-search-result-meta" style="display:flex; gap:6px; align-items:center;">
          <span>💻 ${lcStat.badgeHtml}</span>
          <span>🐙 ${ghStat.badgeHtml}</span>
        </span>
      </button>`;
    }).join('')}</div>`;
    els.content.querySelectorAll('[data-result-index]').forEach(btn=>btn.addEventListener('click',()=>openDashboard(results[Number(btn.dataset.resultIndex)])));
    els.modal.hidden=false;
    document.body.classList.add('modal-open');
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
    const dailyMap=new Map();
    daily.filter(r=>r.Date>=from&&r.Date<=to&&matches(r)).forEach(r=>{const reg=normalizeReg(r['Register Number']);if(!reg)return;const x=dailyMap.get(reg)||{solved:0,days:new Set()};x.solved+=num(r['Solved That Day']);if(num(r['Solved That Day'])>0)x.days.add(r.Date);dailyMap.set(reg,x);});
    const histMap=new Map();
    history.filter(r=>r.Date>=from&&r.Date<=to&&matches(r)).forEach(r=>{const reg=normalizeReg(r['Register Number']);if(!reg)return;const old=histMap.get(reg);if(!old || `${r.Date}|${r['Updated At']||''}` > (old._key || '')){r._key=`${r.Date}|${r['Updated At']||''}`;histMap.set(reg,r);}});
    const rows=students.map(r=>{const reg=normalizeReg(r['Register Number']),d=dailyMap.get(reg)||{solved:0,days:new Set()},h=histMap.get(reg)||r;return {'Register Number':reg,'Student Name':r['Student Name']||h['Student Name']||'','Section':r.Section||h.Section||'','Problems Solved in Period':d.solved,'Active Days':d.days.size,'Problems Solved (Cumulative)':num(h['Problems Solved']||r['Problems Solved']),'Medium (Cumulative)':num(h.Medium||r.Medium),'Hard (Cumulative)':num(h.Hard||r.Hard),'Total Submissions (Cumulative)':num(h['Total Submissions']||r['Total Submissions']),'Last Problem':h['Last Problem']||r['Last Problem']||'','Last Solved':h['Last Solved']||r['Last Solved']||'','Status':h.Status||r.Status||''};}).sort((a,b)=>a['Register Number'].localeCompare(b['Register Number'],undefined,{numeric:true}));
    return {from,to,section,scope:section==='OVERALL'?'ECE Overall':section,students:rows};
  }
  async function downloadHomeDateReportCsv(){const r=await prepareHomeDateReport();const cols=Object.keys(r.students[0]||{'Register Number':'','Student Name':'','Section':'','Problems Solved in Period':0,'Active Days':0});const lines=[['ECE CodeMetrix Date Report'],['Scope',r.scope],['From',r.from],['To',r.to],[],cols,...r.students.map(x=>cols.map(c=>x[c]??''))];downloadTextFile(`CodeMetrix_Date_Report_${r.from}_to_${r.to}.csv`,'\uFEFF'+lines.map(x=>x.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');closeHomeDateReport();setMessage('Date report downloaded successfully.');}
  async function downloadHomeDateReportExcel(){const r=await prepareHomeDateReport();if(typeof XLSX==='undefined')throw new Error('Excel library is unavailable. Please reload the page.');const ws=XLSX.utils.json_to_sheet(r.students);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,(r.section==='OVERALL'?'Overall':r.section).slice(0,31));XLSX.writeFile(wb,`CodeMetrix_Date_Report_${r.from}_to_${r.to}.xlsx`);closeHomeDateReport();setMessage('Excel date report downloaded successfully.');}
  async function downloadHomeDateReportPdf(){const r=await prepareHomeDateReport();const w=window.open('','_blank');if(!w)throw new Error('Please allow pop-ups to generate the PDF report.');const cols=['Register Number','Student Name','Section','Problems Solved in Period','Active Days','Problems Solved (Cumulative)','Medium (Cumulative)','Hard (Cumulative)','Total Submissions (Cumulative)','Last Problem','Last Solved','Status'];const rows=r.students.map(x=>'<tr>'+cols.map(c=>'<td>'+esc(x[c])+'</td>').join('')+'</tr>').join('');w.document.write('<!doctype html><html><head><title>CodeMetrix Date Report</title><style>body{font-family:Arial;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #aaa;padding:5px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body><h1>ECE CodeMetrix Date Report</h1><p><b>'+esc(r.scope)+'</b> · '+esc(r.from)+' to '+esc(r.to)+'</p><table><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><p><button onclick="window.print()">Print / Save as PDF</button></p></body></html>');w.document.close();closeHomeDateReport();setMessage('PDF report opened. Choose Save as PDF.');}

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
    if (els.profileRequestsBtn) els.profileRequestsBtn.hidden = !isAdmin();

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

  async function triggerBackgroundSync(action = 'sync_all') {
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
        body: JSON.stringify({ action })
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
  const attachDownload = (id, fn) => {
    document.getElementById(id)?.addEventListener('click', async () => {
      try { await ensureData(); fn(); } catch(e) { setMessage(e.message, true); }
    });
  };

  els.leetTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.leetcode,'leetcode');}catch(e){setMessage(e.message,true);}});
  els.gitTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.github,'github');}catch(e){setMessage(e.message,true);}});
  els.facultyLeetCode?.addEventListener('click',async()=>{try{await downloadAllFacultyLeetCodeReport();}catch(e){setMessage(e.message,true);}});

  attachDownload('bannerTop50LeetCode', () => downloadTop50(state.leetcode, 'leetcode'));
  attachDownload('bannerTop50GitHub', () => downloadTop50(state.github, 'github'));
  attachDownload('bannerAllFacultyLeetCode', () => downloadAllFacultyLeetCodeReport());
  attachDownload('bannerAllStudentsReport', () => downloadAllStudentsMerged());

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
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!els.modal?.hidden) closeDashboard();
      if(!els.adminLoginModal?.hidden) closeAdminLoginModal();
      if(!els.unifiedModal?.hidden) closeAddProfileModal();
      if(!els.profileRequestModal?.hidden) closeProfileRequestModal();
      if(!els.profileRequestsModal?.hidden) closeProfileRequestsModal();
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

  // Student profile request events
  els.requestProfileBtn?.addEventListener('click', openProfileRequestModal);
  els.closeProfileRequest?.addEventListener('click', closeProfileRequestModal);
  els.profileRequestModal?.addEventListener('click', e => { if(e.target.matches('[data-close-profile-request]')) closeProfileRequestModal(); });
  els.verifyLc?.addEventListener('click', () => verifyRequestedProfile('leetcode'));
  els.verifyGh?.addEventListener('click', () => verifyRequestedProfile('github'));
  ['requestReg','requestName','requestYear','requestDepartment','requestSection','requestLcUser','requestLcLink','requestGhUser','requestGhLink'].forEach(k => els[k]?.addEventListener('input', () => { if(k.includes('Lc')) setVerification('leetcode',false,'Not verified'); if(k.includes('Gh')) setVerification('github',false,'Not verified'); }));
  els.profileRequestForm?.addEventListener('submit', submitProfileRequest);
  els.profileRequestsBtn?.addEventListener('click', openProfileRequestsModal);
  els.closeProfileRequests?.addEventListener('click', closeProfileRequestsModal);
  els.bulkAddRequestsBtn?.addEventListener('click', bulkAddProfileRequests);
  els.downloadProfileRequestsExcel?.addEventListener('click', async () => {
    try { await downloadProfileRequestsExcel(); } catch (e) { setProfileRequestsMessage(e.message, true); }
  });
  els.downloadProfileRequestsCsv?.addEventListener('click', async () => {
    try { await downloadProfileRequestsCsv(); } catch (e) { setProfileRequestsMessage(e.message, true); }
  });

  // Initialize
  loadData().catch(()=>{});
  restoreAdminSession().catch(()=>{});

  // URL Hash Trigger (e.g. #request-profile)
  function checkUrlHash() {
    const h = (typeof window !== 'undefined' ? window.location?.hash || '' : '').toLowerCase();
    if (h === '#request-profile' || h === '#request' || h === '#profile-request' || h === '#requestprofile') {
      setTimeout(() => openProfileRequestModal(), 50);
    }
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', checkUrlHash);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', checkUrlHash);
    } else {
      checkUrlHash();
    }
  }
})();
