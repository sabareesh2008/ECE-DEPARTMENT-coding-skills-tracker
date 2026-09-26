// ===================================================================
// STUDENT SUBMISSION PORTAL - JAVASCRIPT LOGIC
// ===================================================================

let currentTask = null;
let verifiedStudent = null;
let selectedFile = null;
let debounceTimer = null;
let isFormOpen = false;

// DOM Elements
const taskHeroSection = document.getElementById('taskHeroSection');
const submissionFormSection = document.getElementById('submissionFormSection');
const btnToggleForm = document.getElementById('btnToggleForm');
const btnCloseForm = document.getElementById('btnCloseForm');

const taskTitleEl = document.getElementById('taskTitle');
const taskDescEl = document.getElementById('taskDescription');
const taskDeadlineEl = document.getElementById('taskDeadlineBadge');
const taskDueDateEl = document.getElementById('taskDueDate');
const taskSubmissionCountEl = document.getElementById('taskSubmissionCount');

const regNoInput = document.getElementById('regNoInput');
const btnVerify = document.getElementById('btnVerifyRegNo');
const studentVerifiedCard = document.getElementById('studentVerifiedCard');
const studentNotFoundAlert = document.getElementById('studentNotFoundAlert');
const existingSubAlert = document.getElementById('existingSubAlert');
const existingSubText = document.getElementById('existingSubText');

const verifiedName = document.getElementById('verifiedName');
const verifiedDept = document.getElementById('verifiedDept');
const verifiedSection = document.getElementById('verifiedSection');
const verifiedEmail = document.getElementById('verifiedEmail');
const studentDeptSecBadge = document.getElementById('studentDeptSecBadge');

const dropzone = document.getElementById('uploadDropzone');
const fileInput = document.getElementById('screenshotFileInput');
const imagePreviewBox = document.getElementById('imagePreviewBox');
const imagePreviewImg = document.getElementById('imagePreviewImg');
const previewFilename = document.getElementById('previewFilename');
const previewFilesize = document.getElementById('previewFilesize');
const btnRemoveImage = document.getElementById('btnRemoveImage');

const submissionForm = document.getElementById('submissionForm');
const notesInput = document.getElementById('notesInput');
const btnSubmit = document.getElementById('btnSubmitProof');

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadActiveTask();
  attachEventListeners();
});

// 1. Fetch & Display Active Task
async function loadActiveTask() {
  try {
    currentTask = await DataService.getActiveTask();
    if (!currentTask) {
      taskTitleEl.textContent = 'No Active Task Currently Assigned';
      taskDescEl.textContent = 'Please check back later or contact your department coordinator.';
      taskDeadlineEl.textContent = 'No Deadline';
      taskDueDateEl.textContent = 'N/A';
      taskSubmissionCountEl.textContent = 'Submissions: 0';
      btnSubmit.disabled = true;
      return;
    }

    taskTitleEl.textContent = currentTask.title;
    taskDescEl.textContent = currentTask.description || 'Upload your proof screenshot as requested by your faculty coordinator.';
    
    if (currentTask.deadline) {
      const d = new Date(currentTask.deadline);
      const isPast = d < new Date();
      taskDeadlineEl.textContent = isPast ? '⚠️ Past Deadline' : '⏳ Due: ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      taskDueDateEl.textContent = 'Deadline: ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else {
      taskDeadlineEl.textContent = 'Open Submission';
      taskDueDateEl.textContent = 'No Expiry';
    }

    // Load submission count
    const submissions = await DataService.getSubmissionsForTask(currentTask.id);
    taskSubmissionCountEl.textContent = `Submissions: ${submissions.length} received`;
  } catch (err) {
    console.error('Failed to load task:', err);
    taskTitleEl.textContent = 'Error Loading Task';
  }
}

// 2. Attach Event Listeners
function attachEventListeners() {
  // Click on active task banner to toggle/open submission form
  if (taskHeroSection) {
    taskHeroSection.addEventListener('click', (e) => {
      // Don't toggle if user highlighted/selected text
      const selection = window.getSelection().toString();
      if (selection && selection.length > 0) return;
      toggleSubmissionForm();
    });

    taskHeroSection.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSubmissionForm();
      }
    });
  }

  // Click on explicit "Open Submission Form" button inside task banner
  if (btnToggleForm) {
    btnToggleForm.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSubmissionForm();
    });
  }

  // Close form button inside form card
  if (btnCloseForm) {
    btnCloseForm.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSubmissionForm();
    });
  }

  // Register number live input lookup
  regNoInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
    clearTimeout(debounceTimer);
    const val = e.target.value.trim();
    if (val.length >= 4) {
      debounceTimer = setTimeout(() => verifyStudent(val), 400);
    } else {
      resetStudentVerification();
    }
  });

  // Verify button click
  btnVerify.addEventListener('click', () => {
    const val = regNoInput.value.trim();
    if (val) verifyStudent(val);
  });

  // Dropzone file handling
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  btnRemoveImage.addEventListener('click', removeSelectedFile);

  // Form Submission
  submissionForm.addEventListener('submit', handleFormSubmit);
}

