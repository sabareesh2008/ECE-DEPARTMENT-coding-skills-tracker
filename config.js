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

  // Common Class Advisor Passcode for all Section Advisors
  ADVISOR_PASSWORD: "admin123",

  // Storage Bucket for Task Proof Screenshots
  STORAGE_BUCKET: "proof-screenshots",

  // Public Code Runner
  CODE_RUNNER_URL: "https://ece-department-coding-skills-tracker.onrender.com",

  // Application Version for Cache Busting
  VERSION: "8.5"
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

  // Get students filtered by section (e.g. 'A', 'B', etc., or null for ALL)
  getStudentsBySection(section) {
    const roster = this.getRoster();
    if (!section || section === 'ALL' || section === 'OVERALL') return roster;
    const cleanSec = section.replace(/^ECE\s*/i, '').trim().toUpperCase();
    return roster.filter(s => s.section === cleanSec);
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
  },

  // Fetch all assessment submissions from Supabase
  async fetchAllAssessmentSubmissions() {
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/submissions?select=*&order=submitted_at.desc`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[StudentService] All assessment submissions fetch error:', e.message);
      return [];
    }
  },

  // Fetch all task submissions from Supabase
  async fetchAllTaskSubmissions() {
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/task_submissions?select=*&order=submitted_at.desc`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[StudentService] All task submissions fetch error:', e.message);
      return [];
    }
  },

  // Fetch all tasks from Supabase and local cache
  async fetchTasks() {
    let cloudTasks = [];
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/tasks?select=*&order=created_at.desc`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) cloudTasks = data;
      }
    } catch (e) {
      console.warn('[StudentService] Tasks fetch error:', e.message);
    }
    const localTasks = JSON.parse(localStorage.getItem('codemetrix_custom_tasks') || '[]');
    const map = new Map();
    [...localTasks, ...cloudTasks].forEach(t => {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    });
    const result = Array.from(map.values());
    return result.length ? result : [{
      id: 'task-live-01',
      title: 'Course Registration & Proof Screenshot Submission',
      description: 'Please upload a clear screenshot of your course enrollment / assessment completion proof showing your Name and Register Number.',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      target_section: 'ALL',
      is_active: true,
      created_by: 'Academic Cell'
    }];
  },

  // Create a new task assigned to specific section or ALL
  async createSectionTask(taskData) {
    const payload = {
      id: 'task-' + Date.now(),
      title: taskData.title,
      description: taskData.description || '',
      deadline: taskData.deadline || null,
      target_section: taskData.target_section || 'ALL',
      created_by: taskData.created_by || 'Class Advisor',
      is_active: true,
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('[StudentService] Create task cloud fallback:', e.message);
    }

    const localTasks = JSON.parse(localStorage.getItem('codemetrix_custom_tasks') || '[]');
    localTasks.unshift(payload);
    localStorage.setItem('codemetrix_custom_tasks', JSON.stringify(localTasks));
    localStorage.setItem('portal_active_task', JSON.stringify(payload));
    return payload;
  },

  // Fetch all published assessments
  async fetchAssessments() {
    let cloudTests = [];
    try {
      const res = await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/assessments?select=*&order=created_at.desc`, {
        headers: {
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) cloudTests = data;
      }
    } catch (e) {
      console.warn('[StudentService] Assessments fetch cloud warning:', e.message);
    }

    const localTests = JSON.parse(localStorage.getItem('codemetrix_published_tests') || '[]');
    const map = new Map();
    [...localTests, ...cloudTests].forEach(t => {
      if (t && t.id && !map.has(t.id)) map.set(t.id, t);
    });
    const combined = Array.from(map.values());
    return combined.length ? combined : [{
      id: 'test_1',
      title: 'Technical Assessment 2026',
      duration: 45,
      is_published: true,
      target_section: 'ALL',
      created_by: 'Department Head'
    }];
  },

  // Publish / activate a new assessment (Overall or Section-specific)
  async publishAssessment(testData) {
    const payload = {
      id: testData.id || ('test_' + Date.now()),
      title: testData.title || 'Technical Assessment 2026',
      duration: Number(testData.duration || 45),
      target_section: testData.target_section || 'ALL',
      is_published: testData.is_published !== false,
      created_by: testData.created_by || 'Faculty Admin',
      created_at: new Date().toISOString()
    };

    try {
      await fetch(`${window.APP_CONFIG.PORTAL_SUPABASE_URL}/rest/v1/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.APP_CONFIG.PORTAL_SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('[StudentService] Remote assessment publish fallback to local storage');
    }

    const localTests = JSON.parse(localStorage.getItem('codemetrix_published_tests') || '[]');
    localTests.unshift(payload);
    localStorage.setItem('codemetrix_published_tests', JSON.stringify(localTests));

    // Synchronize assessment portal direct state
    localStorage.setItem('portal_test_published', 'true');
    localStorage.setItem('portal_test_title', payload.title);
    localStorage.setItem('portal_test_duration', String(payload.duration));
    localStorage.setItem('portal_active_test_id', payload.id);

    // Synchronize into portal_all_tests so app.js sees it immediately
    const portalAllTests = JSON.parse(localStorage.getItem('portal_all_tests') || '[]');
    const existingIndex = portalAllTests.findIndex(t => t.id === payload.id);
    const portalTestObj = {
      id: payload.id,
      title: payload.title,
      duration: payload.duration,
      status: 'published',
      target_section: payload.target_section,
      createdAt: payload.created_at,
      questions: typeof QUESTIONS_BANK !== 'undefined' ? QUESTIONS_BANK : [],
      submissions: []
    };
    if (existingIndex >= 0) {
      portalAllTests[existingIndex] = { ...portalAllTests[existingIndex], ...portalTestObj };
    } else {
      portalAllTests.unshift(portalTestObj);
    }
    localStorage.setItem('portal_all_tests', JSON.stringify(portalAllTests));

    return payload;
  }
};
