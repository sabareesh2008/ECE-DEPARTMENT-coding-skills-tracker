(() => {
  const allowedRoles = new Set(['student','faculty','admin']);
  const params = new URLSearchParams(location.search);
  const requested = (params.get('role') || 'student').toLowerCase();
  const role = allowedRoles.has(requested) ? requested : 'student';
  const $ = id => document.getElementById(id);
  const title=$('loginTitle'), icon=$('roleIcon'), form=$('loginForm'), message=$('message'), submit=$('submitBtn');
  const labels={
    student:{title:'Student sign in',icon:'♧'},
    faculty:{title:'Faculty / Class Advisor sign in',icon:'▤'},
    admin:{title:'Admin sign in',icon:'⬡'}
  };
  title.textContent=labels[role].title;
  icon.textContent=labels[role].icon;
  function say(t,ok=false){message.textContent=t;message.className='message'+(ok?' success':'');}
  form.addEventListener('submit', e => {
    e.preventDefault();
    const identifier=$('identifier').value.trim();
    if(!identifier){say('Enter your college registration number.');return;}
    if(identifier.includes('@')){say('Enter your college registration number, not your email address.');return;}
    if(role==='student'){
      // Prototype navigation: opens the student dashboard with preloaded roster data.
      sessionStorage.setItem('campus360_prototype_reg_no', identifier.toUpperCase());
      sessionStorage.setItem('campus360_role', 'student');
      location.href = 'student-dashboard.html?prototype=1&reg=' + encodeURIComponent(identifier.toUpperCase());
    } else if(role==='faculty'){
      // Faculty goes to the unified CodeMetrix dashboard (Advisor Cockpit).
      sessionStorage.setItem('campus360_role', 'faculty');
      sessionStorage.setItem('campus360_faculty_id', identifier.toUpperCase());
      location.href = 'codemetrix-dashboard.html';
    } else {
      // Admin goes to the Admin Command Center.
      sessionStorage.setItem('campus360_role', 'admin');
      location.href = 'admin.html';
    }
  });
})();
