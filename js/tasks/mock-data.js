// ===================================================================
// OFFLINE / LOCAL ENGINE (MOCK DATA REMOVED)
// Real student data is directly fetched from your Supabase students table
// ===================================================================

const DEFAULT_MOCK_TASK = {
  id: 'task-live-01',
  title: 'Course Registration & Proof Screenshot Submission',
  description: 'Please upload a clear screenshot of your course enrollment / assessment completion proof showing your Name and Register Number.',
  deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  is_active: true,
  created_at: new Date().toISOString()
};

// No mock students - real data is loaded from Supabase
const DEFAULT_MOCK_STUDENTS = [];
const DEFAULT_MOCK_SUBMISSIONS = [];

const MockDB = {
  init() {},

  getStudents() {
    return JSON.parse(localStorage.getItem('taskdash_students') || '[]');
  },

  saveStudents(students) {
    localStorage.setItem('taskdash_students', JSON.stringify(students));
  },

  getTasks() {
    return JSON.parse(localStorage.getItem('taskdash_tasks') || JSON.stringify([DEFAULT_MOCK_TASK]));
  },

  getActiveTask() {
    const tasks = this.getTasks();
    return tasks.find(t => t.is_active) || tasks[0] || DEFAULT_MOCK_TASK;
  },

  saveTasks(tasks) {
    localStorage.setItem('taskdash_tasks', JSON.stringify(tasks));
  },

  getSubmissions() {
    return JSON.parse(localStorage.getItem('taskdash_submissions') || '[]');
  },

  saveSubmissions(submissions) {
    localStorage.setItem('taskdash_submissions', JSON.stringify(submissions));
  },

  resetDefaults() {
    localStorage.removeItem('taskdash_students');
    localStorage.removeItem('taskdash_submissions');
  }
};
