(() => {
  const state = { leetcode: [], github: [] };
  const els = {
    leetTop: document.getElementById('top50LeetCodeButton'),
    gitTop: document.getElementById('top50GitHubButton'),
    back: document.getElementById('homeBackButton'),
    form: document.getElementById('studentSearchForm'),
    input: document.getElementById('studentSearchInput'),
    modal: document.getElementById('studentDashboardModal'),
    close: document.getElementById('closeStudentDashboard'),
    content: document.getElementById('studentDashboardContent'),
    title: document.getElementById('studentDashboardTitle'),
    subtitle: document.getElementById('studentDashboardSubtitle'),
    message: document.getElementById('homeActionMessage')
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = (v) => { const n = Number(String(v ?? '').replace(/,/g,'')); return Number.isFinite(n) ? n : 0; };
  const normalizeReg = (v) => String(v ?? '').trim().replace(/\.0$/, '');

  function parseCSV(text) {
    const rows=[]; let row=[], value='', quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(c==='"' && quoted && n==='"'){ value+='"'; i++; }
      else if(c==='"') quoted=!quoted;
      else if(c===',' && !quoted){ row.push(value); value=''; }
      else if((c==='\n'||c==='\r')&&!quoted){ if(c==='\r'&&n==='\n')i++; row.push(value); if(row.some(x=>x.trim()))rows.push(row); row=[]; value=''; }
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

  function findStudent(reg){
    const r=normalizeReg(reg);
    const lc=state.leetcode.find(s=>normalizeReg(s['Register Number'])===r);
    const gh=state.github.find(s=>normalizeReg(s['Register Number'])===r);
    if(!lc && !gh) return null;
    return {lc,gh};
  }

  function card(title, items){
    return `<article class="student-metric-card"><div class="student-metric-card-title">${title}</div>${items.map(([k,v])=>`<div class="student-metric-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</article>`;
  }

  function openDashboard(reg){
    const found=findStudent(reg);
    if(!found){ setMessage(`No student found for register number ${reg}.`,true); return; }
    const s=found.lc||found.gh, gh=found.gh, lc=found.lc;
    els.title.textContent=s['Student Name']||'Student Dashboard';
    els.subtitle.textContent=`Register Number: ${normalizeReg(s['Register Number'])} · ${s.Section||'Section not available'}`;
    const lcItems=lc ? [['Problems Solved',num(lc['Problems Solved'])],['Solved Today',num(lc['Solved Today'])],['Last 7 Days',num(lc['Last 7 Days'])],['Last 30 Days',num(lc['Last 30 Days'])],['Total Submissions',num(lc['Total Submissions'])],['Easy / Medium / Hard',`${num(lc.Easy)} / ${num(lc.Medium)} / ${num(lc.Hard)}`],['Last Problem',lc['Last Problem']||'—'],['Last Solved',lc['Last Solved']||'—']] : [['Status','No LeetCode record']];
    const ghItems=gh ? [['Deployments',num(gh['Detected Deployments'])],['Repositories',num(gh['Repositories Total'])],['Contributions · 30 Days',num(gh['Contributions 30 Days'])],['Commits · 30 Days',num(gh['Commits 30 Days'])],['Repositories · 30 Days',num(gh['Repositories 30 Days'])],['Latest Repository',gh['Latest Repository']||'—'],['Last Activity',gh['Last Activity']||'—']] : [['Status','No GitHub record']];
    const links=[];
    if(lc?.['LeetCode Link']) links.push(`<a class="action-button secondary" href="${esc(lc['LeetCode Link'])}" target="_blank" rel="noopener">Open LeetCode ↗</a>`);
    if(gh?.['GitHub Link']) links.push(`<a class="action-button secondary" href="${esc(gh['GitHub Link'])}" target="_blank" rel="noopener">Open GitHub ↗</a>`);
    els.content.innerHTML=`<div class="student-dashboard-grid">${card('💻 LeetCode',lcItems)}${card('🐙 GitHub',ghItems)}</div><div class="student-dashboard-links">${links.join('')}</div>`;
    els.modal.hidden=false; document.body.classList.add('modal-open');
  }
  function closeDashboard(){els.modal.hidden=true;document.body.classList.remove('modal-open');}

  async function ensureData(){ if(!state.leetcode.length||!state.github.length) await loadData(); }

  els.leetTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.leetcode,'leetcode');}catch(e){setMessage(e.message,true);}});
  els.gitTop?.addEventListener('click',async()=>{try{await ensureData();downloadTop50(state.github,'github');}catch(e){setMessage(e.message,true);}});
  els.form?.addEventListener('submit',async e=>{e.preventDefault();const reg=els.input.value.trim();if(!reg){setMessage('Enter a register number first.',true);return;}try{await ensureData();openDashboard(reg);}catch(err){setMessage(err.message,true);}});
  els.close?.addEventListener('click',closeDashboard);
  els.modal?.addEventListener('click',e=>{if(e.target.matches('[data-close-student-dashboard]'))closeDashboard();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!els.modal?.hidden)closeDashboard();});
  els.back?.addEventListener('click',()=>{if(history.length>1)history.back();else location.href='leetcode.html';});

  loadData().catch(()=>{});
})();
