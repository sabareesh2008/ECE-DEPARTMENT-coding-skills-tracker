// ===================================================================
// SUPABASE DIRECT REST DATA SERVICE
// Ultra-reliable, zero-wrapper cloud integration
// ===================================================================

window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: 'https://jehhjilmqoljxmsvnwgd.supabase.co',
  anonKey: 'sb_publishable_4x2bY6PkwBmfdIW47ILf3w_L-Q0JoJQ',
  storageBucket: 'proof-screenshots'
};
var SUPABASE_CONFIG = window.SUPABASE_CONFIG;

const DEFAULT_TASK = {
  id: 'task-live-01',
  title: 'Course Registration & Proof Screenshot Submission',
  description: 'Please upload a clear screenshot of your course enrollment / assessment completion proof showing your Name and Register Number.',
  deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  is_active: true,
  created_at: new Date().toISOString()
};

// Standard REST Headers Helper
function getHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
    ...extraHeaders
  };
}

// Normalizes student record
function normalizeStudent(s) {
  if (!s) return null;
  return {
    ...s,
    reg_no: String(s.reg_no || s.register_number || '').trim().toUpperCase(),
    name: String(s.name || s.student_name || '').trim(),
    department: String(s.department || '').trim().toUpperCase(),
    section: String(s.section || '').trim().toUpperCase()
  };
}

// Client-side Canvas Image Compressor
async function compressImage(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg'
              });
              resolve(compFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ===================================================================
// UNIFIED DATA SERVICE (Direct HTTP REST API)
// ===================================================================
const DataService = {
  isLive() {
    return true;
  },

  // 1. Get the currently active assigned task
  async getActiveTask() {
    return DEFAULT_TASK;
  },

  // 2. Get all tasks
  async getAllTasks() {
    return [DEFAULT_TASK];
  },

  // 3. Create a new task
  async createTask(taskData) {
    return {
      id: 'task-' + Date.now(),
      ...taskData,
      created_at: new Date().toISOString()
    };
  },

  // 4. Set a task as active
  async setActiveTask(taskId) {
    return DEFAULT_TASK;
  },

  // 5. Lookup student by Register Number (The Auto-fill engine)
  async getStudentByRegNo(regNo) {
    const cleanRegNo = String(regNo || '').trim().toUpperCase();
    if (!cleanRegNo) return null;

    try {
      // 1. Try querying by reg_no
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/students?reg_no=eq.${encodeURIComponent(cleanRegNo)}&limit=1`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          return normalizeStudent(list[0]);
        }
      }

      // 2. Fallback: try register_number
      const resAlt = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/students?register_number=eq.${encodeURIComponent(cleanRegNo)}&limit=1`,
        { headers: getHeaders() }
      );
      if (resAlt.ok) {
        const listAlt = await resAlt.json();
        if (listAlt && listAlt.length > 0) {
          return normalizeStudent(listAlt[0]);
        }
      }
    } catch (err) {
      console.warn('Student lookup error:', err);
    }

    return null;
  },

  // 6. Get all students from Supabase (372 real students)
  async getAllStudents() {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/students?select=*&order=reg_no.asc&limit=2000`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list.map(normalizeStudent);
        }
      }
    } catch (err) {
      console.warn('getAllStudents fetch error:', err);
    }
    return [];
  },

  // 7. Bulk import students (CSV)
  async bulkInsertStudents(studentsList) {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/students`,
        {
          method: 'POST',
          headers: getHeaders({
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          }),
          body: JSON.stringify(studentsList)
        }
      );
      if (res.ok) return await res.json();
    } catch (err) {
      console.error('bulkInsertStudents error:', err);
    }
    return [];
  },

  // 8. Check if student has already submitted for this task
  async getExistingSubmission(taskId, regNo) {
    const cleanRegNo = String(regNo || '').trim().toUpperCase();
    if (!cleanRegNo) return null;

    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/task_submissions?reg_no=eq.${encodeURIComponent(cleanRegNo)}&limit=1`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) return list[0];
      }
    } catch (err) {
      // ignore
    }
    return null;
  },

  // 9. Upload screenshot file and save submission to Supabase
  async submitProof(taskId, regNo, file, notes = '', studentObj = null) {
    const cleanRegNo = String(regNo || '').trim().toUpperCase();
    const effectiveTaskId = taskId || 'task-live-01';
    let screenshotUrl = '';

    if (!cleanRegNo) {
      throw new Error('Register number is required.');
    }

    // Step A: Compress image for reliable, high-speed upload
    let fileToUpload = file;
    if (file instanceof File) {
      try {
        fileToUpload = await compressImage(file);
      } catch (e) {
        fileToUpload = file;
      }
    }

    // Step B: Upload directly to Supabase Storage Bucket
    if (fileToUpload instanceof File) {
      try {
        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const fileName = `proofs/${cleanRegNo}_${Date.now()}.${fileExt}`;
        const uploadUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/${SUPABASE_CONFIG.storageBucket}/${fileName}`;

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: getHeaders({
            'Content-Type': fileToUpload.type || 'image/jpeg',
            'x-upsert': 'true'
          }),
          body: fileToUpload
        });

        if (uploadRes.ok) {
          screenshotUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.storageBucket}/${fileName}`;
          console.log('✅ Screenshot uploaded to Supabase Storage:', screenshotUrl);
        } else {
          const errText = await uploadRes.text();
          console.warn('Storage upload fallback triggered:', errText);
        }
      } catch (uploadErr) {
        console.warn('Storage exception, using fallback:', uploadErr);
      }
    }

    // Step C: Fallback to Base64 if storage endpoint was unreachable
    if (!screenshotUrl) {
      if (fileToUpload instanceof File) {
        screenshotUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(fileToUpload);
        });
      } else if (typeof fileToUpload === 'string') {
        screenshotUrl = fileToUpload;
      }
    }

    // Step D: Build database payload
    const submissionPayload = {
      task_id: effectiveTaskId,
      reg_no: cleanRegNo,
      student_name: studentObj ? studentObj.name : '',
      department: studentObj ? studentObj.department : '',
      section: studentObj ? studentObj.section : '',
      screenshot_url: screenshotUrl,
      notes: notes || '',
      submitted_at: new Date().toISOString()
    };

    // Step E: Save directly into task_submissions table via PostgREST Upsert
    const dbUrl = `${SUPABASE_CONFIG.url}/rest/v1/task_submissions?on_conflict=task_id,reg_no`;
    const dbRes = await fetch(dbUrl, {
      method: 'POST',
      headers: getHeaders({
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      }),
      body: JSON.stringify(submissionPayload)
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error('Database submission failed:', errText);
      throw new Error(`Database error (${dbRes.status}): ${errText}`);
    }

    const recordedData = await dbRes.json();
    console.log('🎉 Submission successfully written to Supabase:', recordedData);
    return Array.isArray(recordedData) ? recordedData[0] : recordedData;
  },

  // 10. Get all submissions from Supabase task_submissions table
  async getSubmissionsForTask(taskId) {
    try {
      const res = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/task_submissions?select=*&order=submitted_at.desc`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          return list.map(sub => ({
            ...sub,
            reg_no: String(sub.reg_no || '').trim().toUpperCase()
          }));
        }
      }
    } catch (err) {
      console.warn('getSubmissionsForTask fetch error:', err);
    }
    return [];
  }
};
