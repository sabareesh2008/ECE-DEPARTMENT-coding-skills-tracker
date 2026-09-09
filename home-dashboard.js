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
    profileMsg: document.getElementById('homeProfileFormMessage')
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
    const lcItems=lc ? [['Problems Solved',num(lc['Problems Solved'])],['Solved Today',num(lc['Solved Today'])],['Last 7 Days',num(lc['Last 7 Days'])],['7D Submissions',num(lc['Last 7 Days Submissions'])],['Last 30 Days',num(lc['Last 30 Days'])],['Total Submissions',num(lc['Total Submissions'])],['Easy / Medium / Hard',`${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`],['Current Streak',lc['Current Streak']||'—'],['Last Problem',lc['Last Problem']||'—'],['Last Solved',lc['Last Solved']||'—']] : [['Status','No LeetCode record']];
    const ghItems=gh ? [['Deployments',num(gh['Detected Deployments'])],['Repositories',num(gh['Repositories Total'])],['Contributions · 30 Days',num(gh['Contributions 30 Days'])],['Commits · 30 Days',num(gh['Commits 30 Days'])],['Commits · 7 Days',num(gh['Commits 7 Days'])],['Repositories · 30 Days',num(gh['Repositories 30 Days'])],['Latest Repository',gh['Latest Repository']||'—'],['Last Activity',gh['Last Activity']||'—']] : [['Status','No GitHub record']];
    const links=[];
    if(lc?.['LeetCode Link']) links.push(`<a class="action-button secondary" href="${esc(lc['LeetCode Link'])}" target="_blank" rel="noopener">Open LeetCode ↗</a>`);
    if(gh?.['GitHub Link']) links.push(`<a class="action-button secondary" href="${esc(gh['GitHub Link'])}" target="_blank" rel="noopener">Open GitHub ↗</a>`);
    els.content.innerHTML=`<div class="student-dashboard-grid">${card('💻 LeetCode',lcItems)}${card('🐙 GitHub',ghItems)}</div><div class="student-dashboard-links">${links.join('')}</div>`;
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
  els.leetTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.leetcode,'leetcode');}catch(e){setMessage(e.message,true);}});
  els.gitTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.github,'github');}catch(e){setMessage(e.message,true);}});
  els.facultyLeetCode?.addEventListener('click',async()=>{try{await downloadAllFacultyLeetCodeReport();}catch(e){setMessage(e.message,true);}});
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
