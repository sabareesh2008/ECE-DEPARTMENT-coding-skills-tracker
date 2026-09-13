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
    return `<article class="student-metric-card"><div class="student-metric-card-title">${title}</div>${items.map(([k,v])=>`<div class="student-metric-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</article>`;
  }

  function openDashboard(item){
    const s=item.lc||item.gh, gh=item.gh, lc=item.lc;
    els.title.textContent=getStudentName(item);
    els.subtitle.textContent=`Register Number: ${getRegister(item)||'—'} · ${getSection(item)}`;

    let suspiciousText = '🟢 0% Normal';
    if (lc) {
      const score = Math.round(Number(lc['Suspicious Score']) || 0);
      let label = lc['Suspicious Label'] || (score <= 20 ? 'Normal' : (score <= 40 ? 'Low' : (score <= 60 ? 'Suspicious' : (score <= 80 ? 'High' : 'Very High'))));
      let emoji = score <= 20 ? '🟢' : (score <= 40 ? '🟡' : (score <= 60 ? '🟠' : (score <= 80 ? '🔴' : '🚨')));
      suspiciousText = `${emoji} ${score}% ${label}`;
    }

    const lcItems=lc ? [
      ['Problems Solved',num(lc['Problems Solved'])],
      ['Suspicious Score', suspiciousText],
      ['Solved Today',num(lc['Solved Today'])],
      ['Last 7 Days',num(lc['Last 7 Days'])],
      ['7D Submissions',num(lc['Last 7 Days Submissions'])],
      ['Last 30 Days',num(lc['Last 30 Days'])],
      ['Total Submissions',num(lc['Total Submissions'])],
      ['Easy / Medium / Hard',`${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`],
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
    links.push(`<button class="action-button primary" id="downloadStudentReportBtn" type="button">📥 Download Report (Excel)</button>`);

    els.content.innerHTML=`<div class="student-dashboard-grid">${card('💻 LeetCode',lcItems)}${card('🐙 GitHub',ghItems)}</div><div class="student-dashboard-links">${links.join('')}</div>`;

    document.getElementById('downloadStudentReportBtn')?.addEventListener('click', () => {
      try { downloadSingleStudentReport(item); } catch(e){ setMessage(e.message, true); }
    });

    els.modal.hidden=false; document.body.classList.add('modal-open');
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
