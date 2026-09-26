// ============================================================
// CODEMETRIX UNIFIED CONFIGURATION & DATA SERVICE
// Safe for static frontend deployment (GitHub Pages)
// ============================================================

window.APP_CONFIG = {
  // Coding Tracker Supabase Instance (LeetCode / GitHub / History)
  SUPABASE_URL: "https://bmbdkmtplemvlglqbgee.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_mhASvZVhm997qjKiVb15LQ_MiLPXsRl",

  // Technical Assessment & Task Submission Instance
  PORTAL_SUPABASE_URL: "https://jehhjilmqoljxmsvnwgd.supabase.co",
  PORTAL_SUPABASE_ANON_KEY: "sb_publishable_4x2bY6PkwBmfdIW47ILf3w_L-Q0JoJQ",

  // Storage Bucket for Task Proof Screenshots
  STORAGE_BUCKET: "proof-screenshots",

  // Public Code Runner
  CODE_RUNNER_URL: "https://ece-department-coding-skills-tracker.onrender.com",

  // Application Version for Cache Busting
  VERSION: "7.0"
};

// Backwards-compatible SUPABASE_CONFIG for Assessment & Task modules
window.SUPABASE_CONFIG = {
  url: window.APP_CONFIG.PORTAL_SUPABASE_URL,
  anonKey: window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
  storageBucket: window.APP_CONFIG.STORAGE_BUCKET
};

// ============================================================
// UNIFIED STUDENT SERVICE (Supports 372 ECE Students across all modules)
// ============================================================
window.StudentService = {
  // Normalizes student properties across reg_no / register_number, name / student_name
  normalize(s) {
    if (!s) return null;
    const reg = String(
      s.reg_no || s.register_number || s['Register Number'] || s.regNo || ''
    ).trim().toUpperCase();
    
    const name = String(
      s.name || s.student_name || s['Student Name'] || s.studentName || ''
    ).trim();

    let dept = String(s.department || s.Department || 'ECE').trim().toUpperCase();
    if (!dept) dept = 'ECE';

    let sec = String(s.section || s.Section || '').trim().toUpperCase();
    if (sec.startsWith('ECE ')) {
      sec = sec.replace('ECE ', '').trim();
    }

    return {
      ...s,
      reg_no: reg,
      register_number: reg,
      name: name,
      student_name: name,
      department: dept,
      section: sec || 'A',
      section_full: `ECE ${sec || 'A'}`
    };
  },

  // Get active student roster from registered list or Supabase
  getRoster() {
    if (typeof REGISTERED_STUDENTS !== 'undefined' && Array.isArray(REGISTERED_STUDENTS) && REGISTERED_STUDENTS.length > 0) {
      return REGISTERED_STUDENTS.map(s => this.normalize(s));
    }
    return [];
  },

  // Find student by register number or name in local roster
  findByQuery(query) {
    if (!query) return null;
    const q = String(query).trim().toUpperCase();
    const roster = this.getRoster();
    return roster.find(s => s.reg_no === q || s.name.toUpperCase() === q || s.reg_no.endsWith(q)) || null;
  },

  // Fetch student live assessment data from Supabase
  async fetchAssessmentResult(regNo) {
    if (!regNo) return null;
    const clean = encodeURIComponent(String(regNo).trim().toUpperCase());
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/submissions?reg_no=eq.${clean}&select=*&order=submitted_at.desc&limit=1`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.warn('[StudentService] Assessment fetch error:', e.message);
      return null;
    }
  },

  // Fetch student live task submission from Supabase
  async fetchTaskSubmission(regNo) {
    if (!regNo) return null;
    const clean = encodeURIComponent(String(regNo).trim().toUpperCase());
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/task_submissions?reg_no=eq.${clean}&select=*&order=submitted_at.desc&limit=1`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.warn('[StudentService] Task fetch error:', e.message);
      return null;
    }
  }
};
