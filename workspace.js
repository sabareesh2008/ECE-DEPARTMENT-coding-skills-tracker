(() => {
 const expected = document.title.toLowerCase().includes('student')?'student':document.title.toLowerCase().includes('faculty')?'faculty':'admin';
 const emailEl=document.getElementById('userEmail'); const message=document.getElementById('workspaceMessage');
 const role=sessionStorage.getItem('campus360_role'); const email=sessionStorage.getItem('campus360_email');
 // Client-side state is only a navigation convenience, not a security boundary. Supabase RLS must protect data.
 if(!role || role!==expected){location.replace('login.html?role='+encodeURIComponent(expected));return;}
 emailEl.textContent=email||'Signed in';
 document.getElementById('signOut').addEventListener('click',async()=>{
   try { const cfg=window.APP_CONFIG||{}; if(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY){const c=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);await c.auth.signOut();} } catch(e){console.warn('Supabase sign-out warning',e);}
   sessionStorage.removeItem('campus360_role');sessionStorage.removeItem('campus360_email');location.href='index.html';
 });
 if(message) message.textContent='Feature links open the existing CodeMetrix modules. Data access remains governed by your current Supabase policies.';
})();