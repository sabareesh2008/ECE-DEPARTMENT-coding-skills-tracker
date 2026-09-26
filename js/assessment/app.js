// Technical Assessment Portal - Main Application Logic (Student & Admin)
(function () {
  'use strict';

  // Sample CSV Template content embedded for offline/online reliability
  const SAMPLE_CSV_TEMPLATE = `Type,Category,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation
MCQ,Data Structures,Which data structure follows the Last-In-First-Out (LIFO) principle?,Queue,Stack,Linked List,Binary Tree,B,A Stack operates on LIFO order.
MCQ,Digital Electronics,How many select lines are needed for an 8-to-1 Multiplexer (MUX)?,2,3,4,8,B,An 8-to-1 MUX requires log2(8) = 3 select lines.
MCQ,Computer Networks,What standard port number is used for HTTPS web traffic?,80,21,443,8080,C,Port 443 is universally designated for HTTPS traffic.
FIB,Computer Networks,The protocol used to map an IP address to a physical MAC address is _______.,,,,ARP,Address Resolution Protocol (ARP) resolves IPv4 to MAC addresses.
FIB,Electronics,In a PN junction diode under reverse breakdown the current increases _______.,,,,sharply,Under reverse breakdown the zener or avalanche effect causes a sharp current increase.
FIB,Operating Systems,A binary semaphore initialized to 1 is commonly known as a _______.,,,,Mutex,A binary semaphore functions as a mutual exclusion lock (Mutex).
`;

  // Initial State Management
  const savedQuestions = JSON.parse(localStorage.getItem('portal_assigned_questions') || '[]');
  const initialQuestions = (savedQuestions && savedQuestions.length > 0)
    ? savedQuestions
    : (typeof QUESTIONS_BANK !== 'undefined' && Array.isArray(QUESTIONS_BANK) ? [...QUESTIONS_BANK] : []);
  const savedLastResult = JSON.parse(sessionStorage.getItem('portal_last_result') || localStorage.getItem('portal_last_result') || 'null');

  // Multi-Test Archive & Management Setup
  let savedAllTests = JSON.parse(localStorage.getItem('portal_all_tests') || '[]');
  let activeTestId = localStorage.getItem('portal_active_test_id') || 'test_1';
  const initialSubmissions = JSON.parse(localStorage.getItem('portal_submissions') || '[]');

  if (!Array.isArray(savedAllTests) || savedAllTests.length === 0) {
    savedAllTests = [{
      id: 'test_1',
      title: localStorage.getItem('portal_test_title') || 'Technical Assessment 2026',
      duration: parseInt(localStorage.getItem('portal_test_duration') || '45', 10),
      status: localStorage.getItem('portal_test_published') === 'true' ? 'published' : 'unpublished',
      createdAt: new Date().toISOString(),
      questions: initialQuestions,
      submissions: initialSubmissions
    }];
    localStorage.setItem('portal_all_tests', JSON.stringify(savedAllTests));
    localStorage.setItem('portal_active_test_id', 'test_1');
  }

  const initialActiveTest = savedAllTests.find(t => t.id === activeTestId) || savedAllTests[0];

  const state = {
    student: null,
    isAdminLoggedIn: sessionStorage.getItem('admin_logged_in') === 'true',
    allTests: savedAllTests,
    activeTestId: initialActiveTest.id,
    analyzingTestId: initialActiveTest.id,
    isTestPublished: initialActiveTest.status === 'published',
    testTitle: initialActiveTest.title || 'Technical Assessment 2026',
    testDuration: initialActiveTest.duration || 45,
    allStudents: typeof REGISTERED_STUDENTS !== 'undefined' ? [...REGISTERED_STUDENTS] : [],
    submissions: Array.isArray(initialActiveTest.submissions) ? initialActiveTest.submissions : initialSubmissions,
    questions: Array.isArray(initialActiveTest.questions) && initialActiveTest.questions.length > 0 ? initialActiveTest.questions : initialQuestions,

    // Exam runtime state
    examCurrentIndex: 0,
    examAnswers: {}, // index -> { answer: '', isReview: false }
    examTimerInterval: null,
    examSecondsLeft: 0,
    examStartTime: null,

    // Result & Evaluation state
    lastResult: savedLastResult,
    reviewFilter: 'all',

    // Section Tracker & Analytics State
    activeSectionDrilldown: null,
    drilldownFilter: 'all',
    submissionSectionFilter: 'ALL',
    submissionSearchQuery: '',

    // Fullscreen Proctoring & Security State
    proctorWarnings: 0,
    isExamActive: false,
    isWarningModalOpen: false,
    proctorGraceUntil: 0
  };

  // Keep window.QUESTIONS_BANK in sync
  window.QUESTIONS_BANK = state.questions;

  // DOM Elements - Global
  const portalStatusBadge = document.getElementById('portal-status-badge');
  const btnNavStudent = document.getElementById('btn-nav-student');
  const btnNavAdmin = document.getElementById('btn-nav-admin');

  // Views
  const studentLoginView = document.getElementById('student-login-view');
  const adminLoginView = document.getElementById('admin-login-view');
  const adminDashboardView = document.getElementById('admin-dashboard-view');
  const alreadySubmittedView = document.getElementById('already-submitted-view');
  const noTestView = document.getElementById('no-test-view');
  const examView = document.getElementById('exam-view');
  const resultView = document.getElementById('result-view');

  // DOM Elements - Student Login
  const studentLoginForm = document.getElementById('student-login-form');
  const studentLoginAlert = document.getElementById('student-login-alert');
  const regNoInput = document.getElementById('reg-no');
  const studentNameInput = document.getElementById('student-name');
  const departmentInput = document.getElementById('department');
  const sectionInput = document.getElementById('section');
  const btnQuickFill = document.getElementById('btn-quick-fill');

  // DOM Elements - No Test Screen
  const noTestName = document.getElementById('no-test-name');
  const noTestRegno = document.getElementById('no-test-regno');
  const noTestDeptSec = document.getElementById('no-test-dept-sec');
  const btnBackToHome = document.getElementById('btn-back-to-home');

  // DOM Elements - Already Submitted Screen
  const asStudentName = document.getElementById('as-student-name');
  const asRegNo = document.getElementById('as-reg-no');
  const asDeptSec = document.getElementById('as-dept-sec');
  const asScore = document.getElementById('as-score');
  const asPct = document.getElementById('as-pct');
  const asTime = document.getElementById('as-time');
  const btnBackFromSubmitted = document.getElementById('btn-back-from-submitted');

  // DOM Elements - Admin Login
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminLoginAlert = document.getElementById('admin-login-alert');
  const adminUsernameInput = document.getElementById('admin-username');
  const adminPasswordInput = document.getElementById('admin-password');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  // DOM Elements - Admin Dashboard
  const metricTotalStudents = document.getElementById('metric-total-students');
  const metricTestStatus = document.getElementById('metric-test-status');
  const metricSubmissionsCount = document.getElementById('metric-submissions-count');
  const metricQuestionsCount = document.getElementById('metric-questions-count');

  // Admin Tab 1 (Publish)
  const publishBannerTitle = document.getElementById('publish-banner-title');
  const publishBannerDesc = document.getElementById('publish-banner-desc');
  const btnTogglePublish = document.getElementById('btn-toggle-publish');
  const adminTestTitleInput = document.getElementById('admin-test-title');
  const adminTestDurationInput = document.getElementById('admin-test-duration');
  const btnSaveTestSettings = document.getElementById('btn-save-test-settings');

  // Admin Tab 2 (Question Manager)
  const btnDownloadTemplate = document.getElementById('btn-download-template');
  const btnClearQuestions = document.getElementById('btn-clear-questions');
  const questionDropzone = document.getElementById('question-dropzone');
  const questionFileInput = document.getElementById('question-file-input');
  const btnBrowseFile = document.getElementById('btn-browse-file');
  const questionUploadAlert = document.getElementById('question-upload-alert');
  const assignedQCount = document.getElementById('assigned-q-count');
  const questionsPreviewTbody = document.getElementById('questions-preview-tbody');

  // Admin Tab 3 (Add Student)
  const addStudentForm = document.getElementById('add-student-form');
  const addStudentAlert = document.getElementById('add-student-alert');
  const newRegnoInput = document.getElementById('new-regno');
  const newNameInput = document.getElementById('new-name');
  const newDeptInput = document.getElementById('new-dept');
  const newSectionInput = document.getElementById('new-section');

  // Admin Tab 4 (Directory)
  const dirCountText = document.getElementById('dir-count-text');
  const filterDirSection = document.getElementById('filter-dir-section');
  const searchDirStudent = document.getElementById('search-dir-student');
  const studentRosterTbody = document.getElementById('student-roster-tbody');

  // Admin Tab 3 (Analytics & Section Tracker)
  const sectionProgressCards = document.getElementById('section-progress-cards');
  const submissionsTbody = document.getElementById('submissions-tbody');
  const btnDownloadSectionMatrixExcel = document.getElementById('btn-download-section-matrix-excel');
  const btnDownloadSectionMatrixPdf = document.getElementById('btn-download-section-matrix-pdf');
  const btnDownloadSectionMatrixCsv = document.getElementById('btn-download-section-matrix-csv');
  const btnDownloadAllExcel = document.getElementById('btn-download-all-excel');
  const btnDownloadAllPdf = document.getElementById('btn-download-all-pdf');
  const btnDownloadAllSubmissions = document.getElementById('btn-download-all-submissions');
  const filterSubmissionSection = document.getElementById('filter-submission-section');
  const searchSubmissionStudent = document.getElementById('search-submission-student');

  // Section Drilldown Elements
  const sectionDrilldownPanel = document.getElementById('section-drilldown-panel');
  const drilldownTitle = document.getElementById('drilldown-title');
  const drilldownSubtitle = document.getElementById('drilldown-subtitle');
  const btnDownloadSectionExcel = document.getElementById('btn-download-section-excel');
  const btnDownloadSectionPdf = document.getElementById('btn-download-section-pdf');
  const btnDownloadSectionReport = document.getElementById('btn-download-section-report');
  const btnDownloadSectionText = document.getElementById('btn-download-section-text');
  const btnCloseDrilldown = document.getElementById('btn-close-drilldown');
  const drilldownEnrolled = document.getElementById('drilldown-enrolled');
  const drilldownCompleted = document.getElementById('drilldown-completed');
  const drilldownPending = document.getElementById('drilldown-pending');
  const drilldownAvg = document.getElementById('drilldown-avg');
  const drilldownFilterAll = document.getElementById('drilldown-filter-all');
  const drilldownFilterCompleted = document.getElementById('drilldown-filter-completed');
  const drilldownFilterPending = document.getElementById('drilldown-filter-pending');
  const drilldownCountAll = document.getElementById('drilldown-count-all');
  const drilldownCountCompleted = document.getElementById('drilldown-count-completed');
  const drilldownCountPending = document.getElementById('drilldown-count-pending');
  const drilldownTbody = document.getElementById('drilldown-tbody');

  // Exam Workspace Elements
  const examAvatar = document.getElementById('exam-avatar');
  const examStudentName = document.getElementById('exam-student-name');
  const examStudentMeta = document.getElementById('exam-student-meta');
  const examTimerPill = document.getElementById('exam-timer-pill');
  const examTimerDisplay = document.getElementById('exam-timer-display');
  const btnSubmitExam = document.getElementById('btn-submit-exam');

  const examQIndex = document.getElementById('exam-q-index');
  const examQCategory = document.getElementById('exam-q-category');
  const examQTypeBadge = document.getElementById('exam-q-type-badge');
  const btnMarkReview = document.getElementById('btn-mark-review');
  const examQuestionText = document.getElementById('exam-question-text');

  const examMcqContainer = document.getElementById('exam-mcq-container');
  const examFibContainer = document.getElementById('exam-fib-container');
  const examFibInput = document.getElementById('exam-fib-input');

  const btnPrevQ = document.getElementById('btn-prev-q');
  const btnClearQ = document.getElementById('btn-clear-q');
  const btnNextQ = document.getElementById('btn-next-q');

  const palCountAnswered = document.getElementById('pal-count-answered');
  const palCountUnanswered = document.getElementById('pal-count-unanswered');
  const palCountReview = document.getElementById('pal-count-review');
  const palCountTotal = document.getElementById('pal-count-total');
  const examPaletteGrid = document.getElementById('exam-palette-grid');

  // Result Screen Elements
  const resStudentName = document.getElementById('res-student-name');
  const resStudentMeta = document.getElementById('res-student-meta');
  const resMarksObtained = document.getElementById('res-marks-obtained');
  const resPercentage = document.getElementById('res-percentage');
  const resTotalQ = document.getElementById('res-total-q');
  const resCorrectQ = document.getElementById('res-correct-q');
  const resTimeSpent = document.getElementById('res-time-spent');
  const btnResultReturn = document.getElementById('btn-result-return');

  // Answer Key & Performance Review Elements
  const btnDownloadPdf = document.getElementById('btn-download-pdf');
  const btnDownloadCsvAnswers = document.getElementById('btn-download-csv-answers');
  const btnFilterAll = document.getElementById('btn-filter-all');
  const btnFilterWrong = document.getElementById('btn-filter-wrong');
  const btnFilterCorrect = document.getElementById('btn-filter-correct');
  const countAllQ = document.getElementById('count-all-q');
  const countWrongQ = document.getElementById('count-wrong-q');
  const countCorrectQ = document.getElementById('count-correct-q');
  const reviewCardsContainer = document.getElementById('review-cards-container');

  // Proctoring & Security Elements
  const proctorWarningModal = document.getElementById('proctor-warning-modal');
  const proctorWarningTitle = document.getElementById('proctor-warning-title');
  const proctorWarningDesc = document.getElementById('proctor-warning-desc');
  const proctorWarningCounter = document.getElementById('proctor-warning-counter');
  const btnResumeFullscreen = document.getElementById('btn-resume-fullscreen');
  const examWarningBadge = document.getElementById('exam-warning-badge');
  const resWarnings = document.getElementById('res-warnings');

  // Pre-Exam Fullscreen Launch Modal Elements
  const examLaunchModal = document.getElementById('exam-launch-modal');
  const launchStudentName = document.getElementById('launch-student-name');
  const launchStudentRegno = document.getElementById('launch-student-regno');
  const launchStudentDeptSec = document.getElementById('launch-student-dept-sec');
  const launchTestMeta = document.getElementById('launch-test-meta');
  const btnConfirmLaunchFullscreen = document.getElementById('btn-confirm-launch-fullscreen');
  const btnCancelLaunch = document.getElementById('btn-cancel-launch');

  // Multi-Test Archive & Management DOM Elements
  const btnCreateNewTest = document.getElementById('btn-create-new-test');
  const allTestsTbody = document.getElementById('all-tests-tbody');
  const adminTestArchiveSelect = document.getElementById('admin-test-archive-select');
  const selectedTestStatusPill = document.getElementById('selected-test-status-pill');
  const selectedTestMetaInfo = document.getElementById('selected-test-meta-info');

  // Multi-Test Archive Helper Functions
  function saveAllTestsToStorage() {
    try {
      localStorage.setItem('portal_all_tests', JSON.stringify(state.allTests));
      localStorage.setItem('portal_active_test_id', state.activeTestId);
      localStorage.setItem('portal_test_title', state.testTitle);
      localStorage.setItem('portal_test_duration', state.testDuration.toString());
      localStorage.setItem('portal_test_published', state.isTestPublished ? 'true' : 'false');
      localStorage.setItem('portal_assigned_questions', JSON.stringify(state.questions));
      localStorage.setItem('portal_submissions', JSON.stringify(state.submissions));
    } catch (e) {
      console.warn('[Storage Save Warning]:', e);
    }
  }

  function getActiveTest() {
    return state.allTests.find(t => t.id === state.activeTestId) || state.allTests[0];
  }

  function getAnalyzingTest() {
    return state.allTests.find(t => t.id === state.analyzingTestId) || getActiveTest();
  }

  // ========================================================
  // 1. INITIALIZATION & VIEW CONTROLLER
  // ========================================================

  function init() {
    updateStatusBadge();
    setupNavigation();
    setupStudentAuth();
    setupAdminAuth();
    setupAdminDashboard();
    setupQuestionManager();
    setupExamWorkspace();
    setupResultReview();
    setupAnalyticsTracker();
    setupProctoringGuards();

    renderAllTestsTable();
    populateTestArchiveSelector();

    // Check if admin is currently active
    if (state.isAdminLoggedIn) {
      showView(adminDashboardView);
      btnNavAdmin.classList.add('active');
      btnNavStudent.classList.remove('active');
      refreshAdminData();
    } else {
      showView(studentLoginView);
    }
  }

  function updateStatusBadge() {
    const hasQuestions = state.questions && state.questions.length > 0;

    if (state.isTestPublished && hasQuestions) {
      portalStatusBadge.className = 'status-badge active';
      portalStatusBadge.textContent = '● Test Published & Active';
      if (metricTestStatus) {
        metricTestStatus.textContent = 'Published';
        metricTestStatus.style.color = '#10b981';
      }
      if (publishBannerTitle) publishBannerTitle.textContent = 'Current State: Published (Live)';
      if (publishBannerDesc) publishBannerDesc.textContent = `Students can now enter their register number and access the ${state.questions.length}-question assessment.`;
      if (btnTogglePublish) {
        btnTogglePublish.className = 'btn-unpublish';
        btnTogglePublish.innerHTML = '<span>Stop / Unpublish Test</span>';
      }
    } else if (state.isTestPublished && !hasQuestions) {
      portalStatusBadge.className = 'status-badge inactive';
      portalStatusBadge.textContent = '● Published (0 Questions Loaded)';
      if (metricTestStatus) {
        metricTestStatus.textContent = 'Pending Questions';
        metricTestStatus.style.color = '#f59e0b';
      }
      if (publishBannerTitle) publishBannerTitle.textContent = 'Current State: Published, but 0 Questions';
      if (publishBannerDesc) publishBannerDesc.textContent = 'Upload questions via the Question Manager tab to allow students to take the test.';
      if (btnTogglePublish) {
        btnTogglePublish.className = 'btn-unpublish';
        btnTogglePublish.innerHTML = '<span>Stop / Unpublish Test</span>';
      }
    } else {
      portalStatusBadge.className = 'status-badge inactive';
      portalStatusBadge.textContent = '● No Active Assessment';
      if (metricTestStatus) {
        metricTestStatus.textContent = 'Unpublished';
        metricTestStatus.style.color = '#f59e0b';
      }
      if (publishBannerTitle) publishBannerTitle.textContent = 'Current State: Unpublished';
      if (publishBannerDesc) publishBannerDesc.textContent = 'Students currently see "There is no test right now" upon login.';
      if (btnTogglePublish) {
        btnTogglePublish.className = 'btn-publish';
        btnTogglePublish.innerHTML = '<span>Publish Test to Students</span>';
      }
    }

    if (metricQuestionsCount) {
      metricQuestionsCount.textContent = state.questions.length;
    }
  }

  function showView(targetView) {
    [studentLoginView, adminLoginView, adminDashboardView, alreadySubmittedView, noTestView, examView, resultView].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    if (targetView) targetView.classList.remove('hidden');
  }

  function setupNavigation() {
    btnNavStudent.addEventListener('click', () => {
      if (examView && !examView.classList.contains('hidden')) {
        if (!confirm('You are currently taking the exam. Are you sure you want to leave? Your progress will be lost.')) {
          return;
        }
        clearInterval(state.examTimerInterval);
      }
      btnNavStudent.classList.add('active');
      btnNavAdmin.classList.remove('active');
      showView(studentLoginView);
    });

    btnNavAdmin.addEventListener('click', () => {
      if (examView && !examView.classList.contains('hidden')) {
        if (!confirm('You are currently taking the exam. Are you sure you want to leave?')) {
          return;
        }
        clearInterval(state.examTimerInterval);
      }
      btnNavAdmin.classList.add('active');
      btnNavStudent.classList.remove('active');
      if (state.isAdminLoggedIn) {
        showView(adminDashboardView);
        refreshAdminData();
      } else {
        showView(adminLoginView);
      }
    });

    if (btnBackToHome) {
      btnBackToHome.addEventListener('click', () => {
        showView(studentLoginView);
        btnNavStudent.classList.add('active');
        btnNavAdmin.classList.remove('active');
      });
    }

    if (btnResultReturn) {
      btnResultReturn.addEventListener('click', () => {
        showView(studentLoginView);
        btnNavStudent.classList.add('active');
        btnNavAdmin.classList.remove('active');
        if (regNoInput) regNoInput.value = '';
        if (studentNameInput) studentNameInput.value = '';
        if (sectionInput) sectionInput.value = '';
      });
    }
  }

  // ========================================================
  // 2. STUDENT LOGIN & VERIFICATION
  // ========================================================

  function setupStudentAuth() {
    if (btnQuickFill) {
      btnQuickFill.addEventListener('click', () => {
        const sample = state.allStudents.length > 0
          ? state.allStudents[0]
          : { reg_no: "922525106001", name: "AASHIFA SAHANAJ M", department: "ECE", section: "A" };
        regNoInput.value = sample.reg_no;
        studentNameInput.value = sample.name;
        departmentInput.value = sample.department;
        sectionInput.value = sample.section;
        hideAlert(studentLoginAlert);
      });
    }

    async function autoFill() {
      const regNo = regNoInput.value.trim().toUpperCase();
      if (!regNo || regNo.length < 5) return;

      let student = null;
      if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
        student = await SupabaseAPI.findStudent(regNo);
      }
      if (!student) {
        student = state.allStudents.find(s => s.reg_no.toUpperCase() === regNo);
      }

      if (student) {
        studentNameInput.value = student.name;
        departmentInput.value = student.department;
        sectionInput.value = student.section;
        hideAlert(studentLoginAlert);
      }
    }

    regNoInput.addEventListener('blur', autoFill);
    regNoInput.addEventListener('input', () => {
      if (regNoInput.value.trim().length >= 10) autoFill();
    });

    studentLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(studentLoginAlert);

      const regNo = regNoInput.value.trim().toUpperCase();
      let name = studentNameInput.value.trim();
      let department = departmentInput.value.trim();
      let section = sectionInput.value.trim();

      if (!regNo) {
        showCustomAlert(studentLoginAlert, 'Please enter your Register Number.');
        return;
      }

      const btnEnter = document.getElementById('btn-enter-test');
      const originalText = btnEnter.innerHTML;
      btnEnter.disabled = true;
      btnEnter.innerHTML = `<span>Verifying Register Number...</span>`;

      try {
        let matchedStudent = null;
        if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
          matchedStudent = await SupabaseAPI.findStudent(regNo);
        }
        if (!matchedStudent) {
          matchedStudent = state.allStudents.find(s => s.reg_no.toUpperCase() === regNo);
        }

        if (!matchedStudent) {
          showCustomAlert(studentLoginAlert, `Access Denied: Register Number "${regNo}" was not found in the official roster. Only registered students can access the portal.`);
          btnEnter.disabled = false;
          btnEnter.innerHTML = originalText;
          return;
        }

        name = name || matchedStudent.name;
        department = department || matchedStudent.department;
        section = section || matchedStudent.section;

        state.student = {
          reg_no: matchedStudent.reg_no,
          name: name,
          department: department,
          section: section,
          loginTime: new Date()
        };

        btnEnter.disabled = false;
        btnEnter.innerHTML = originalText;

        // ── DUPLICATE SUBMISSION GUARD (PER ACTIVE TEST) ──────────────────────────────────
        const activeT = getActiveTest();
        const activeSubs = (activeT && Array.isArray(activeT.submissions)) ? activeT.submissions : [];
        const localSubs = JSON.parse(localStorage.getItem('portal_submissions') || '[]');
        const currentTestSubs = activeSubs.length > 0 ? activeSubs : localSubs.filter(s => !s.test_id || s.test_id === state.activeTestId);

        let prevSub = currentTestSubs.find(s =>
          s.reg_no && s.reg_no.toUpperCase() === matchedStudent.reg_no.toUpperCase()
        );

        if (!prevSub && typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
          prevSub = await SupabaseAPI.checkExistingSubmission(matchedStudent.reg_no, state.activeTestId);
        }

        if (prevSub) {
          // Populate the already-submitted info card
          if (asStudentName) asStudentName.textContent = prevSub.name || prevSub.student_name || matchedStudent.name;
          if (asRegNo) asRegNo.textContent = prevSub.reg_no || matchedStudent.reg_no;
          if (asDeptSec) asDeptSec.textContent = `${prevSub.department || matchedStudent.department} • Section ${prevSub.section || matchedStudent.section}`;
          if (asScore) asScore.textContent = `${prevSub.obtained_marks ?? '—'} / ${prevSub.total_marks ?? '—'}`;
          if (asPct) asPct.textContent = prevSub.percentage != null ? `${prevSub.percentage}%` : '—';
          if (asTime) {
            const submittedDate = prevSub.submitted_at ? new Date(prevSub.submitted_at) : null;
            asTime.textContent = submittedDate
              ? submittedDate.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';
          }
          showView(alreadySubmittedView);
          return;
        }
        // ── END DUPLICATE GUARD ─────────────────────────────────────────

        // Check if test is published and questions are assigned
        if (!state.isTestPublished || !state.questions || state.questions.length === 0) {
          noTestName.textContent = state.student.name;
          noTestRegno.textContent = state.student.reg_no;
          noTestDeptSec.textContent = `${state.student.department} • Section ${state.student.section}`;
          showView(noTestView);
          return;
        }

        // Show Pre-Exam Fullscreen Confirmation Modal for direct user gesture launch!
        if (launchStudentName) launchStudentName.textContent = state.student.name;
        if (launchStudentRegno) launchStudentRegno.textContent = state.student.reg_no;
        if (launchStudentDeptSec) launchStudentDeptSec.textContent = `${state.student.department} • Section ${state.student.section}`;
        if (launchTestMeta) launchTestMeta.textContent = `${state.testDuration || 45} Mins • ${state.questions.length} Questions (${state.testTitle})`;

        if (examLaunchModal) {
          examLaunchModal.classList.remove('hidden');
        } else {
          startAssessment();
        }
      } catch (err) {
        console.error('[Student Auth Error]:', err);
        showCustomAlert(studentLoginAlert, `Verification error: ${err.message}.`);
        btnEnter.disabled = false;
        btnEnter.innerHTML = originalText;
      }
    });

    // Wire Pre-Exam Fullscreen Launch Modal Buttons
    if (btnConfirmLaunchFullscreen) {
      btnConfirmLaunchFullscreen.addEventListener('click', () => {
        if (examLaunchModal) examLaunchModal.classList.add('hidden');
        // Synchronous start within direct user gesture!
        startAssessment();
      });
    }

    if (btnCancelLaunch) {
      btnCancelLaunch.addEventListener('click', () => {
        if (examLaunchModal) examLaunchModal.classList.add('hidden');
        state.student = null;
      });
    }

    // Wire "Back to Home" on already-submitted screen
    if (btnBackFromSubmitted) {
      btnBackFromSubmitted.addEventListener('click', () => {
        state.student = null;
        showView(studentLoginView);
        if (regNoInput) regNoInput.value = '';
      });
    }
  }

  // ========================================================
  // 3. ADMIN AUTHENTICATION
  // ========================================================

  function setupAdminAuth() {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(adminLoginAlert);

      const username = adminUsernameInput.value.trim();
      const password = adminPasswordInput.value.trim();

      if (!username || !password) {
        showCustomAlert(adminLoginAlert, 'Please enter both Username and Password.');
        return;
      }

      // Show loading state
      const btnAdminLogin = adminLoginForm.querySelector('button[type="submit"]');
      const originalBtnText = btnAdminLogin ? btnAdminLogin.innerHTML : '';
      if (btnAdminLogin) {
        btnAdminLogin.disabled = true;
        btnAdminLogin.innerHTML = '<span>Verifying...</span>';
      }

      try {
        let isAuthenticated = false;

        // 1. Try Supabase admins table first
        if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
          const adminRecord = await SupabaseAPI.verifyAdmin(username, password);
          if (adminRecord) {
            isAuthenticated = true;
          }
        }

        // 2. Fallback: hardcoded credentials (works offline too)
        if (!isAuthenticated && username === 'sabareesh_261' && password === 'sabareesh') {
          isAuthenticated = true;
        }

        if (isAuthenticated) {
          state.isAdminLoggedIn = true;
          sessionStorage.setItem('admin_logged_in', 'true');
          showView(adminDashboardView);
          btnNavAdmin.classList.add('active');
          btnNavStudent.classList.remove('active');
          refreshAdminData();
        } else {
          showCustomAlert(adminLoginAlert, 'Invalid Username or Password. Please try again.');
        }
      } catch (err) {
        console.error('[Admin Auth Error]:', err);
        showCustomAlert(adminLoginAlert, 'Login error. Please try again.');
      } finally {
        if (btnAdminLogin) {
          btnAdminLogin.disabled = false;
          btnAdminLogin.innerHTML = originalBtnText;
        }
      }
    });

    if (btnAdminLogout) {
      btnAdminLogout.addEventListener('click', () => {
        state.isAdminLoggedIn = false;
        sessionStorage.removeItem('admin_logged_in');
        showView(studentLoginView);
        btnNavStudent.classList.add('active');
        btnNavAdmin.classList.remove('active');
      });
    }
  }

  // ========================================================
  // 4. ADMIN DASHBOARD & CONTROLS
  // ========================================================

  function setupAdminDashboard() {
    const adminTabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.admin-tab-content');

    adminTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.add('hidden'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.remove('hidden');

        if (targetId === 'admin-tab-test-manager' || targetId === 'admin-tab-questions' || targetId === 'admin-tab-publish') {
          renderQuestionsPreview();
        }
        if (targetId === 'admin-tab-students' || targetId === 'admin-tab-directory' || targetId === 'admin-tab-add-student') {
          renderStudentDirectory();
        }
        if (targetId === 'admin-tab-analytics') {
          renderAnalytics();
        }
      });
    });

    if (btnTogglePublish) {
      btnTogglePublish.addEventListener('click', () => {
        state.isTestPublished = !state.isTestPublished;
        localStorage.setItem('portal_test_published', state.isTestPublished ? 'true' : 'false');

        // Sync with active test in state.allTests
        const curActive = getActiveTest();
        if (curActive) {
          curActive.status = state.isTestPublished ? 'published' : 'unpublished';
          curActive.questions = [...state.questions];
          curActive.submissions = [...state.submissions];
        }
        saveAllTestsToStorage();
        updateStatusBadge();
        renderAllTestsTable();
        renderAnalytics();

        if (state.isTestPublished) {
          if (state.questions.length === 0) {
            alert('Assessment published! However, 0 questions are currently loaded. Add or upload questions below to allow students to take the test.');
          } else {
            alert(`Assessment "${state.testTitle}" is now LIVE and PUBLISHED with ${state.questions.length} questions! Candidates can now log in and take the exam.`);
          }
        } else {
          alert(`Assessment "${state.testTitle}" has been UNPUBLISHED!\n\nAll candidate records, marks, and section analytics are securely archived under this assessment.`);
        }
      });
    }

    if (btnSaveTestSettings) {
      btnSaveTestSettings.addEventListener('click', () => {
        const title = adminTestTitleInput ? adminTestTitleInput.value.trim() : 'Technical Assessment 2026';
        const duration = parseInt(adminTestDurationInput ? adminTestDurationInput.value : '45', 10);
        state.testTitle = title || 'Technical Assessment 2026';
        state.testDuration = isNaN(duration) || duration <= 0 ? 45 : duration;

        const curActive = getActiveTest();
        if (curActive) {
          curActive.title = state.testTitle;
          curActive.duration = state.testDuration;
        }

        saveAllTestsToStorage();
        renderAllTestsTable();
        renderAnalytics();

        const feedback = document.getElementById('save-settings-feedback');
        if (feedback) {
          feedback.style.display = 'inline';
          setTimeout(() => { feedback.style.display = 'none'; }, 3000);
        } else {
          alert('Test configuration updated successfully!');
        }
      });
    }

    // Create New Assessment Handler (e.g. Test 2, Test 3)
    if (btnCreateNewTest) {
      btnCreateNewTest.addEventListener('click', () => {
        const testNum = state.allTests.length + 1;
        const newTitle = prompt(`Enter Title for New Assessment #${testNum}:`, `Technical Assessment ${testNum}`);
        if (!newTitle || !newTitle.trim()) return;

        const newDurationStr = prompt(`Enter Test Duration in Minutes for "${newTitle}":`, '45');
        const newDuration = parseInt(newDurationStr || '45', 10);

        // 1. Archive current active test state
        const curActive = getActiveTest();
        if (curActive) {
          curActive.status = 'unpublished';
          curActive.questions = [...state.questions];
          curActive.submissions = [...state.submissions];
        }

        // 2. Create new test entry
        const newTestId = 'test_' + Date.now();
        const newTest = {
          id: newTestId,
          title: newTitle.trim(),
          duration: isNaN(newDuration) || newDuration <= 0 ? 45 : newDuration,
          status: 'unpublished',
          createdAt: new Date().toISOString(),
          questions: [],
          submissions: []
        };

        state.allTests.unshift(newTest);
        state.activeTestId = newTestId;
        state.analyzingTestId = newTestId;
        state.testTitle = newTest.title;
        state.testDuration = newTest.duration;
        state.isTestPublished = false;
        state.questions = [];
        state.submissions = [];
        window.QUESTIONS_BANK = [];

        saveAllTestsToStorage();

        if (adminTestTitleInput) adminTestTitleInput.value = state.testTitle;
        if (adminTestDurationInput) adminTestDurationInput.value = state.testDuration;

        updateStatusBadge();
        renderQuestionsPreview();
        renderAllTestsTable();
        renderAnalytics();

        alert(`New Assessment "${newTest.title}" created successfully!\n\nPrevious test data has been archived safely. You can now add questions for this new test and publish it.`);
      });
    }

    if (addStudentForm) {
      addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert(addStudentAlert);

        const regno = newRegnoInput.value.trim().toUpperCase();
        const name = newNameInput.value.trim();
        const dept = newDeptInput.value.trim();
        const sec = newSectionInput.value.trim();

        if (!regno || !name || !dept || !sec) {
          showCustomAlert(addStudentAlert, 'Please fill in all student details.');
          return;
        }

        const exists = state.allStudents.find(s => s.reg_no.toUpperCase() === regno);
        if (exists) {
          showCustomAlert(addStudentAlert, `Student with Register Number ${regno} already exists in the roster.`);
          return;
        }

        const newStudent = { reg_no: regno, name, department: dept, section: sec };

        if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
          const res = await SupabaseAPI.addStudent(newStudent);
          if (!res.success) {
            console.warn('[Supabase Add Student Warning]:', res.error);
          }
        }

        state.allStudents.unshift(newStudent);
        addStudentAlert.className = 'alert alert-success';
        addStudentAlert.textContent = `Student ${name} (${regno}) added successfully to the database!`;
        addStudentAlert.style.display = 'block';

        newRegnoInput.value = '';
        newNameInput.value = '';

        refreshAdminData();
      });
    }

    if (filterDirSection) {
      filterDirSection.addEventListener('change', renderStudentDirectory);
    }
    if (searchDirStudent) {
      searchDirStudent.addEventListener('input', renderStudentDirectory);
    }
  }

  // ========================================================
  // 5. QUESTION MANAGER (CSV & EXCEL .XLSX/.XLS UPLOADER)
  // ========================================================

  function setupQuestionManager() {
    // 1. Download Sample Question Template (.CSV)
    if (btnDownloadTemplate) {
      btnDownloadTemplate.addEventListener('click', () => {
        const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'sample_question_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
    }

    // 2. Clear / Delete All Questions Handlers (Top and Bottom buttons)
    const purgeAllQuestions = () => {
      if (!state.questions || state.questions.length === 0) {
        alert('Question bank is already empty. No questions to delete.');
        return;
      }
      const count = state.questions.length;
      if (confirm(`⚠️ DELETE ALL QUESTIONS?\n\nAre you sure you want to permanently delete all ${count} questions from this assessment?\n\nThis cannot be undone.`)) {
        state.questions = [];
        localStorage.removeItem('portal_assigned_questions');
        window.QUESTIONS_BANK = [];
        renderQuestionsPreview();
        updateStatusBadge();
        showCustomAlert(questionUploadAlert, `All ${count} questions have been deleted successfully.`);
        questionUploadAlert.className = 'alert alert-info';
        questionUploadAlert.style.display = 'block';
      }
    };

    if (btnClearQuestions) {
      btnClearQuestions.addEventListener('click', purgeAllQuestions);
    }
    const btnClearQuestionsBottom = document.getElementById('btn-clear-questions-bottom');
    if (btnClearQuestionsBottom) {
      btnClearQuestionsBottom.addEventListener('click', purgeAllQuestions);
    }

    // 3. Manual Single Question Add Panel Handlers
    const btnToggleManualAdd = document.getElementById('btn-toggle-manual-add');
    const btnCloseManualAdd = document.getElementById('btn-close-manual-add');
    const btnCancelManualQ = document.getElementById('btn-cancel-manual-q');
    const manualAddPanel = document.getElementById('manual-add-panel');
    const manualQType = document.getElementById('manual-q-type');
    const manualMcqFields = document.getElementById('manual-mcq-fields');
    const manualCorrectLabel = document.getElementById('manual-correct-label');
    const btnSaveManualQ = document.getElementById('btn-save-manual-q');

    const toggleManualAdd = (show) => {
      if (!manualAddPanel) return;
      if (typeof show === 'boolean') {
        manualAddPanel.classList.toggle('hidden', !show);
      } else {
        manualAddPanel.classList.toggle('hidden');
      }
    };

    if (btnToggleManualAdd) btnToggleManualAdd.addEventListener('click', () => toggleManualAdd());
    if (btnCloseManualAdd) btnCloseManualAdd.addEventListener('click', () => toggleManualAdd(false));
    if (btnCancelManualQ) btnCancelManualQ.addEventListener('click', () => toggleManualAdd(false));

    if (manualQType) {
      manualQType.addEventListener('change', () => {
        const isMcq = manualQType.value === 'MCQ';
        if (manualMcqFields) manualMcqFields.style.display = isMcq ? 'block' : 'none';
        if (manualCorrectLabel) {
          manualCorrectLabel.textContent = isMcq
            ? 'Correct Answer (A, B, C, or D) *'
            : 'Correct Answer (Exact word or phrase) *';
        }
      });
    }

    if (btnSaveManualQ) {
      btnSaveManualQ.addEventListener('click', () => {
        const qType = (manualQType ? manualQType.value : 'MCQ').toUpperCase();
        const category = (document.getElementById('manual-q-category')?.value || 'General').trim();
        const prompt = (document.getElementById('manual-q-text')?.value || '').trim();
        const correct = (document.getElementById('manual-q-correct')?.value || '').trim();
        const explanation = (document.getElementById('manual-q-explanation')?.value || '').trim();

        if (!prompt) {
          alert('Please enter a question prompt.');
          return;
        }
        if (!correct) {
          alert('Please specify the correct answer.');
          return;
        }

        let newQ = null;
        if (qType === 'MCQ') {
          const optA = (document.getElementById('manual-opt-a')?.value || '').trim();
          const optB = (document.getElementById('manual-opt-b')?.value || '').trim();
          const optC = (document.getElementById('manual-opt-c')?.value || '').trim();
          const optD = (document.getElementById('manual-opt-d')?.value || '').trim();

          if (!optA || !optB) {
            alert('Please provide at least Option A and Option B for MCQ.');
            return;
          }

          let cleanCorrect = correct.toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(cleanCorrect)) {
            if (cleanCorrect === optA.toUpperCase()) cleanCorrect = 'A';
            else if (cleanCorrect === optB.toUpperCase()) cleanCorrect = 'B';
            else if (cleanCorrect === optC.toUpperCase()) cleanCorrect = 'C';
            else if (cleanCorrect === optD.toUpperCase()) cleanCorrect = 'D';
            else cleanCorrect = 'A';
          }

          newQ = {
            id: state.questions.length + 1,
            type: 'MCQ',
            category: category || 'General',
            question: prompt,
            options: {
              A: optA || 'Option A',
              B: optB || 'Option B',
              C: optC || 'Option C',
              D: optD || 'Option D'
            },
            correctAnswer: cleanCorrect,
            explanation: explanation
          };
        } else {
          newQ = {
            id: state.questions.length + 1,
            type: 'FIB',
            category: category || 'General',
            question: prompt,
            options: null,
            correctAnswer: correct,
            explanation: explanation
          };
        }

        state.questions.push(newQ);
        localStorage.setItem('portal_assigned_questions', JSON.stringify(state.questions));
        window.QUESTIONS_BANK = state.questions;
        renderQuestionsPreview();
        updateStatusBadge();

        // Clear manual inputs
        const qTextInput = document.getElementById('manual-q-text');
        const qCorrectInput = document.getElementById('manual-q-correct');
        const qExpInput = document.getElementById('manual-q-explanation');
        if (qTextInput) qTextInput.value = '';
        if (qCorrectInput) qCorrectInput.value = '';
        if (qExpInput) qExpInput.value = '';
        ['manual-opt-a', 'manual-opt-b', 'manual-opt-c', 'manual-opt-d'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });

        toggleManualAdd(false);
        showCustomAlert(questionUploadAlert, `Question #${state.questions.length} added successfully!`);
        questionUploadAlert.className = 'alert alert-success';
        questionUploadAlert.style.display = 'block';
      });
    }

    // 4. Dropzone & File Browse
    if (btnBrowseFile && questionFileInput) {
      btnBrowseFile.addEventListener('click', (e) => {
        e.stopPropagation();
        questionFileInput.click();
      });
    }

    if (questionDropzone && questionFileInput) {
      questionDropzone.addEventListener('click', () => {
        questionFileInput.click();
      });

      ['dragenter', 'dragover'].forEach(name => {
        questionDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          questionDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        questionDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          questionDropzone.classList.remove('dragover');
        });
      });

      questionDropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleQuestionFileUpload(files[0]);
        }
      });

      questionFileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          handleQuestionFileUpload(files[0]);
        }
      });
    }

    // Render initial questions
    renderQuestionsPreview();
  }

  // Handle uploaded Excel or CSV file
  function handleQuestionFileUpload(file) {
    hideAlert(questionUploadAlert);

    const validExts = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExts.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      showCustomAlert(questionUploadAlert, 'Invalid file format. Please upload a .csv, .xlsx, or .xls file.');
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') {
          showCustomAlert(questionUploadAlert, 'Excel parsing library (SheetJS) is loading. Please check your internet connection.');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          showCustomAlert(questionUploadAlert, 'The uploaded file contains no data rows.');
          return;
        }

        const parsedQuestions = parseQuestionRows(rows);

        if (parsedQuestions.length === 0) {
          showCustomAlert(questionUploadAlert, 'No valid questions could be extracted. Please ensure column headers match the template (Type, Question, Option A-D, Correct Answer).');
          return;
        }

        // Save into state & localStorage
        state.questions = parsedQuestions;
        window.QUESTIONS_BANK = parsedQuestions;
        localStorage.setItem('portal_assigned_questions', JSON.stringify(parsedQuestions));

        const mcqCount = parsedQuestions.filter(q => q.type === 'MCQ').length;
        const fibCount = parsedQuestions.filter(q => q.type === 'FIB').length;

        questionUploadAlert.className = 'alert alert-success';
        questionUploadAlert.textContent = `Successfully processed ${parsedQuestions.length} questions (${mcqCount} MCQ, ${fibCount} Fill in the Blanks) from "${file.name}"!`;
        questionUploadAlert.style.display = 'block';

        renderQuestionsPreview();
        updateStatusBadge();

        if (questionFileInput) questionFileInput.value = '';
      } catch (err) {
        console.error('[Question Upload Error]:', err);
        showCustomAlert(questionUploadAlert, `Failed to parse file: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Normalize column rows into structured question objects
  function parseQuestionRows(rows) {
    const questions = [];

    rows.forEach((rawRow, index) => {
      const row = {};
      Object.keys(rawRow).forEach(k => {
        row[k.trim().toLowerCase()] = String(rawRow[k]).trim();
      });

      const questionText = row['question'] || row['question text'] || row['prompt'] || row['q'] || '';
      if (!questionText) return;

      const rawType = (row['type'] || row['question type'] || '').toUpperCase();
      let type = 'MCQ';

      if (rawType.includes('FIB') || rawType.includes('BLANK') || rawType.includes('FILL')) {
        type = 'FIB';
      } else if (!row['option a'] && !row['option b'] && (questionText.includes('___') || questionText.includes('...'))) {
        type = 'FIB';
      }

      const category = row['category'] || row['subject'] || row['topic'] || 'General';
      const rawCorrect = row['correct answer'] || row['correct'] || row['answer'] || row['correct_answer'] || '';
      const explanation = row['explanation'] || row['solution'] || row['reason'] || '';

      if (type === 'MCQ') {
        const optionA = row['option a'] || row['option_a'] || row['a'] || '';
        const optionB = row['option b'] || row['option_b'] || row['b'] || '';
        const optionC = row['option c'] || row['option_c'] || row['c'] || '';
        const optionD = row['option d'] || row['option_d'] || row['d'] || '';

        let cleanCorrect = rawCorrect.toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(cleanCorrect)) {
          if (cleanCorrect === optionA.toUpperCase()) cleanCorrect = 'A';
          else if (cleanCorrect === optionB.toUpperCase()) cleanCorrect = 'B';
          else if (cleanCorrect === optionC.toUpperCase()) cleanCorrect = 'C';
          else if (cleanCorrect === optionD.toUpperCase()) cleanCorrect = 'D';
          else cleanCorrect = 'A';
        }

        questions.push({
          id: index + 1,
          type: 'MCQ',
          category: category,
          question: questionText,
          options: {
            A: optionA || 'Option A',
            B: optionB || 'Option B',
            C: optionC || 'Option C',
            D: optionD || 'Option D'
          },
          correctAnswer: cleanCorrect,
          explanation: explanation
        });
      } else {
        questions.push({
          id: index + 1,
          type: 'FIB',
          category: category,
          question: questionText,
          options: null,
          correctAnswer: rawCorrect,
          explanation: explanation
        });
      }
    });

    return questions;
  }

  // Render question preview table in admin tab
  function renderQuestionsPreview() {
    if (!questionsPreviewTbody) return;

    if (assignedQCount) assignedQCount.textContent = state.questions.length;
    if (metricQuestionsCount) metricQuestionsCount.textContent = state.questions.length;

    if (state.questions.length === 0) {
      questionsPreviewTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">
            No questions loaded yet. Upload an Excel (.xlsx) or CSV file above or download the sample template.
          </td>
        </tr>
      `;
      return;
    }

    questionsPreviewTbody.innerHTML = state.questions.map((q, idx) => {
      const typeBadge = q.type === 'MCQ'
        ? `<span class="badge-mcq">MCQ</span>`
        : `<span class="badge-fib">FIB</span>`;

      let optionsDisplay = '';
      if (q.type === 'MCQ' && q.options) {
        optionsDisplay = `
          <div style="font-size: 0.78rem; line-height: 1.4; color: #334155;">
            <div><strong>A:</strong> ${escapeHtml(q.options.A)}</div>
            <div><strong>B:</strong> ${escapeHtml(q.options.B)}</div>
            <div><strong>C:</strong> ${escapeHtml(q.options.C)}</div>
            <div><strong>D:</strong> ${escapeHtml(q.options.D)}</div>
          </div>
        `;
      } else {
        optionsDisplay = `<span style="color: #94a3b8; font-style: italic; font-size: 0.8rem;">Text Blank Input</span>`;
      }

      return `
        <tr>
          <td style="color: #64748b;">${idx + 1}</td>
          <td>${typeBadge}</td>
          <td><span class="badge-sec">${escapeHtml(q.category)}</span></td>
          <td style="font-weight: 500; max-width: 320px; color: #0f172a;">${escapeHtml(q.question)}</td>
          <td>${optionsDisplay}</td>
          <td><strong style="color: #16a34a; font-family: monospace;">${escapeHtml(q.correctAnswer)}</strong></td>
          <td style="text-align: center;">
            <button type="button" class="btn-delete-q" data-idx="${idx}" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626; cursor: pointer; padding: 5px 10px; font-size: 0.84rem; transition: all 0.2s;" title="Delete this question">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < state.questions.length) {
          const qText = state.questions[idx].question;
          const snippet = qText.length > 45 ? qText.substring(0, 45) + '...' : qText;
          if (confirm(`Delete Question #${idx + 1}?\n"${snippet}"`)) {
            state.questions.splice(idx, 1);
            localStorage.setItem('portal_assigned_questions', JSON.stringify(state.questions));
            window.QUESTIONS_BANK = state.questions;
            renderQuestionsPreview();
            updateStatusBadge();
          }
        }
      });
    });
  }

  // Populate Test Selection Dropdown in Analytics Tab
  function populateTestArchiveSelector() {
    if (!adminTestArchiveSelect) return;

    const currentSelected = state.analyzingTestId || state.activeTestId;
    adminTestArchiveSelect.innerHTML = state.allTests.map(t => {
      const isSelected = t.id === currentSelected;
      const subCount = Array.isArray(t.submissions) ? t.submissions.length : 0;
      const statusLabel = t.status === 'published' ? 'Live / Active' : 'Completed / Unpublished';
      return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(t.title)} [${statusLabel} - ${subCount} Subs]</option>`;
    }).join('');
  }

  // Render All Tests Historical Table in Tab 1
  function renderAllTestsTable() {
    if (!allTestsTbody) return;

    if (!state.allTests || state.allTests.length === 0) {
      allTestsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No assessment records found.</td></tr>`;
      return;
    }

    allTestsTbody.innerHTML = state.allTests.map((t, idx) => {
      const isLive = (t.status === 'published');
      const isActiveSelected = (t.id === state.activeTestId);
      const qCount = Array.isArray(t.questions) ? t.questions.length : 0;
      const subCount = Array.isArray(t.submissions) ? t.submissions.length : 0;

      const statusBadge = isLive
        ? `<span class="badge-test-live">● Live (Published)</span>`
        : `<span class="badge-test-archived">● Completed / Unpublished</span>`;

      return `
        <tr style="${isActiveSelected ? 'background: #eff6ff;' : ''}">
          <td style="color: #64748b;">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(t.title)}</span>
              ${isActiveSelected ? '<span style="background: #2563eb; color: #fff; font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; font-weight: 800;">ACTIVE</span>' : ''}
            </div>
            <div style="font-size: 0.76rem; color: #64748b;">ID: ${t.id} • Created: ${new Date(t.createdAt).toLocaleDateString()}</div>
          </td>
          <td style="color: #334155; font-weight: 500;">${t.duration || 45} mins</td>
          <td><strong style="color: #2563eb;">${qCount} Qs</strong></td>
          <td><strong style="color: #16a34a;">${subCount} Candidates</strong></td>
          <td>${statusBadge}</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
              <button type="button" class="btn-portal-primary btn-analyze-test" data-id="${t.id}" style="padding: 4px 10px; font-size: 0.78rem;" title="View Section Analytics & Student Submissions for this test">
                📊 Analyze
              </button>
              <button type="button" class="btn-portal-secondary btn-select-active-test" data-id="${t.id}" style="padding: 4px 10px; font-size: 0.78rem;" title="Set as active test to upload questions or publish">
                ${isActiveSelected ? '✓ Active' : 'Select'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Wire action buttons
    document.querySelectorAll('.btn-analyze-test').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.analyzingTestId = id;
        const analyticsTabBtn = document.querySelector('.admin-tab[data-target="admin-tab-analytics"]');
        if (analyticsTabBtn) analyticsTabBtn.click();
        renderAnalytics();
      });
    });

    document.querySelectorAll('.btn-select-active-test').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const chosen = state.allTests.find(t => t.id === id);
        if (!chosen) return;

        state.activeTestId = chosen.id;
        state.analyzingTestId = chosen.id;
        state.testTitle = chosen.title;
        state.testDuration = chosen.duration || 45;
        state.isTestPublished = (chosen.status === 'published');
        state.questions = Array.isArray(chosen.questions) ? chosen.questions : [];
        state.submissions = Array.isArray(chosen.submissions) ? chosen.submissions : [];
        window.QUESTIONS_BANK = state.questions;

        saveAllTestsToStorage();
        updateStatusBadge();
        if (adminTestTitleInput) adminTestTitleInput.value = state.testTitle;
        if (adminTestDurationInput) adminTestDurationInput.value = state.testDuration;
        renderQuestionsPreview();
        renderAllTestsTable();
        renderAnalytics();
      });
    });
  }

  // ========================================================
  // 6. STUDENT EXAMINATION WORKSPACE & LOGIC
  // ========================================================

  function setupExamWorkspace() {
    if (btnPrevQ) {
      btnPrevQ.addEventListener('click', () => {
        if (state.examCurrentIndex > 0) {
          state.examCurrentIndex--;
          renderExamQuestion(state.examCurrentIndex);
        }
      });
    }

    if (btnNextQ) {
      btnNextQ.addEventListener('click', () => {
        if (state.examCurrentIndex < state.questions.length - 1) {
          state.examCurrentIndex++;
          renderExamQuestion(state.examCurrentIndex);
        } else {
          submitAssessment();
        }
      });
    }

    if (btnClearQ) {
      btnClearQ.addEventListener('click', () => {
        const curr = state.examAnswers[state.examCurrentIndex];
        if (curr) {
          curr.answer = '';
          renderExamQuestion(state.examCurrentIndex);
          updatePaletteStats();
        }
      });
    }

    if (btnMarkReview) {
      btnMarkReview.addEventListener('click', () => {
        const curr = state.examAnswers[state.examCurrentIndex];
        if (curr) {
          curr.isReview = !curr.isReview;
          renderExamQuestion(state.examCurrentIndex);
          updatePaletteStats();
        }
      });
    }

    if (btnSubmitExam) {
      btnSubmitExam.addEventListener('click', () => {
        submitAssessment();
      });
    }
  }

  function startAssessment() {
    if (!state.student || state.questions.length === 0) return;

    state.examAnswers = {};
    state.questions.forEach((q, idx) => {
      state.examAnswers[idx] = { answer: '', isReview: false };
    });

    state.examCurrentIndex = 0;
    state.examStartTime = new Date();
    state.examSecondsLeft = (state.testDuration || 45) * 60;

    // Reset Proctoring State
    state.proctorWarnings = 0;
    state.isExamActive = true;
    state.isWarningModalOpen = false;

    if (examAvatar) examAvatar.textContent = (state.student.name || 'S').charAt(0).toUpperCase();
    if (examStudentName) examStudentName.textContent = state.student.name;
    if (examStudentMeta) examStudentMeta.textContent = `${state.student.department} • Section ${state.student.section} • ${state.student.reg_no}`;

    updateWarningDisplay();

    showView(examView);
    renderPaletteGrid();
    renderExamQuestion(0);
    startExamTimer();

    // Enter Fullscreen Mode
    requestPortalFullscreen();
  }

  function startExamTimer() {
    if (state.examTimerInterval) clearInterval(state.examTimerInterval);

    updateTimerDisplay();

    state.examTimerInterval = setInterval(() => {
      state.examSecondsLeft--;

      if (state.examSecondsLeft <= 0) {
        clearInterval(state.examTimerInterval);
        state.examSecondsLeft = 0;
        updateTimerDisplay();
        alert('Time is up! Your examination is being automatically submitted.');
        finalizeSubmission();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    if (!examTimerDisplay) return;

    const mins = Math.floor(state.examSecondsLeft / 60);
    const secs = state.examSecondsLeft % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    examTimerDisplay.textContent = str;

    if (state.examSecondsLeft < 300) {
      examTimerPill.className = 'timer-pill danger';
    } else if (state.examSecondsLeft < 600) {
      examTimerPill.className = 'timer-pill warning';
    } else {
      examTimerPill.className = 'timer-pill';
    }
  }

  function renderExamQuestion(index) {
    const q = state.questions[index];
    if (!q) return;

    if (examQIndex) examQIndex.textContent = `Question ${index + 1} of ${state.questions.length}`;
    if (examQCategory) examQCategory.textContent = q.category || 'General';

    if (examQTypeBadge) {
      examQTypeBadge.className = q.type === 'MCQ' ? 'badge-mcq' : 'badge-fib';
      examQTypeBadge.textContent = q.type === 'MCQ' ? 'Multiple Choice' : 'Fill in the Blank';
    }

    const currAns = state.examAnswers[index] || { answer: '', isReview: false };

    if (btnMarkReview) {
      if (currAns.isReview) {
        btnMarkReview.style.background = 'rgba(168, 85, 247, 0.25)';
        btnMarkReview.style.borderColor = '#a855f7';
        btnMarkReview.style.color = '#e9d5ff';
        btnMarkReview.innerHTML = '<span>★ Marked for Review</span>';
      } else {
        btnMarkReview.style.background = 'transparent';
        btnMarkReview.style.borderColor = 'var(--border-color)';
        btnMarkReview.style.color = 'var(--text-secondary)';
        btnMarkReview.innerHTML = '<span>🔖 Mark for Review</span>';
      }
    }

    if (examQuestionText) examQuestionText.textContent = q.question;

    if (q.type === 'MCQ') {
      if (examMcqContainer) examMcqContainer.classList.remove('hidden');
      if (examFibContainer) examFibContainer.classList.add('hidden');

      const opts = q.options || {};
      const keys = ['A', 'B', 'C', 'D'];

      if (examMcqContainer) {
        examMcqContainer.innerHTML = keys.map(k => {
          const isSelected = currAns.answer === k;
          return `
            <div class="mcq-option-card ${isSelected ? 'selected' : ''}" data-opt="${k}">
              <div class="option-badge">${k}</div>
              <div style="font-size: 0.95rem; color: #0f172a; font-weight: 500;">${escapeHtml(opts[k] || '')}</div>
            </div>
          `;
        }).join('');

        examMcqContainer.querySelectorAll('.mcq-option-card').forEach(card => {
          card.addEventListener('click', () => {
            const chosen = card.getAttribute('data-opt');
            state.examAnswers[index].answer = chosen;
            renderExamQuestion(index);
            updatePaletteStats();
          });
        });
      }
    } else {
      if (examMcqContainer) examMcqContainer.classList.add('hidden');
      if (examFibContainer) examFibContainer.classList.remove('hidden');

      if (examFibInput) {
        examFibInput.value = currAns.answer || '';
        examFibInput.oninput = (e) => {
          state.examAnswers[index].answer = e.target.value;
          updatePaletteStats();
        };
      }
    }

    if (btnPrevQ) {
      btnPrevQ.disabled = (index === 0);
      btnPrevQ.style.opacity = (index === 0) ? '0.4' : '1';
    }

    if (btnNextQ) {
      if (index === state.questions.length - 1) {
        btnNextQ.innerHTML = '<span>Finish & Submit Test ✓</span>';
      } else {
        btnNextQ.innerHTML = '<span>Next Question →</span>';
      }
    }

    updatePaletteStats();
  }

  function renderPaletteGrid() {
    if (!examPaletteGrid) return;

    examPaletteGrid.innerHTML = state.questions.map((q, idx) => `
      <button type="button" class="pal-btn" id="pal-btn-${idx}" data-idx="${idx}">
        ${idx + 1}
      </button>
    `).join('');

    examPaletteGrid.querySelectorAll('.pal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        state.examCurrentIndex = idx;
        renderExamQuestion(idx);
      });
    });

    updatePaletteStats();
  }

  function updatePaletteStats() {
    let answered = 0;
    let review = 0;
    const total = state.questions.length;

    state.questions.forEach((q, idx) => {
      const resp = state.examAnswers[idx] || { answer: '', isReview: false };
      const hasAnswer = (resp.answer && resp.answer.trim().length > 0);
      const isRev = resp.isReview;

      if (hasAnswer) answered++;
      if (isRev) review++;

      const btn = document.getElementById(`pal-btn-${idx}`);
      if (btn) {
        btn.className = 'pal-btn';
        if (idx === state.examCurrentIndex) btn.classList.add('current');
        if (isRev) btn.classList.add('review');
        else if (hasAnswer) btn.classList.add('answered');
      }
    });

    const unanswered = total - answered;

    if (palCountAnswered) palCountAnswered.textContent = `${answered} Answered`;
    if (palCountUnanswered) palCountUnanswered.textContent = `${unanswered} Unanswered`;
    if (palCountReview) palCountReview.textContent = `${review} In Review`;
    if (palCountTotal) palCountTotal.textContent = `Total: ${total}`;
  }

  function submitAssessment() {
    let answered = 0;
    state.questions.forEach((q, idx) => {
      const resp = state.examAnswers[idx];
      if (resp && resp.answer && resp.answer.trim().length > 0) answered++;
    });
    const unanswered = state.questions.length - answered;

    const confirmMsg = unanswered > 0
      ? `You have answered ${answered} of ${state.questions.length} questions.\n${unanswered} questions are still unanswered.\n\nAre you sure you want to finish and submit the assessment now?`
      : `You have answered all ${state.questions.length} questions!\n\nAre you sure you want to submit your assessment?`;

    if (confirm(confirmMsg)) {
      clearInterval(state.examTimerInterval);
      finalizeSubmission(false);
    }
  }

  // ========================================================
  // 6.1. FULLSCREEN PROCTORING & SECURITY GUARDS (3 WARNINGS)
  // ========================================================

  function requestPortalFullscreen() {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        return elem.requestFullscreen().catch(err => {
          console.warn('[Fullscreen Warning]:', err.message);
        });
      } else if (elem.webkitRequestFullscreen) {
        return elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        return elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        return elem.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('[Fullscreen Request Exception]:', err.message);
    }
  }

  function setupProctoringGuards() {
    // 1. Detect Fullscreen Exit (Escape key or browser control)
    const onFullscreenChange = () => {
      if (!state.isExamActive) return;
      if (Date.now() < (state.proctorGraceUntil || 0)) return; // Ignore during launch/resume transition!
      const isFull = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      if (!isFull) {
        triggerProctorWarning('Exited fullscreen mode or pressed Escape');
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    // 2. Tab switch or minimize window
    document.addEventListener('visibilitychange', () => {
      if (!state.isExamActive) return;
      if (Date.now() < (state.proctorGraceUntil || 0)) return;
      if (document.hidden) {
        triggerProctorWarning('Switched tabs or minimized browser window');
      }
    });

    // 3. Window blur (clicked outside or alt-tabbed)
    window.addEventListener('blur', () => {
      if (!state.isExamActive) return;
      if (Date.now() < (state.proctorGraceUntil || 0)) return;
      if (state.isWarningModalOpen) return;
      setTimeout(() => {
        if (state.isExamActive && !document.hasFocus() && !state.isWarningModalOpen) {
          triggerProctorWarning('Left examination window');
        }
      }, 350);
    });

    // 4. Intercept Escape key explicitly
    window.addEventListener('keydown', (e) => {
      if (!state.isExamActive) return;
      if (e.key === 'Escape' || e.keyCode === 27) {
        triggerProctorWarning('Escape key detected');
      }
    });

    // 5. Warning Modal "Return to Fullscreen & Resume" button
    if (btnResumeFullscreen) {
      btnResumeFullscreen.addEventListener('click', () => {
        if (proctorWarningModal) proctorWarningModal.classList.add('hidden');
        state.isWarningModalOpen = false;
        state.proctorGraceUntil = Date.now() + 2500;
        requestPortalFullscreen();
      });
    }
  }

  function triggerProctorWarning(reason) {
    if (!state.isExamActive) return;
    if (state.isWarningModalOpen) return; // Prevent multiple simultaneous triggers

    state.proctorWarnings = (state.proctorWarnings || 0) + 1;
    state.isWarningModalOpen = true;

    updateWarningDisplay();

    if (state.proctorWarnings >= 3) {
      // 3 warnings reached! Terminate test immediately!
      terminateAssessmentDueToWarnings(reason);
    } else {
      // Show Warning Modal
      showWarningModal(reason);
    }
  }

  function showWarningModal(reason) {
    if (!proctorWarningModal) return;

    if (proctorWarningTitle) {
      proctorWarningTitle.textContent = `Security Warning ${state.proctorWarnings} of 3`;
    }
    if (proctorWarningDesc) {
      proctorWarningDesc.textContent = `Warning ${state.proctorWarnings} of 3: ${reason}. Exiting full screen or navigating away from the test portal is strictly prohibited!`;
    }
    if (proctorWarningCounter) {
      proctorWarningCounter.textContent = `${state.proctorWarnings} / 3 Warnings`;
    }

    proctorWarningModal.classList.remove('hidden');
  }

  function terminateAssessmentDueToWarnings(reason) {
    state.isExamActive = false;
    state.isWarningModalOpen = false;
    if (proctorWarningModal) proctorWarningModal.classList.add('hidden');

    if (state.examTimerInterval) clearInterval(state.examTimerInterval);

    try {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    } catch (e) {}

    alert(`⚠️ TEST TERMINATED IMMEDIATELY!\n\nYou have exceeded the maximum limit of 3 security warnings (${reason}).\n\nYour assessment has been automatically ended and submitted with all violation records.`);

    finalizeSubmission(true);
  }

  function updateWarningDisplay() {
    if (examWarningBadge) {
      const count = state.proctorWarnings || 0;
      examWarningBadge.textContent = `Warnings: ${count}/3`;
      if (count >= 2) {
        examWarningBadge.style.background = '#fef2f2';
        examWarningBadge.style.color = '#dc2626';
        examWarningBadge.style.borderColor = '#fecaca';
      } else if (count === 1) {
        examWarningBadge.style.background = '#fffbeb';
        examWarningBadge.style.color = '#d97706';
        examWarningBadge.style.borderColor = '#fde68a';
      } else {
        examWarningBadge.style.background = '#eff6ff';
        examWarningBadge.style.color = '#2563eb';
        examWarningBadge.style.borderColor = '#bfdbfe';
      }
    }
  }

  // ========================================================
  // 7. EVALUATION, RESULTS & ANSWER KEY REPORT GENERATION
  // ========================================================

  async function finalizeSubmission(isTerminated = false) {
    let correctCount = 0;
    const totalQ = state.questions.length;
    const incorrectRecords = [];
    const evaluations = [];

    state.questions.forEach((q, idx) => {
      const resp = state.examAnswers[idx] || { answer: '' };
      const studentAns = (resp.answer || '').trim();
      const isSkipped = !studentAns;
      let isCorrect = false;

      // Extract raw correct answer safely with multiple fallbacks
      const rawCorrect = (q.correctAnswer !== undefined && q.correctAnswer !== null)
        ? q.correctAnswer
        : ((q.correct !== undefined && q.correct !== null) ? q.correct : ((q.answer !== undefined && q.answer !== null) ? q.answer : ''));
      const safeCorrectStr = String(rawCorrect || '').trim();

      let studentDisplay = studentAns;
      let correctDisplay = safeCorrectStr;

      const qType = (q.type || 'MCQ').toUpperCase();
      if (qType === 'MCQ') {
        const studentClean = studentAns.toUpperCase();
        const correctClean = safeCorrectStr.toUpperCase();
        isCorrect = !isSkipped && (studentClean === correctClean);
        if (q.options) {
          if (q.options[studentClean]) {
            studentDisplay = `(${studentClean}) ${q.options[studentClean]}`;
          }
          if (q.options[correctClean]) {
            correctDisplay = `(${correctClean}) ${q.options[correctClean]}`;
          }
        }
      } else {
        isCorrect = !isSkipped && (studentAns.toLowerCase() === safeCorrectStr.toLowerCase());
      }

      if (isCorrect) {
        correctCount++;
      } else {
        incorrectRecords.push({
          qno: idx + 1,
          question: q.question,
          studentAns: studentAns || '(No Answer)',
          correctAnswer: safeCorrectStr,
          explanation: q.explanation || ''
        });
      }

      evaluations.push({
        qno: idx + 1,
        type: qType,
        category: q.category || 'General',
        question: q.question,
        options: q.options,
        studentAnswer: studentAns,
        studentDisplay: isSkipped ? '(Not Answered)' : studentDisplay,
        correctAnswer: safeCorrectStr,
        correctDisplay: correctDisplay,
        isCorrect: isCorrect,
        isSkipped: isSkipped,
        explanation: q.explanation || ''
      });
    });

    const totalMarks = totalQ;
    const obtainedMarks = correctCount;
    const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '0.0';

    const totalSecondsAllocated = (state.testDuration || 45) * 60;
    const timeSpentSeconds = Math.max(1, totalSecondsAllocated - state.examSecondsLeft);
    const timeSpentMins = Math.floor(timeSpentSeconds / 60);
    const timeSpentSecs = timeSpentSeconds % 60;
    const timeSpentFormatted = `${timeSpentMins}m ${timeSpentSecs}s`;

    const submissionData = {
      reg_no: state.student ? state.student.reg_no : 'ANON',
      student_name: state.student ? state.student.name : 'Candidate',
      department: state.student ? state.student.department : 'ECE',
      section: state.student ? state.student.section : 'A',
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      percentage: parseFloat(percentage),
      time_taken_seconds: timeSpentSeconds,
      warning_count: state.proctorWarnings || 0,
      is_terminated: Boolean(isTerminated || state.proctorWarnings >= 3),
      test_id: state.activeTestId || 'test_1',
      test_title: state.testTitle || 'Technical Assessment 2026',
      submitted_at: new Date().toISOString()
    };

    // Save evaluation result into state
    state.lastResult = {
      student: state.student ? { ...state.student } : { name: 'Candidate', reg_no: 'N/A', department: 'ECE', section: 'A' },
      testTitle: state.testTitle || 'Technical Assessment 2026',
      testId: state.activeTestId || 'test_1',
      totalMarks,
      obtainedMarks,
      percentage: parseFloat(percentage),
      timeSpentMins,
      timeSpentSecs,
      timeSpentFormatted,
      warning_count: state.proctorWarnings || 0,
      is_terminated: Boolean(isTerminated || state.proctorWarnings >= 3),
      submittedAt: submissionData.submitted_at,
      evaluations: evaluations
    };

    // Exit fullscreen if active
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (e) {}

    // Persist to session and local storage
    try {
      sessionStorage.setItem('portal_last_result', JSON.stringify(state.lastResult));
      localStorage.setItem('portal_last_result', JSON.stringify(state.lastResult));
    } catch (e) {
      console.warn('Could not persist lastResult:', e);
    }

    // Save to Supabase Cloud if configured
    if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
      try {
        await SupabaseAPI.saveSubmission(submissionData, incorrectRecords);
      } catch (err) {
        console.warn('[Supabase Submission Warning]:', err);
      }
    }

    // Save to active test archive in state.allTests
    const activeTestRecord = getActiveTest();
    if (activeTestRecord) {
      if (!Array.isArray(activeTestRecord.submissions)) activeTestRecord.submissions = [];
      const dup = activeTestRecord.submissions.some(s =>
        s.reg_no && s.reg_no.toUpperCase() === submissionData.reg_no.toUpperCase()
      );
      if (!dup) {
        activeTestRecord.submissions.unshift(submissionData);
      }
    }

    // Save to localStorage submissions
    const localSubs = JSON.parse(localStorage.getItem('portal_submissions') || '[]');
    const alreadyExists = localSubs.some(s =>
      s.reg_no && s.reg_no.toUpperCase() === submissionData.reg_no.toUpperCase() &&
      (!s.test_id || s.test_id === submissionData.test_id)
    );
    if (!alreadyExists) {
      localSubs.unshift(submissionData);
      localStorage.setItem('portal_submissions', JSON.stringify(localSubs));
      const inMemDup = state.submissions.some(s =>
        s.reg_no && s.reg_no.toUpperCase() === submissionData.reg_no.toUpperCase()
      );
      if (!inMemDup) state.submissions.unshift(submissionData);
    }

    // Persist all updated tests to storage
    saveAllTestsToStorage();

    // Populate Results View Summary Banner
    if (resStudentName && state.student) resStudentName.textContent = state.student.name;
    if (resStudentMeta && state.student) resStudentMeta.textContent = `${state.student.department} • Section ${state.student.section} • ${state.student.reg_no}`;
    if (resMarksObtained) resMarksObtained.textContent = `${obtainedMarks} / ${totalMarks}`;
    if (resPercentage) {
      resPercentage.textContent = `${percentage}%`;
      resPercentage.style.color = parseFloat(percentage) >= 50 ? '#10b981' : '#ef4444';
    }
    if (resTotalQ) resTotalQ.textContent = totalQ;
    if (resCorrectQ) resCorrectQ.textContent = correctCount;
    if (resTimeSpent) resTimeSpent.textContent = timeSpentFormatted;
    if (resWarnings) {
      const warnCount = state.proctorWarnings || 0;
      if (warnCount >= 3 || isTerminated) {
        resWarnings.innerHTML = `<span style="color: #dc2626; font-weight: 800;">3 / 3 (Terminated)</span>`;
      } else if (warnCount > 0) {
        resWarnings.innerHTML = `<span style="color: #d97706; font-weight: 700;">${warnCount} / 3</span>`;
      } else {
        resWarnings.innerHTML = `<span style="color: #16a34a; font-weight: 700;">0 / 3 (Clean)</span>`;
      }
    }

    // Reset filter to All
    state.reviewFilter = 'all';
    [btnFilterAll, btnFilterWrong, btnFilterCorrect].forEach(b => {
      if (b) b.classList.remove('active');
    });
    if (btnFilterAll) btnFilterAll.classList.add('active');

    // Render Detailed Answer Key & Solutions
    renderAnswerReviewCards();

    // Show Results View
    showView(resultView);
  }

  // Setup click listeners for answer review filters & downloads
  function setupResultReview() {
    if (btnDownloadPdf) {
      btnDownloadPdf.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAnswerKeyPDF();
      });
    }

    if (btnDownloadCsvAnswers) {
      btnDownloadCsvAnswers.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAnswerKeyCSV();
      });
    }

    const filterChips = [
      { el: btnFilterAll, key: 'all' },
      { el: btnFilterWrong, key: 'wrong' },
      { el: btnFilterCorrect, key: 'correct' }
    ];

    filterChips.forEach(({ el, key }) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          filterChips.forEach(b => { if (b.el) b.el.classList.remove('active'); });
          el.classList.add('active');
          state.reviewFilter = key;
          renderAnswerReviewCards();
        });
      }
    });
  }

  // Render question-by-question review cards on results page
  function renderAnswerReviewCards() {
    if (!state.lastResult) {
      const cached = JSON.parse(sessionStorage.getItem('portal_last_result') || localStorage.getItem('portal_last_result') || 'null');
      if (cached) state.lastResult = cached;
    }
    if (!state.lastResult || !reviewCardsContainer) return;

    const evals = state.lastResult.evaluations || [];
    const filter = state.reviewFilter || 'all';

    const correctTotal = evals.filter(e => e.isCorrect).length;
    const wrongTotal = evals.filter(e => !e.isCorrect).length;

    if (countAllQ) countAllQ.textContent = evals.length;
    if (countWrongQ) countWrongQ.textContent = wrongTotal;
    if (countCorrectQ) countCorrectQ.textContent = correctTotal;

    const filtered = evals.filter(item => {
      if (filter === 'wrong') return !item.isCorrect;
      if (filter === 'correct') return item.isCorrect;
      return true;
    });

    if (filtered.length === 0) {
      reviewCardsContainer.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 32px 20px; background: #f8fafc; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-top: 10px;">
          No questions found matching this filter (${filter}).
        </div>
      `;
      return;
    }

    reviewCardsContainer.innerHTML = filtered.map(item => {
      let cardClass = 'answer-review-card ';
      let statusBadge = '';
      let answerComparisonHTML = '';

      if (item.isCorrect) {
        cardClass += 'correct';
        statusBadge = `<span class="badge-status-correct">✔ CORRECT (+1 Mark)</span>`;
        answerComparisonHTML = `
          <div class="ans-row student-correct">
            <div>
              <span style="font-size: 0.8rem; color: #15803d; font-weight: 700; display: block; margin-bottom: 2px;">Your Answer:</span>
              <strong style="color: #0f172a;">${escapeHtml(item.studentDisplay)}</strong>
            </div>
            <span class="ans-tag correct">✔ Correct</span>
          </div>
        `;
      } else if (item.isSkipped) {
        cardClass += 'skipped';
        statusBadge = `<span class="badge-status-skipped">⚠ NOT ANSWERED (0 Marks)</span>`;
        answerComparisonHTML = `
          <div class="ans-row student-skipped">
            <div>
              <span style="font-size: 0.8rem; color: #b45309; font-weight: 700; display: block; margin-bottom: 2px;">Your Answer:</span>
              <em style="color: #64748b;">(Candidate skipped this question)</em>
            </div>
            <span class="ans-tag skipped">Skipped</span>
          </div>
          <div class="ans-row key-correct">
            <div>
              <span style="font-size: 0.8rem; color: #15803d; font-weight: 700; display: block; margin-bottom: 2px;">Official Correct Answer:</span>
              <strong style="color: #0f172a;">${escapeHtml(item.correctDisplay || item.correctAnswer)}</strong>
            </div>
            <span class="ans-tag correct">✔ Right Answer</span>
          </div>
        `;
      } else {
        cardClass += 'wrong';
        statusBadge = `<span class="badge-status-wrong">✘ WRONG / INCORRECT (0 Marks)</span>`;
        answerComparisonHTML = `
          <div class="ans-row student-wrong">
            <div>
              <span style="font-size: 0.8rem; color: #b91c1c; font-weight: 700; display: block; margin-bottom: 2px;">Your Answer:</span>
              <strong style="color: #0f172a;">${escapeHtml(item.studentDisplay)}</strong>
            </div>
            <span class="ans-tag wrong">✘ Incorrect</span>
          </div>
          <div class="ans-row key-correct">
            <div>
              <span style="font-size: 0.8rem; color: #15803d; font-weight: 700; display: block; margin-bottom: 2px;">Official Correct Answer:</span>
              <strong style="color: #0f172a;">${escapeHtml(item.correctDisplay || item.correctAnswer)}</strong>
            </div>
            <span class="ans-tag correct">✔ Right Answer</span>
          </div>
        `;
      }

      let optionsPreview = '';
      if (item.type === 'MCQ' && item.options) {
        optionsPreview = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin: 12px 0; font-size: 0.82rem; color: #334155;">
            <div style="padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;"><strong style="color:#2563eb;">A:</strong> ${escapeHtml(item.options.A || '')}</div>
            <div style="padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;"><strong style="color:#2563eb;">B:</strong> ${escapeHtml(item.options.B || '')}</div>
            <div style="padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;"><strong style="color:#2563eb;">C:</strong> ${escapeHtml(item.options.C || '')}</div>
            <div style="padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;"><strong style="color:#2563eb;">D:</strong> ${escapeHtml(item.options.D || '')}</div>
          </div>
        `;
      }

      const explanationHTML = item.explanation ? `
        <div class="review-explanation">
          💡 <strong>Explanation / Rationale:</strong> ${escapeHtml(item.explanation)}
        </div>
      ` : '';

      return `
        <div class="${cardClass}">
          <div class="review-card-top">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="q-badge">Question ${item.qno}</span>
              <span class="badge-sec">${escapeHtml(item.category || 'General')}</span>
              <span class="${item.type === 'MCQ' ? 'badge-mcq' : 'badge-fib'}">${item.type || 'MCQ'}</span>
            </div>
            ${statusBadge}
          </div>

          <div class="review-prompt">${escapeHtml(item.question)}</div>

          ${optionsPreview}

          <div class="ans-comparison-box">
            ${answerComparisonHTML}
          </div>

          ${explanationHTML}
        </div>
      `;
    }).join('');
  }

  // Download Answer Key Report as a Printable PDF Document (Popup-Blocker Immune)
  function downloadAnswerKeyPDF() {
    if (!state.lastResult) {
      const cached = JSON.parse(sessionStorage.getItem('portal_last_result') || localStorage.getItem('portal_last_result') || 'null');
      if (cached) {
        state.lastResult = cached;
      } else {
        alert('No assessment result found to download. Please complete the assessment first.');
        return;
      }
    }

    const { student, testTitle, totalMarks, obtainedMarks, percentage, timeSpentFormatted, submittedAt, evaluations } = state.lastResult;
    const safeRegNo = (student && student.reg_no) ? student.reg_no : 'Candidate';
    const safeName = (student && student.name) ? student.name.replace(/\s+/g, '_') : 'Student';

    const evals = evaluations || [];
    const correctCount = evals.filter(e => e.isCorrect).length;
    const wrongCount = evals.filter(e => !e.isCorrect && !e.isSkipped).length;
    const skippedCount = evals.filter(e => e.isSkipped).length;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Answer Key & Evaluation Report - ${escapeHtml(safeRegNo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 28px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-box {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .inst-title {
      font-size: 18px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .inst-sub {
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-badge {
      background: #0284c7;
      color: white;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 18px;
    }
    .meta-row { font-size: 12.5px; }
    .meta-row strong { color: #334155; }
    .score-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
    }
    .score-tile {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .score-tile.main {
      background: #e0f2fe;
      border-color: #38bdf8;
    }
    .score-tile .val {
      font-size: 19px;
      font-weight: 800;
      color: #0f172a;
    }
    .score-tile.main .val { color: #0284c7; }
    .score-tile .lbl {
      font-size: 10.5px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-top: 2px;
    }
    .section-heading {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .q-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .q-card.correct { border-left: 5px solid #10b981; }
    .q-card.wrong { border-left: 5px solid #ef4444; background: #fffbfb; }
    .q-card.skipped { border-left: 5px solid #f59e0b; background: #fffdf5; }
    .q-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .q-num {
      font-weight: 700;
      font-size: 12.5px;
      color: #1e293b;
    }
    .badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge.correct { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge.wrong { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .badge.skipped { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .q-prompt {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #1e293b;
    }
    .ans-box {
      margin-bottom: 6px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
    }
    .ans-box.wrong { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
    .ans-box.correct { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
    .ans-box.skipped { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
    .explanation {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      font-size: 11.5px;
      color: #475569;
    }
    .print-actions {
      margin-bottom: 18px;
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
    }
    @media print {
      .print-actions { display: none !important; }
      body { padding: 0; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="header-box">
    <div>
      <div class="inst-title">Technical Assessment Portal</div>
      <div class="inst-sub">Institutional Evaluation & Official Solution Key</div>
    </div>
    <div class="doc-badge">Answer Key Report</div>
  </div>

  <div class="meta-grid">
    <div class="meta-row"><strong>Candidate:</strong> ${escapeHtml(student ? student.name : '')}</div>
    <div class="meta-row"><strong>Register Number:</strong> ${escapeHtml(safeRegNo)}</div>
    <div class="meta-row"><strong>Department & Section:</strong> ${escapeHtml(student ? student.department : '')} - Section ${escapeHtml(student ? student.section : '')}</div>
    <div class="meta-row"><strong>Examination:</strong> ${escapeHtml(testTitle || 'Technical Assessment 2026')}</div>
    <div class="meta-row"><strong>Time Taken:</strong> ${escapeHtml(timeSpentFormatted || 'N/A')}</div>
    <div class="meta-row"><strong>Date Submitted:</strong> ${new Date(submittedAt || Date.now()).toLocaleString()}</div>
  </div>

  <div class="score-summary">
    <div class="score-tile main">
      <div class="val">${obtainedMarks} / ${totalMarks}</div>
      <div class="lbl">Final Score</div>
    </div>
    <div class="score-tile main">
      <div class="val">${percentage}%</div>
      <div class="lbl">Percentage</div>
    </div>
    <div class="score-tile">
      <div class="val" style="color: #10b981;">${correctCount}</div>
      <div class="lbl">Correct Answers</div>
    </div>
    <div class="score-tile">
      <div class="val" style="color: #ef4444;">${wrongCount + skippedCount}</div>
      <div class="lbl">Wrong / Skipped</div>
    </div>
  </div>

  <div class="section-heading">Question-by-Question Evaluation</div>

  ${evals.map(item => {
    let cardClass = 'q-card ';
    let badge = '';
    let answerBlocks = '';

    if (item.isCorrect) {
      cardClass += 'correct';
      badge = '<span class="badge correct">✔ Correct (+1)</span>';
      answerBlocks = `
        <div class="ans-box correct">
          <strong>Your Answer:</strong> ${escapeHtml(item.studentDisplay)} (Correct)
        </div>
      `;
    } else if (item.isSkipped) {
      cardClass += 'skipped';
      badge = '<span class="badge skipped">⚠ Not Answered (0)</span>';
      answerBlocks = `
        <div class="ans-box skipped">
          <strong>Your Answer:</strong> (Candidate Skipped This Question)
        </div>
        <div class="ans-box correct">
          <strong>Official Correct Answer:</strong> ${escapeHtml(item.correctDisplay || item.correctAnswer)}
        </div>
      `;
    } else {
      cardClass += 'wrong';
      badge = '<span class="badge wrong">✘ Wrong / Incorrect (0)</span>';
      answerBlocks = `
        <div class="ans-box wrong">
          <strong>Your Answer:</strong> ${escapeHtml(item.studentDisplay)} (Incorrect)
        </div>
        <div class="ans-box correct">
          <strong>Official Correct Answer:</strong> ${escapeHtml(item.correctDisplay || item.correctAnswer)}
        </div>
      `;
    }

    const expBlock = item.explanation ? `
      <div class="explanation"><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</div>
    ` : '';

    return `
      <div class="${cardClass}">
        <div class="q-header">
          <span class="q-num">Q${item.qno}. [${escapeHtml(item.category || 'General')}] (${item.type || 'MCQ'})</span>
          ${badge}
        </div>
        <div class="q-prompt">${escapeHtml(item.question)}</div>
        ${answerBlocks}
        ${expBlock}
      </div>
    `;
  }).join('')}

</body>
</html>`;

    // 1. Download as standalone HTML file (immune to popup blocker)
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `Answer_Key_${safeRegNo}_${safeName}.html`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
    }, 200);

    // 2. Also trigger seamless in-page print dialog via hidden iframe (immune to popup blocker)
    try {
      let printFrame = document.getElementById('answer-key-print-frame');
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'answer-key-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        printFrame.style.visibility = 'hidden';
        document.body.appendChild(printFrame);
      }
      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (printErr) {
          console.log('iframe print notice:', printErr);
        }
      }, 350);
    } catch (e) {
      console.log('Print frame initialized:', e);
    }
  }

  // Download Answer Key Report as CSV file with UTF-8 BOM
  function downloadAnswerKeyCSV() {
    if (!state.lastResult) {
      const cached = JSON.parse(sessionStorage.getItem('portal_last_result') || localStorage.getItem('portal_last_result') || 'null');
      if (cached) {
        state.lastResult = cached;
      } else {
        alert('No assessment result found to download. Please complete the assessment first.');
        return;
      }
    }

    const { student, testTitle, totalMarks, obtainedMarks, percentage, timeSpentFormatted, submittedAt, evaluations } = state.lastResult;
    const safeRegNo = (student && student.reg_no) ? student.reg_no : 'Candidate';
    const safeName = (student && student.name) ? student.name.replace(/\s+/g, '_') : 'Student';

    function csvCell(val) {
      if (val === null || val === undefined) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    }

    const rows = [];
    rows.push([csvCell('TECHNICAL ASSESSMENT - CANDIDATE ANSWER KEY & PERFORMANCE REPORT')]);
    rows.push([csvCell('Candidate Name:'), csvCell(student ? student.name : '')]);
    rows.push([csvCell('Register Number:'), csvCell(student ? student.reg_no : '')]);
    rows.push([csvCell('Department:'), csvCell(student ? student.department : '')]);
    rows.push([csvCell('Section:'), csvCell(student ? student.section : '')]);
    rows.push([csvCell('Examination Title:'), csvCell(testTitle || 'Technical Assessment 2026')]);
    rows.push([csvCell('Score / Total Marks:'), csvCell(`${obtainedMarks} / ${totalMarks}`)]);
    rows.push([csvCell('Percentage:'), csvCell(`${percentage}%`)]);
    rows.push([csvCell('Time Taken:'), csvCell(timeSpentFormatted || 'N/A')]);
    rows.push([csvCell('Submission Date & Time:'), csvCell(new Date(submittedAt || Date.now()).toLocaleString())]);
    rows.push([]);
    rows.push([
      csvCell('#'),
      csvCell('Category'),
      csvCell('Question Type'),
      csvCell('Question Prompt'),
      csvCell('Candidate Response'),
      csvCell('Result Status'),
      csvCell('Official Correct Answer'),
      csvCell('Explanation / Rationale')
    ]);

    (evaluations || []).forEach(item => {
      let statusStr = 'CORRECT (+1 Mark)';
      if (item.isSkipped) statusStr = 'NOT ANSWERED (0 Marks)';
      else if (!item.isCorrect) statusStr = 'WRONG / INCORRECT (0 Marks)';

      rows.push([
        csvCell(item.qno),
        csvCell(item.category || 'General'),
        csvCell(item.type || 'MCQ'),
        csvCell(item.question || ''),
        csvCell(item.studentDisplay || '(Not Answered)'),
        csvCell(statusStr),
        csvCell(item.correctDisplay || item.correctAnswer || ''),
        csvCell(item.explanation || '')
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Answer_Key_${safeRegNo}_${safeName}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // ========================================================
  // 8. ADMIN DATA & ANALYTICS
  // ========================================================

  async function refreshAdminData() {
    if (typeof SupabaseAPI !== 'undefined' && SupabaseAPI.isConfigured()) {
      const dbStudents = await SupabaseAPI.getAllStudents();
      if (Array.isArray(dbStudents) && dbStudents.length > 0) {
        state.allStudents = dbStudents;
      }

      const dbSubs = await SupabaseAPI.getAllSubmissions();
      if (Array.isArray(dbSubs) && dbSubs.length > 0) {
        state.submissions = dbSubs;

        // Distribute/merge submissions into corresponding tests in state.allTests
        state.allTests.forEach(t => {
          const testMatches = dbSubs.filter(s => s.test_id === t.id);
          if (testMatches.length > 0) {
            t.submissions = testMatches;
          } else if (t.id === 'test_1') {
            const unassigned = dbSubs.filter(s => !s.test_id || s.test_id === 'test_1');
            if (unassigned.length > 0) t.submissions = unassigned;
          }
        });
        saveAllTestsToStorage();
      }
    }

    const localSubs = JSON.parse(localStorage.getItem('portal_submissions') || '[]');
    if (state.submissions.length === 0 && localSubs.length > 0) {
      state.submissions = localSubs;
    }

    if (metricTotalStudents) metricTotalStudents.textContent = state.allStudents.length;
    if (metricSubmissionsCount) metricSubmissionsCount.textContent = state.submissions.length;
    if (metricQuestionsCount) metricQuestionsCount.textContent = state.questions.length;
    if (dirCountText) dirCountText.textContent = `Showing ${state.allStudents.length} registered candidates`;

    renderStudentDirectory();
    renderAllTestsTable();
    renderAnalytics();
    renderQuestionsPreview();
  }

  function renderStudentDirectory() {
    if (!studentRosterTbody) return;
    const filterSec = filterDirSection ? filterDirSection.value : 'ALL';
    const query = searchDirStudent ? searchDirStudent.value.trim().toLowerCase() : '';

    const filtered = state.allStudents.filter(s => {
      const matchSec = (filterSec === 'ALL') || (s.section === filterSec);
      const matchSearch = !query ||
        s.name.toLowerCase().includes(query) ||
        s.reg_no.toLowerCase().includes(query);
      return matchSec && matchSearch;
    });

    if (dirCountText) dirCountText.textContent = `Showing ${filtered.length} of ${state.allStudents.length} candidates`;

    if (filtered.length === 0) {
      studentRosterTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 24px;">No matching students found.</td></tr>`;
      return;
    }

    studentRosterTbody.innerHTML = filtered.map((s, idx) => `
      <tr>
        <td style="color: #64748b;">${idx + 1}</td>
        <td><strong style="color: #0f172a; font-family: monospace;">${s.reg_no}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.department)}</td>
        <td><span class="badge-sec">Sec ${escapeHtml(s.section)}</span></td>
      </tr>
    `).join('');
  }

  // ========================================================
  // 8.1. SECTION TRACKER, DRILLDOWN & EXPORT LOGIC
  // ========================================================

  function setupAnalyticsTracker() {
    // 1. Download Overall Section Summary Matrix (Excel, PDF, CSV)
    if (btnDownloadSectionMatrixExcel) {
      btnDownloadSectionMatrixExcel.addEventListener('click', (e) => {
        e.preventDefault();
        downloadSectionMatrixExcel();
      });
    }
    if (btnDownloadSectionMatrixPdf) {
      btnDownloadSectionMatrixPdf.addEventListener('click', (e) => {
        e.preventDefault();
        downloadSectionMatrixPDF();
      });
    }
    if (btnDownloadSectionMatrixCsv) {
      btnDownloadSectionMatrixCsv.addEventListener('click', (e) => {
        e.preventDefault();
        downloadSectionMatrixCSV();
      });
    }

    // 2. Download All Submissions (Excel, PDF, CSV)
    if (btnDownloadAllExcel) {
      btnDownloadAllExcel.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAllSubmissionsExcel();
      });
    }
    if (btnDownloadAllPdf) {
      btnDownloadAllPdf.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAllSubmissionsPDF();
      });
    }
    if (btnDownloadAllSubmissions) {
      btnDownloadAllSubmissions.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAllSubmissionsCSV();
      });
    }

    // 2. Download Section Report (Excel, PDF, CSV)
    if (btnDownloadSectionExcel) {
      btnDownloadSectionExcel.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.activeSectionDrilldown) {
          downloadSectionReportExcel(state.activeSectionDrilldown);
        } else {
          alert('Please select a section first.');
        }
      });
    }
    if (btnDownloadSectionPdf) {
      btnDownloadSectionPdf.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.activeSectionDrilldown) {
          downloadSectionReportPDF(state.activeSectionDrilldown);
        } else {
          alert('Please select a section first.');
        }
      });
    }
    if (btnDownloadSectionReport) {
      btnDownloadSectionReport.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.activeSectionDrilldown) {
          downloadSectionReportCSV(state.activeSectionDrilldown);
        } else {
          alert('Please select a section first.');
        }
      });
    }

    // 3. Close Drilldown Panel
    if (btnCloseDrilldown) {
      btnCloseDrilldown.addEventListener('click', (e) => {
        e.preventDefault();
        state.activeSectionDrilldown = null;
        renderAnalytics();
      });
    }

    // 4. Drilldown Filter Pills (All / Completed / Pending)
    const drilldownPills = [
      { el: drilldownFilterAll, key: 'all' },
      { el: drilldownFilterCompleted, key: 'completed' },
      { el: drilldownFilterPending, key: 'pending' }
    ];
    drilldownPills.forEach(({ el, key }) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          drilldownPills.forEach(p => { if (p.el) p.el.classList.remove('active'); });
          el.classList.add('active');
          state.drilldownFilter = key;
          renderSectionDrilldown();
        });
      }
    });

    // 5. Submissions Table Section Filter
    if (filterSubmissionSection) {
      filterSubmissionSection.addEventListener('change', () => {
        state.submissionSectionFilter = filterSubmissionSection.value;
        renderSubmissionsTable();
      });
    }

    // 6. Submissions Table Search Input
    if (searchSubmissionStudent) {
      searchSubmissionStudent.addEventListener('input', () => {
        state.submissionSearchQuery = searchSubmissionStudent.value.trim().toLowerCase();
        renderSubmissionsTable();
      });
    }

    // 7. Test Archive Analytics Selector
    if (adminTestArchiveSelect) {
      adminTestArchiveSelect.addEventListener('change', () => {
        state.analyzingTestId = adminTestArchiveSelect.value;
        renderAnalytics();
      });
    }
  }

  function renderAnalytics() {
    if (!sectionProgressCards) return;

    populateTestArchiveSelector();

    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;

    if (selectedTestStatusPill && analyzingTest) {
      const isLive = (analyzingTest.status === 'published');
      selectedTestStatusPill.className = isLive ? 'badge-test-live' : 'badge-test-archived';
      selectedTestStatusPill.textContent = isLive ? '● Live / Active' : '● Completed / Unpublished';
    }

    if (selectedTestMetaInfo && analyzingTest) {
      const qCount = Array.isArray(analyzingTest.questions) ? analyzingTest.questions.length : 0;
      selectedTestMetaInfo.textContent = `Test: ${escapeHtml(analyzingTest.title)} • Duration: ${analyzingTest.duration || 45}m • Questions: ${qCount} • Total Submissions: ${testSubs.length}`;
    }

    const sections = ['A', 'B', 'C', 'D', 'E', 'F'];

    sectionProgressCards.innerHTML = sections.map(sec => {
      const enrolled = state.allStudents.filter(s => s.section === sec).length;
      const completed = testSubs.filter(sub => sub.section === sec).length;
      const pct = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
      const isActive = state.activeSectionDrilldown === sec;

      return `
        <div class="stat-card section-card-interactive ${isActive ? 'active' : ''}" data-sec="${sec}" title="Click to open Section ${sec} student list and test submissions">
          <div class="stat-title" style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #0f172a; font-size: 0.95rem;">Section ${sec} Progress</strong>
            <span style="font-size: 0.82rem; font-weight: 700; color: ${pct === 100 ? '#16a34a' : '#2563eb'};">${pct}%</span>
          </div>
          <div class="stat-value" style="font-size: 1.45rem; display: flex; align-items: baseline; gap: 8px; margin-top: 6px;">
            <span>${completed} <span style="font-size: 0.88rem; color: #64748b; font-weight: normal;">/ ${enrolled}</span></span>
            <span style="font-size: 0.78rem; font-weight: 600; color: ${completed > 0 ? '#16a34a' : '#94a3b8'}; margin-left: auto;">${completed} Submitted</span>
          </div>
          <div class="card-action-hint">
            <span>${isActive ? '▼ Viewing Section ' + sec + ' (Click to close)' : '📂 Open Section ' + sec + ' Roster →'}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events to open section drilldown
    document.querySelectorAll('.section-card-interactive').forEach(card => {
      card.addEventListener('click', () => {
        const sec = card.getAttribute('data-sec');
        if (state.activeSectionDrilldown === sec) {
          state.activeSectionDrilldown = null;
        } else {
          state.activeSectionDrilldown = sec;
          if (filterSubmissionSection) {
            filterSubmissionSection.value = sec;
            state.submissionSectionFilter = sec;
          }
        }
        renderAnalytics();
      });
    });

    renderSectionDrilldown();
    renderSubmissionsTable();
  }

  function renderSectionDrilldown() {
    if (!sectionDrilldownPanel) return;

    const sec = state.activeSectionDrilldown;
    if (!sec) {
      sectionDrilldownPanel.classList.add('hidden');
      return;
    }

    sectionDrilldownPanel.classList.remove('hidden');

    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;

    const enrolledStudents = state.allStudents.filter(s => s.section === sec);
    const completedSubs = testSubs.filter(s => s.section === sec);
    const subMap = new Map();
    completedSubs.forEach(sub => {
      subMap.set(sub.reg_no.toUpperCase(), sub);
    });

    const enrolledCount = enrolledStudents.length;
    const completedCount = completedSubs.length;
    const pendingCount = Math.max(0, enrolledCount - completedCount);

    let avgPercentage = '0.0';
    if (completedCount > 0) {
      const sumPct = completedSubs.reduce((acc, curr) => acc + (parseFloat(curr.percentage) || 0), 0);
      avgPercentage = (sumPct / completedCount).toFixed(1);
    }

    if (drilldownTitle) drilldownTitle.textContent = `Section ${sec} Candidate Performance Breakdown - ${analyzingTest ? analyzingTest.title : state.testTitle}`;
    if (drilldownSubtitle) drilldownSubtitle.textContent = `Showing all ${enrolledCount} enrolled students in Section ${sec} and test completion records.`;
    if (btnDownloadSectionText) btnDownloadSectionText.textContent = `📄 CSV (.CSV)`;
    if (btnDownloadSectionExcel) btnDownloadSectionExcel.title = `Download Section ${sec} Report in Excel (.XLSX)`;
    if (btnDownloadSectionPdf) btnDownloadSectionPdf.title = `Download Section ${sec} Report in PDF (.PDF)`;
    if (btnDownloadSectionReport) btnDownloadSectionReport.title = `Download Section ${sec} Report in CSV (.CSV)`;

    if (drilldownEnrolled) drilldownEnrolled.textContent = enrolledCount;
    if (drilldownCompleted) drilldownCompleted.textContent = completedCount;
    if (drilldownPending) drilldownPending.textContent = pendingCount;
    if (drilldownAvg) drilldownAvg.textContent = `${avgPercentage}%`;

    if (drilldownCountAll) drilldownCountAll.textContent = enrolledCount;
    if (drilldownCountCompleted) drilldownCountCompleted.textContent = completedCount;
    if (drilldownCountPending) drilldownCountPending.textContent = pendingCount;

    // Filter by drilldownFilter ('all', 'completed', 'pending')
    const filter = state.drilldownFilter || 'all';
    const filteredRoster = enrolledStudents.filter(s => {
      const hasSub = subMap.has(s.reg_no.toUpperCase());
      if (filter === 'completed') return hasSub;
      if (filter === 'pending') return !hasSub;
      return true;
    });

    if (!drilldownTbody) return;

    if (filteredRoster.length === 0) {
      drilldownTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 24px;">No candidates found matching this filter (${filter}).</td></tr>`;
      return;
    }

    drilldownTbody.innerHTML = filteredRoster.map((s, idx) => {
      const sub = subMap.get(s.reg_no.toUpperCase());
      const isCompleted = !!sub;

      const statusBadge = isCompleted
        ? `<span class="badge-status-completed">✔ Completed</span>`
        : `<span class="badge-status-pending">⏳ Pending</span>`;

      const scoreDisplay = isCompleted
        ? `<strong style="color: #10b981;">${sub.obtained_marks} / ${sub.total_marks}</strong>`
        : `<span style="color: #64748b;">—</span>`;

      const pctDisplay = isCompleted
        ? `<strong style="color: ${parseFloat(sub.percentage) >= 50 ? '#10b981' : '#ef4444'};">${sub.percentage}%</strong>`
        : `<span style="color: #64748b;">—</span>`;

      let timeFormatted = '—';
      if (isCompleted && sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      let warnBadge = '<span style="color: #94a3b8; font-size: 0.82rem;">—</span>';
      if (isCompleted) {
        const warnCount = Number(sub.warning_count) || 0;
        if (warnCount >= 3) {
          warnBadge = `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 7px; border-radius: 9999px; font-weight: 700; font-size: 0.76rem;" title="Test auto-terminated due to 3 security violations">🚨 ${warnCount} (Terminated)</span>`;
        } else if (warnCount > 0) {
          warnBadge = `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 9999px; font-weight: 600; font-size: 0.76rem;">⚠️ ${warnCount} Warn</span>`;
        } else {
          warnBadge = `<span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 9999px; font-weight: 600; font-size: 0.76rem;">✔ 0 Clean</span>`;
        }
      }

      const dateDisplay = isCompleted
        ? `<span style="font-size: 0.82rem; color: #475569;">${new Date(sub.submitted_at).toLocaleString()}</span>`
        : `<span style="color: #94a3b8; font-size: 0.82rem;">Not Attempted</span>`;

      return `
        <tr>
          <td style="color: #64748b;">${idx + 1}</td>
          <td><strong style="color: #0f172a; font-family: monospace;">${s.reg_no}</strong></td>
          <td style="font-weight: 500; color: #0f172a;">${escapeHtml(s.name)}</td>
          <td>${statusBadge}</td>
          <td>${scoreDisplay}</td>
          <td>${pctDisplay}</td>
          <td style="color: #64748b; font-size: 0.84rem;">${timeFormatted}</td>
          <td>${warnBadge}</td>
          <td>${dateDisplay}</td>
        </tr>
      `;
    }).join('');
  }

  function renderSubmissionsTable() {
    if (!submissionsTbody) return;

    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;

    const filterSec = state.submissionSectionFilter || 'ALL';
    const query = state.submissionSearchQuery || '';

    const filtered = testSubs.filter(sub => {
      const matchSec = (filterSec === 'ALL') || (sub.section === filterSec);
      const matchSearch = !query ||
        sub.student_name.toLowerCase().includes(query) ||
        sub.reg_no.toLowerCase().includes(query);
      return matchSec && matchSearch;
    });

    if (filtered.length === 0) {
      submissionsTbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 24px;">No student submissions found matching the criteria.</td></tr>`;
      return;
    }

    submissionsTbody.innerHTML = filtered.map((sub, idx) => {
      let timeFormatted = '—';
      if (sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      const warnCount = Number(sub.warning_count) || 0;
      let warnBadge = '';
      if (warnCount >= 3) {
        warnBadge = `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 7px; border-radius: 9999px; font-weight: 700; font-size: 0.76rem;" title="Test auto-terminated due to 3 security violations">🚨 ${warnCount} (Terminated)</span>`;
      } else if (warnCount > 0) {
        warnBadge = `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 9999px; font-weight: 600; font-size: 0.76rem;">⚠️ ${warnCount} Warn</span>`;
      } else {
        warnBadge = `<span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 9999px; font-weight: 600; font-size: 0.76rem;">✔ 0 Clean</span>`;
      }

      return `
        <tr>
          <td style="color: #64748b;">${idx + 1}</td>
          <td><strong style="color: #0f172a; font-family: monospace;">${sub.reg_no}</strong></td>
          <td style="font-weight: 500; color: #0f172a;">${escapeHtml(sub.student_name)}</td>
          <td>${escapeHtml(sub.department)}</td>
          <td><span class="badge-sec">Sec ${escapeHtml(sub.section)}</span></td>
          <td><strong style="color: #16a34a;">${sub.obtained_marks} / ${sub.total_marks}</strong></td>
          <td><span style="font-weight: 700; color: ${parseFloat(sub.percentage) >= 50 ? '#16a34a' : '#dc2626'};">${sub.percentage}%</span></td>
          <td style="color: #64748b; font-size: 0.84rem;">${timeFormatted}</td>
          <td>${warnBadge}</td>
          <td style="color: #64748b; font-size: 0.82rem;">${new Date(sub.submitted_at).toLocaleString()}</td>
        </tr>
      `;
    }).join('');
  }

  // ========================================================
  // 8.2. REPORT EXPORTERS (CSV, EXCEL .XLSX, PDF .PDF)
  // ========================================================

  // Reusable helper to format CSV cells safely
  function formatCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  }

  // Calculate summary statistics for any submission array and enrolled count
  function computeSummaryStatistics(subs, enrolledCount) {
    const totalEnrolled = enrolledCount || 0;
    const totalAttended = subs ? subs.length : 0;
    const passedSubs = (subs || []).filter(sub => {
      const pct = parseFloat(sub.percentage);
      if (!isNaN(pct)) return pct >= 50;
      const obt = Number(sub.obtained_marks) || 0;
      const tot = Number(sub.total_marks) || 0;
      return tot > 0 ? (obt / tot) >= 0.5 : false;
    });
    const totalPassed = passedSubs.length;
    const passPercentage = totalAttended > 0 ? ((totalPassed / totalAttended) * 100).toFixed(2) : '0.00';

    let markAverageDisplay = '0.00';
    if (totalAttended > 0) {
      const sumMarks = subs.reduce((acc, curr) => acc + (Number(curr.obtained_marks) || 0), 0);
      const avgMarks = (sumMarks / totalAttended).toFixed(2);
      const sumPct = subs.reduce((acc, curr) => acc + (parseFloat(curr.percentage) || 0), 0);
      const avgPct = (sumPct / totalAttended).toFixed(2);
      const sampleTotalMarks = subs[0]?.total_marks || (state.questions ? state.questions.length : 0);
      markAverageDisplay = `${avgMarks} / ${sampleTotalMarks} (${avgPct}%)`;
    }

    return {
      totalEnrolled,
      totalAttended,
      totalPassed,
      passPercentage,
      markAverageDisplay
    };
  }

  // Helper to compile consolidated section-by-section matrix data
  function getSectionSummaryMatrixData() {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    const dynamicSections = [...new Set(state.allStudents.map(s => s.section))].filter(Boolean).sort();
    const sections = dynamicSections.length > 0 ? dynamicSections : ['A', 'B', 'C', 'D', 'E', 'F'];

    const sampleTotalMarks = (testSubs && testSubs[0]?.total_marks) || (state.questions ? state.questions.length : 0);

    const sectionRows = sections.map(sec => {
      const enrolled = state.allStudents.filter(s => s.section === sec).length;
      const secSubs = (testSubs || []).filter(s => s.section === sec);
      const attended = secSubs.length;
      const passedSubs = secSubs.filter(sub => {
        const pct = parseFloat(sub.percentage);
        if (!isNaN(pct)) return pct >= 50;
        const obt = Number(sub.obtained_marks) || 0;
        const tot = Number(sub.total_marks) || 0;
        return tot > 0 ? (obt / tot) >= 0.5 : false;
      });
      const passed = passedSubs.length;
      const passPct = attended > 0 ? ((passed / attended) * 100).toFixed(2) : '0.00';

      let avgDisplay = '0.00';
      if (attended > 0) {
        const sumMarks = secSubs.reduce((acc, curr) => acc + (Number(curr.obtained_marks) || 0), 0);
        const avgMarks = (sumMarks / attended).toFixed(2);
        const sumPct = secSubs.reduce((acc, curr) => acc + (parseFloat(curr.percentage) || 0), 0);
        const avgPct = (sumPct / attended).toFixed(2);
        avgDisplay = `${avgMarks} / ${sampleTotalMarks} (${avgPct}%)`;
      }

      return {
        section: `Section ${sec}`,
        enrolled,
        attended,
        passed,
        passPercentage: `${passPct}%`,
        averageMark: avgDisplay
      };
    });

    const totalEnrolled = state.allStudents.length;
    const totalAttended = (testSubs || []).length;
    const totalPassedSubs = (testSubs || []).filter(sub => {
      const pct = parseFloat(sub.percentage);
      if (!isNaN(pct)) return pct >= 50;
      const obt = Number(sub.obtained_marks) || 0;
      const tot = Number(sub.total_marks) || 0;
      return tot > 0 ? (obt / tot) >= 0.5 : false;
    });
    const totalPassed = totalPassedSubs.length;
    const totalPassPct = totalAttended > 0 ? ((totalPassed / totalAttended) * 100).toFixed(2) : '0.00';

    let totalAvgDisplay = '0.00';
    if (totalAttended > 0) {
      const sumMarks = (testSubs || []).reduce((acc, curr) => acc + (Number(curr.obtained_marks) || 0), 0);
      const avgMarks = (sumMarks / totalAttended).toFixed(2);
      const sumPct = (testSubs || []).reduce((acc, curr) => acc + (parseFloat(curr.percentage) || 0), 0);
      const avgPct = (sumPct / totalAttended).toFixed(2);
      totalAvgDisplay = `${avgMarks} / ${sampleTotalMarks} (${avgPct}%)`;
    }

    const overallRow = {
      section: 'OVERALL TOTAL',
      enrolled: totalEnrolled,
      attended: totalAttended,
      passed: totalPassed,
      passPercentage: `${totalPassPct}%`,
      averageMark: totalAvgDisplay
    };

    return {
      testTitle,
      sectionRows,
      overallRow
    };
  }

  // 1. Download Overall Section Summary Matrix as CSV file (Transposed: Sections as Columns, Metrics as Rows)
  function downloadSectionMatrixCSV() {
    const data = getSectionSummaryMatrixData();
    const rows = [];
    rows.push([formatCsvCell('TECHNICAL ASSESSMENT - OVERALL SECTION PERFORMANCE SUMMARY')]);
    rows.push([formatCsvCell('Examination Title:'), formatCsvCell(data.testTitle || 'Technical Assessment 2026')]);
    rows.push([formatCsvCell('Export Date:'), formatCsvCell(new Date().toLocaleString())]);
    rows.push([]);

    // Transposed Columns: Performance Metric | Section A | Section B | ... | OVERALL TOTAL
    const headerCols = ['Performance Metric', ...data.sectionRows.map(s => s.section), data.overallRow.section];
    rows.push(headerCols.map(c => formatCsvCell(c)));

    const rStudents = ['Total Students', ...data.sectionRows.map(s => s.enrolled), data.overallRow.enrolled];
    rows.push(rStudents.map(c => formatCsvCell(c)));

    const rAttended = ['Total Attended', ...data.sectionRows.map(s => s.attended), data.overallRow.attended];
    rows.push(rAttended.map(c => formatCsvCell(c)));

    const rPassed = ['Total Passed', ...data.sectionRows.map(s => s.passed), data.overallRow.passed];
    rows.push(rPassed.map(c => formatCsvCell(c)));

    const rPassPct = ['Pass Percentage', ...data.sectionRows.map(s => s.passPercentage), data.overallRow.passPercentage];
    rows.push(rPassPct.map(c => formatCsvCell(c)));

    const rAvgMark = ['Average Mark', ...data.sectionRows.map(s => s.averageMark), data.overallRow.averageMark];
    rows.push(rAvgMark.map(c => formatCsvCell(c)));

    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (data.testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${safeTitle}_Overall_Section_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // 2. Download Overall Section Summary Matrix as Excel (.XLSX) (Transposed)
  function downloadSectionMatrixExcel() {
    const data = getSectionSummaryMatrixData();
    if (typeof XLSX === 'undefined') {
      alert('Excel export engine is initializing. Please wait a moment or export as CSV.');
      return;
    }

    const headerCols = ['Performance Metric', ...data.sectionRows.map(s => s.section), data.overallRow.section];
    const rStudents = ['Total Students', ...data.sectionRows.map(s => s.enrolled), data.overallRow.enrolled];
    const rAttended = ['Total Attended', ...data.sectionRows.map(s => s.attended), data.overallRow.attended];
    const rPassed = ['Total Passed', ...data.sectionRows.map(s => s.passed), data.overallRow.passed];
    const rPassPct = ['Pass Percentage', ...data.sectionRows.map(s => s.passPercentage), data.overallRow.passPercentage];
    const rAvgMark = ['Average Mark', ...data.sectionRows.map(s => s.averageMark), data.overallRow.averageMark];

    const rows = [
      ['TECHNICAL ASSESSMENT - OVERALL SECTION PERFORMANCE SUMMARY'],
      ['Examination Title:', data.testTitle || 'Technical Assessment 2026'],
      ['Export Date:', new Date().toLocaleString()],
      [],
      headerCols,
      rStudents,
      rAttended,
      rPassed,
      rPassPct,
      rAvgMark
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = [{ wch: 22 }];
    for (let i = 1; i < headerCols.length; i++) {
      colWidths.push({ wch: 22 });
    }
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Section Summary');
    const safeTitle = (data.testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}_Overall_Section_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 3. Download Overall Section Summary Matrix as PDF (.PDF) (Transposed)
  function downloadSectionMatrixPDF() {
    const data = getSectionSummaryMatrixData();
    const headerCols = ['Performance Metric', ...data.sectionRows.map(s => s.section), data.overallRow.section];
    const rStudents = ['Total Students', ...data.sectionRows.map(s => s.enrolled), data.overallRow.enrolled];
    const rAttended = ['Total Attended', ...data.sectionRows.map(s => s.attended), data.overallRow.attended];
    const rPassed = ['Total Passed', ...data.sectionRows.map(s => s.passed), data.overallRow.passed];
    const rPassPct = ['Pass Percentage', ...data.sectionRows.map(s => s.passPercentage), data.overallRow.passPercentage];
    const rAvgMark = ['Average Mark', ...data.sectionRows.map(s => s.averageMark), data.overallRow.averageMark];

    const tableData = [
      rStudents,
      rAttended,
      rPassed,
      rPassPct,
      rAvgMark
    ];

    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('OVERALL SECTION PERFORMANCE SUMMARY', 40, 42);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Examination: ${data.testTitle || 'Technical Assessment 2026'}   |   Exported: ${new Date().toLocaleString()}`, 40, 60);

      doc.autoTable({
        head: [headerCols],
        body: tableData,
        startY: 78,
        styles: { fontSize: 9, cellPadding: 8, halign: 'center' },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 125 }
        },
        didParseCell: function(cellData) {
          // Highlight the OVERALL TOTAL column (last column)
          if (cellData.column.index === headerCols.length - 1 && cellData.section === 'body') {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.textColor = [37, 99, 235];
            cellData.cell.styles.fillColor = [239, 246, 255];
          }
        },
        theme: 'grid',
        margin: { left: 40, right: 40 }
      });

      const safeTitle = (data.testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${safeTitle}_Overall_Section_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
    } else {
      renderFallbackPrintReport(
        'Overall Section Performance Summary',
        `Examination: ${data.testTitle || 'Technical Assessment 2026'} | Exported: ${new Date().toLocaleString()}`,
        headerCols,
        tableData,
        []
      );
    }
  }

  // 4. Download All Submissions as CSV file (Centered summary, no summary header wordings)
  function downloadAllSubmissionsCSV() {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    if (!testSubs || testSubs.length === 0) {
      alert(`No student submissions found to export for "${testTitle}".`);
      return;
    }

    const rows = [];
    rows.push([formatCsvCell('TECHNICAL ASSESSMENT - ALL CANDIDATE SUBMISSIONS EXPORT')]);
    rows.push([formatCsvCell('Examination Title:'), formatCsvCell(testTitle || 'Technical Assessment 2026')]);
    rows.push([formatCsvCell('Total Submissions Recorded:'), formatCsvCell(testSubs.length)]);
    rows.push([formatCsvCell('Export Date:'), formatCsvCell(new Date().toLocaleString())]);
    rows.push([]);
    rows.push([
      formatCsvCell('#'),
      formatCsvCell('Register Number'),
      formatCsvCell('Candidate Name'),
      formatCsvCell('Department'),
      formatCsvCell('Section'),
      formatCsvCell('Obtained Marks'),
      formatCsvCell('Total Marks'),
      formatCsvCell('Percentage (%)'),
      formatCsvCell('Time Taken'),
      formatCsvCell('Security Warnings'),
      formatCsvCell('Submission Date & Time')
    ]);

    testSubs.forEach((sub, idx) => {
      let timeFormatted = 'N/A';
      if (sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      const warnCount = Number(sub.warning_count) || 0;
      const warnStatus = warnCount >= 3 ? `${warnCount} (Terminated)` : `${warnCount}`;

      rows.push([
        formatCsvCell(idx + 1),
        formatCsvCell(sub.reg_no),
        formatCsvCell(sub.student_name),
        formatCsvCell(sub.department),
        formatCsvCell(sub.section),
        formatCsvCell(sub.obtained_marks),
        formatCsvCell(sub.total_marks),
        formatCsvCell(`${sub.percentage}%`),
        formatCsvCell(timeFormatted),
        formatCsvCell(warnStatus),
        formatCsvCell(new Date(sub.submitted_at).toLocaleString())
      ]);
    });

    const stats = computeSummaryStatistics(testSubs, state.allStudents.length);

    // Bottom centered summary without header wordings
    rows.push([]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL STUDENTS:'), formatCsvCell(stats.totalEnrolled)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL STUDENTS ATTENDED:'), formatCsvCell(stats.totalAttended)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL PASSED STUDENTS:'), formatCsvCell(stats.totalPassed)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('PASS PERCENTAGE:'), formatCsvCell(`${stats.passPercentage}%`)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('MARK AVERAGE:'), formatCsvCell(stats.markAverageDisplay)]);

    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${safeTitle}_Submissions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // 2. Download All Submissions as Excel (.XLSX)
  function downloadAllSubmissionsExcel() {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    if (!testSubs || testSubs.length === 0) {
      alert(`No student submissions found to export for "${testTitle}".`);
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Excel export engine is initializing. Please wait a moment or export as CSV.');
      return;
    }

    const rows = [
      ['TECHNICAL ASSESSMENT - ALL CANDIDATE SUBMISSIONS EXPORT'],
      ['Examination Title:', testTitle || 'Technical Assessment 2026'],
      ['Total Submissions Recorded:', testSubs.length],
      ['Export Date:', new Date().toLocaleString()],
      [],
      [
        '#',
        'Register Number',
        'Candidate Name',
        'Department',
        'Section',
        'Obtained Marks',
        'Total Marks',
        'Percentage (%)',
        'Time Taken',
        'Security Warnings',
        'Submission Date & Time'
      ]
    ];

    testSubs.forEach((sub, idx) => {
      let timeFormatted = 'N/A';
      if (sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      const warnCount = Number(sub.warning_count) || 0;
      const warnStatus = warnCount >= 3 ? `${warnCount} (Terminated)` : `${warnCount}`;

      rows.push([
        idx + 1,
        sub.reg_no,
        sub.student_name,
        sub.department,
        sub.section,
        Number(sub.obtained_marks) || 0,
        Number(sub.total_marks) || 0,
        `${sub.percentage}%`,
        timeFormatted,
        warnStatus,
        new Date(sub.submitted_at).toLocaleString()
      ]);
    });

    const stats = computeSummaryStatistics(testSubs, state.allStudents.length);

    // Centered Summary Rows
    rows.push([]);
    rows.push(['', '', '', '', 'TOTAL STUDENTS:', stats.totalEnrolled]);
    rows.push(['', '', '', '', 'TOTAL STUDENTS ATTENDED:', stats.totalAttended]);
    rows.push(['', '', '', '', 'TOTAL PASSED STUDENTS:', stats.totalPassed]);
    rows.push(['', '', '', '', 'PASS PERCENTAGE:', `${stats.passPercentage}%`]);
    rows.push(['', '', '', '', 'MARK AVERAGE:', stats.markAverageDisplay]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 26 },
      { wch: 26 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
    const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${safeTitle}_Submissions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 3. Download All Submissions as PDF (.PDF)
  function downloadAllSubmissionsPDF() {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    if (!testSubs || testSubs.length === 0) {
      alert(`No student submissions found to export for "${testTitle}".`);
      return;
    }

    const stats = computeSummaryStatistics(testSubs, state.allStudents.length);
    const summaryList = [
      ['TOTAL STUDENTS:', stats.totalEnrolled],
      ['TOTAL STUDENTS ATTENDED:', stats.totalAttended],
      ['TOTAL PASSED STUDENTS:', stats.totalPassed],
      ['PASS PERCENTAGE:', `${stats.passPercentage}%`],
      ['MARK AVERAGE:', stats.markAverageDisplay]
    ];

    const tableHeaders = ['#', 'Reg No', 'Candidate Name', 'Dept', 'Sec', 'Score', 'Total', 'Pct', 'Time', 'Warnings', 'Submitted At'];
    const tableData = testSubs.map((sub, idx) => {
      let timeFormatted = 'N/A';
      if (sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }
      const warnCount = Number(sub.warning_count) || 0;
      const warnStatus = warnCount >= 3 ? `${warnCount} (Term)` : `${warnCount}`;

      return [
        idx + 1,
        sub.reg_no,
        sub.student_name,
        sub.department,
        sub.section,
        sub.obtained_marks,
        sub.total_marks,
        `${sub.percentage}%`,
        timeFormatted,
        warnStatus,
        new Date(sub.submitted_at).toLocaleDateString() + ' ' + new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      ];
    });

    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text('TECHNICAL ASSESSMENT - ALL CANDIDATE SUBMISSIONS', 40, 38);

      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Examination: ${testTitle || 'Technical Assessment 2026'}   |   Total Candidates: ${testSubs.length}   |   Exported: ${new Date().toLocaleString()}`, 40, 54);

      doc.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: 68,
        styles: { fontSize: 8, cellPadding: 3.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
        margin: { left: 40, right: 40 }
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : 300;
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = finalY;

      if (finalY + 120 > pageHeight) {
        doc.addPage();
        currentY = 40;
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = 320;
      const startX = (pageWidth - tableWidth) / 2;

      doc.autoTable({
        body: summaryList,
        startY: currentY,
        margin: { left: startX },
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', fillColor: [241, 245, 249], cellWidth: 190 },
          1: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 130 }
        },
        theme: 'plain'
      });

      const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${safeTitle}_Submissions_${new Date().toISOString().slice(0, 10)}.pdf`);
    } else {
      renderFallbackPrintReport(
        'Technical Assessment - All Submissions Report',
        `Examination: ${testTitle || 'Technical Assessment 2026'} | Total: ${testSubs.length} | Export Date: ${new Date().toLocaleString()}`,
        tableHeaders,
        tableData,
        summaryList
      );
    }
  }

  // 4. Download Section Report as CSV file (Centered summary, no summary header wordings)
  function downloadSectionReportCSV(sec) {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    const enrolledStudents = state.allStudents.filter(s => s.section === sec);
    if (enrolledStudents.length === 0) {
      alert(`No students found for Section ${sec}.`);
      return;
    }

    const completedSubs = testSubs.filter(s => s.section === sec);
    const subMap = new Map();
    completedSubs.forEach(sub => {
      subMap.set(sub.reg_no.toUpperCase(), sub);
    });

    const rows = [];
    rows.push([formatCsvCell(`TECHNICAL ASSESSMENT - SECTION ${sec} CANDIDATE PERFORMANCE REPORT`)]);
    rows.push([formatCsvCell('Examination Title:'), formatCsvCell(testTitle || 'Technical Assessment 2026')]);
    rows.push([formatCsvCell('Section:'), formatCsvCell(`Section ${sec}`)]);
    rows.push([formatCsvCell('Total Enrolled Students:'), formatCsvCell(enrolledStudents.length)]);
    rows.push([formatCsvCell('Completed Submissions:'), formatCsvCell(completedSubs.length)]);
    rows.push([formatCsvCell('Pending Candidates:'), formatCsvCell(enrolledStudents.length - completedSubs.length)]);
    rows.push([formatCsvCell('Export Date:'), formatCsvCell(new Date().toLocaleString())]);
    rows.push([]);
    rows.push([
      formatCsvCell('#'),
      formatCsvCell('Register Number'),
      formatCsvCell('Candidate Name'),
      formatCsvCell('Department'),
      formatCsvCell('Section'),
      formatCsvCell('Status'),
      formatCsvCell('Obtained Marks'),
      formatCsvCell('Total Marks'),
      formatCsvCell('Percentage (%)'),
      formatCsvCell('Time Taken'),
      formatCsvCell('Security Warnings'),
      formatCsvCell('Submission Date & Time')
    ]);

    enrolledStudents.forEach((s, idx) => {
      const sub = subMap.get(s.reg_no.toUpperCase());
      const isCompleted = !!sub;

      let timeFormatted = '—';
      if (isCompleted && sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      let warnCell = '—';
      if (isCompleted) {
        const warnCount = Number(sub.warning_count) || 0;
        warnCell = warnCount >= 3 ? `${warnCount} (Terminated)` : `${warnCount}`;
      }

      rows.push([
        formatCsvCell(idx + 1),
        formatCsvCell(s.reg_no),
        formatCsvCell(s.name),
        formatCsvCell(s.department),
        formatCsvCell(s.section),
        formatCsvCell(isCompleted ? 'Completed' : 'Pending'),
        formatCsvCell(isCompleted ? sub.obtained_marks : '—'),
        formatCsvCell(isCompleted ? sub.total_marks : '—'),
        formatCsvCell(isCompleted ? `${sub.percentage}%` : '—'),
        formatCsvCell(timeFormatted),
        formatCsvCell(warnCell),
        formatCsvCell(isCompleted ? new Date(sub.submitted_at).toLocaleString() : 'Not Attempted')
      ]);
    });

    const stats = computeSummaryStatistics(completedSubs, enrolledStudents.length);

    // Bottom centered summary without header wordings
    rows.push([]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL STUDENTS:'), formatCsvCell(stats.totalEnrolled)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL STUDENTS ATTENDED:'), formatCsvCell(stats.totalAttended)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('TOTAL PASSED STUDENTS:'), formatCsvCell(stats.totalPassed)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('PASS PERCENTAGE:'), formatCsvCell(`${stats.passPercentage}%`)]);
    rows.push([formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell(''), formatCsvCell('MARK AVERAGE:'), formatCsvCell(stats.markAverageDisplay)]);

    const csvContent = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `Section_${sec}_${safeTitle}_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // 5. Download Section Report as Excel (.XLSX)
  function downloadSectionReportExcel(sec) {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    const enrolledStudents = state.allStudents.filter(s => s.section === sec);
    if (enrolledStudents.length === 0) {
      alert(`No students found for Section ${sec}.`);
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Excel export engine is initializing. Please wait a moment or export as CSV.');
      return;
    }

    const completedSubs = testSubs.filter(s => s.section === sec);
    const subMap = new Map();
    completedSubs.forEach(sub => {
      subMap.set(sub.reg_no.toUpperCase(), sub);
    });

    const rows = [
      [`TECHNICAL ASSESSMENT - SECTION ${sec} CANDIDATE PERFORMANCE REPORT`],
      ['Examination Title:', testTitle || 'Technical Assessment 2026'],
      ['Section:', `Section ${sec}`],
      ['Total Enrolled Students:', enrolledStudents.length],
      ['Completed Submissions:', completedSubs.length],
      ['Pending Candidates:', enrolledStudents.length - completedSubs.length],
      ['Export Date:', new Date().toLocaleString()],
      [],
      [
        '#',
        'Register Number',
        'Candidate Name',
        'Department',
        'Section',
        'Status',
        'Obtained Marks',
        'Total Marks',
        'Percentage (%)',
        'Time Taken',
        'Security Warnings',
        'Submission Date & Time'
      ]
    ];

    enrolledStudents.forEach((s, idx) => {
      const sub = subMap.get(s.reg_no.toUpperCase());
      const isCompleted = !!sub;

      let timeFormatted = '—';
      if (isCompleted && sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      let warnCell = '—';
      if (isCompleted) {
        const warnCount = Number(sub.warning_count) || 0;
        warnCell = warnCount >= 3 ? `${warnCount} (Terminated)` : `${warnCount}`;
      }

      rows.push([
        idx + 1,
        s.reg_no,
        s.name,
        s.department,
        s.section,
        isCompleted ? 'Completed' : 'Pending',
        isCompleted ? (Number(sub.obtained_marks) || 0) : '—',
        isCompleted ? (Number(sub.total_marks) || 0) : '—',
        isCompleted ? `${sub.percentage}%` : '—',
        timeFormatted,
        warnCell,
        isCompleted ? new Date(sub.submitted_at).toLocaleString() : 'Not Attempted'
      ]);
    });

    const stats = computeSummaryStatistics(completedSubs, enrolledStudents.length);

    // Centered Summary Rows
    rows.push([]);
    rows.push(['', '', '', '', 'TOTAL STUDENTS:', stats.totalEnrolled]);
    rows.push(['', '', '', '', 'TOTAL STUDENTS ATTENDED:', stats.totalAttended]);
    rows.push(['', '', '', '', 'TOTAL PASSED STUDENTS:', stats.totalPassed]);
    rows.push(['', '', '', '', 'PASS PERCENTAGE:', `${stats.passPercentage}%`]);
    rows.push(['', '', '', '', 'MARK AVERAGE:', stats.markAverageDisplay]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 26 },
      { wch: 26 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Section_${sec}`);
    const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Section_${sec}_${safeTitle}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // 6. Download Section Report as PDF (.PDF)
  function downloadSectionReportPDF(sec) {
    const analyzingTest = getAnalyzingTest();
    const testSubs = (analyzingTest && Array.isArray(analyzingTest.submissions))
      ? analyzingTest.submissions
      : state.submissions;
    const testTitle = analyzingTest ? analyzingTest.title : state.testTitle;

    const enrolledStudents = state.allStudents.filter(s => s.section === sec);
    if (enrolledStudents.length === 0) {
      alert(`No students found for Section ${sec}.`);
      return;
    }

    const completedSubs = testSubs.filter(s => s.section === sec);
    const subMap = new Map();
    completedSubs.forEach(sub => {
      subMap.set(sub.reg_no.toUpperCase(), sub);
    });

    const stats = computeSummaryStatistics(completedSubs, enrolledStudents.length);
    const summaryList = [
      ['TOTAL STUDENTS:', stats.totalEnrolled],
      ['TOTAL STUDENTS ATTENDED:', stats.totalAttended],
      ['TOTAL PASSED STUDENTS:', stats.totalPassed],
      ['PASS PERCENTAGE:', `${stats.passPercentage}%`],
      ['MARK AVERAGE:', stats.markAverageDisplay]
    ];

    const tableHeaders = ['#', 'Reg No', 'Candidate Name', 'Dept', 'Sec', 'Status', 'Score', 'Total', 'Pct', 'Time', 'Warnings', 'Submitted At'];
    const tableData = enrolledStudents.map((s, idx) => {
      const sub = subMap.get(s.reg_no.toUpperCase());
      const isCompleted = !!sub;

      let timeFormatted = '—';
      if (isCompleted && sub.time_taken_seconds !== undefined) {
        const mins = Math.floor(sub.time_taken_seconds / 60);
        const secs = sub.time_taken_seconds % 60;
        timeFormatted = `${mins}m ${secs}s`;
      }

      let warnCell = '—';
      if (isCompleted) {
        const warnCount = Number(sub.warning_count) || 0;
        warnCell = warnCount >= 3 ? `${warnCount} (Term)` : `${warnCount}`;
      }

      return [
        idx + 1,
        s.reg_no,
        s.name,
        s.department,
        s.section,
        isCompleted ? 'Completed' : 'Pending',
        isCompleted ? sub.obtained_marks : '—',
        isCompleted ? sub.total_marks : '—',
        isCompleted ? `${sub.percentage}%` : '—',
        timeFormatted,
        warnCell,
        isCompleted ? (new Date(sub.submitted_at).toLocaleDateString() + ' ' + new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : 'Not Attempted'
      ];
    });

    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(`TECHNICAL ASSESSMENT - SECTION ${sec} CANDIDATE REPORT`, 40, 38);

      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Examination: ${testTitle || 'Technical Assessment 2026'}   |   Section ${sec} (${enrolledStudents.length} Students)   |   Exported: ${new Date().toLocaleString()}`, 40, 54);

      doc.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: 68,
        styles: { fontSize: 8, cellPadding: 3.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
        margin: { left: 40, right: 40 }
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : 300;
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = finalY;

      if (finalY + 120 > pageHeight) {
        doc.addPage();
        currentY = 40;
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = 320;
      const startX = (pageWidth - tableWidth) / 2;

      doc.autoTable({
        body: summaryList,
        startY: currentY,
        margin: { left: startX },
        tableWidth: tableWidth,
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', fillColor: [241, 245, 249], cellWidth: 190 },
          1: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 130 }
        },
        theme: 'plain'
      });

      const safeTitle = (testTitle || 'Assessment').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Section_${sec}_${safeTitle}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } else {
      renderFallbackPrintReport(
        `Technical Assessment - Section ${sec} Report`,
        `Examination: ${testTitle || 'Technical Assessment 2026'} | Section: Section ${sec} | Export Date: ${new Date().toLocaleString()}`,
        tableHeaders,
        tableData,
        summaryList
      );
    }
  }

  // 7. Universal fallback report printer (Native Browser PDF)
  function renderFallbackPrintReport(title, subtitle, headers, rowsData, summaryList) {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Report popup window was blocked by your browser. Please allow popups or download Excel / CSV.');
      return;
    }
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1e293b; font-size: 11px; }
    h2 { margin: 0 0 4px 0; color: #0f172a; font-size: 16px; }
    p.meta { margin: 0 0 16px 0; color: #64748b; font-size: 11px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10px; }
    table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
    table.data-table th { background: #2563eb; color: #ffffff; font-weight: 600; }
    table.data-table tr:nth-child(even) { background: #f8fafc; }
    .summary-box { margin: 20px auto; width: 340px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .summary-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .summary-table td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }
    .summary-table tr:last-child td { border-bottom: none; }
    .summary-table td.label { font-weight: 600; color: #475569; background: #f8fafc; width: 60%; }
    .summary-table td.val { text-align: center; font-weight: 700; color: #2563eb; width: 40%; }
    @media print {
      @page { size: landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p class="meta">${subtitle}</p>
  <table class="data-table">
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rowsData.map(r => `<tr>${r.map(c => `<td>${c !== undefined && c !== null ? c : ''}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  ${(summaryList && summaryList.length > 0) ? `
  <div class="summary-box">
    <table class="summary-table">
      <tbody>
        ${summaryList.map(item => `<tr><td class="label">${item[0]}</td><td class="val">${item[1]}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  <\/script>
</body>
</html>`;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }

  // ========================================================
  // 9. HELPERS & UTILITIES
  // ========================================================

  function showCustomAlert(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert-danger';
    el.style.display = 'block';
  }

  function hideAlert(el) {
    if (el) el.style.display = 'none';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on page ready
  init();

})();