// 2b. Form Toggle / Collapsible Controls
function openSubmissionForm() {
  if (isFormOpen) return;
  isFormOpen = true;
  if (submissionFormSection) {
    submissionFormSection.classList.remove('form-collapsed');
    submissionFormSection.classList.add('form-expanded');
  }
  if (taskHeroSection) {
    taskHeroSection.classList.add('task-expanded');
    taskHeroSection.setAttribute('aria-expanded', 'true');
  }
  if (btnToggleForm) {
    btnToggleForm.innerHTML = '<span>Submission Form Active</span> &uarr;';
  }
  // Smoothly scroll down so user immediately sees the open form
  setTimeout(() => {
    if (submissionFormSection) {
      submissionFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (regNoInput) {
      regNoInput.focus();
    }
  }, 100);
}

function closeSubmissionForm() {
  if (!isFormOpen) return;
  isFormOpen = false;
  if (submissionFormSection) {
    submissionFormSection.classList.remove('form-expanded');
    submissionFormSection.classList.add('form-collapsed');
  }
  if (taskHeroSection) {
    taskHeroSection.classList.remove('task-expanded');
    taskHeroSection.setAttribute('aria-expanded', 'false');
  }
  if (btnToggleForm) {
    btnToggleForm.innerHTML = '<span>Open Submission Form</span> &darr;';
  }
  if (taskHeroSection) {
    taskHeroSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function toggleSubmissionForm() {
  if (isFormOpen) {
    closeSubmissionForm();
  } else {
    openSubmissionForm();
  }
}

// 3. Verify Student via Register Number
async function verifyStudent(regNo) {
  try {
    const student = await DataService.getStudentByRegNo(regNo);
    if (student) {
      verifiedStudent = student;
      studentNotFoundAlert.style.display = 'none';
      
      verifiedName.textContent = student.name;
      verifiedDept.textContent = student.department;
      verifiedSection.textContent = 'Section ' + student.section;
      verifiedEmail.textContent = student.email || 'N/A';
      studentDeptSecBadge.textContent = `${student.department} - Section ${student.section}`;
      studentVerifiedCard.style.display = 'block';

      // Check if this student already submitted
      if (currentTask) {
        const existing = await DataService.getExistingSubmission(currentTask.id, student.reg_no);
        if (existing) {
          const dateStr = new Date(existing.submitted_at).toLocaleString();
          existingSubText.innerHTML = `You submitted on <strong>${dateStr}</strong>. Submitting again will update your screenshot proof.`;
          existingSubAlert.style.display = 'flex';
        } else {
          existingSubAlert.style.display = 'none';
        }
      }

      checkCanSubmit();
    } else {
      resetStudentVerification();
      studentNotFoundAlert.style.display = 'flex';
      checkCanSubmit();
    }
  } catch (err) {
    console.error('Student lookup failed:', err);
  }
}

function resetStudentVerification() {
  verifiedStudent = null;
  studentVerifiedCard.style.display = 'none';
  studentNotFoundAlert.style.display = 'none';
  existingSubAlert.style.display = 'none';
  checkCanSubmit();
}

// 4. File Handling & Preview
function handleFileSelected(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('File size exceeds 10MB limit. Please upload a smaller image.');
    return;
  }

  selectedFile = file;
  previewFilename.textContent = file.name;
  previewFilesize.textContent = formatBytes(file.size);

  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreviewImg.src = e.target.result;
    imagePreviewBox.style.display = 'flex';
    dropzone.style.display = 'none';
    checkCanSubmit();
  };
  reader.readAsDataURL(file);
}

function removeSelectedFile() {
  selectedFile = null;
  fileInput.value = '';
  imagePreviewImg.src = '';
  imagePreviewBox.style.display = 'none';
  dropzone.style.display = 'block';
  checkCanSubmit();
}

function checkCanSubmit() {
  btnSubmit.disabled = !(verifiedStudent && selectedFile && currentTask);
}

// 5. Handle Form Submission
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!verifiedStudent || !selectedFile || !currentTask) {
    alert('Please verify your register number and attach a screenshot proof.');
    return;
  }

  const originalBtnText = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `
    <span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 8px;">⏳</span>
    Uploading Proof...
  `;

  try {
    const notes = notesInput.value.trim();
    await DataService.submitProof(
      currentTask.id,
      verifiedStudent.reg_no,
      selectedFile,
      notes,
      verifiedStudent
    );

    // Show Receipt Modal
    document.getElementById('receiptRegNo').textContent = verifiedStudent.reg_no;
    document.getElementById('receiptStudentName').textContent = verifiedStudent.name;
    document.getElementById('receiptSection').textContent = `${verifiedStudent.department} - Section ${verifiedStudent.section}`;
    document.getElementById('receiptTimestamp').textContent = new Date().toLocaleString();
    
    document.getElementById('successModal').classList.add('active');

    // Reset Form
    submissionForm.reset();
    resetStudentVerification();
    removeSelectedFile();
    await loadActiveTask();

    // Close submission form cleanly
    closeSubmissionForm();

  } catch (err) {
    console.error('Submission failed:', err);
    alert('Submission failed: ' + (err.message || 'Please check your connection and try again.'));
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalBtnText;
  }
}

// Modal Helpers
function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('active');
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Expose globals for inline onclick handlers and debugging
window.closeSuccessModal = closeSuccessModal;
window.openSubmissionForm = openSubmissionForm;
window.closeSubmissionForm = closeSubmissionForm;
window.toggleSubmissionForm = toggleSubmissionForm;
