// ========================================================================
// 1. DATE, CURRENCY & HELPER UTILITIES (FAST OFFLINE-FIRST ENGINE)
// =========================================================================
const ADMIN_ID = 'admin';
const ADMIN_PASS = 'admin@123';
const STORAGE_KEY = 'century_karkhano_v4_data';
const SESSION_KEY = 'century_karkhano_v4_session';

const GUJARATI_MONTHS = [
  'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
  'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'
];
const GUJARATI_WEEKDAYS = [
  'રવિવાર', 'સોમવાર', 'મંગળવાર', 'બુધવાર', 'ગુરુવાર', 'શુક્રવાર', 'શનિવાર'
];

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentMonthISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getGujaratiWeekday(dateObj) {
  return GUJARATI_WEEKDAYS[dateObj.getDay()] || '';
}

function formatGujaratiDate(dateISO) {
  if (!dateISO || !dateISO.includes('-')) return dateISO || '';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const monthName = GUJARATI_MONTHS[m - 1] || '';
  const weekday = getGujaratiWeekday(dateObj);
  return `${d} ${monthName} ${y} (${weekday})`;
}

function formatGujaratiMonthYear(monthISO) {
  if (!monthISO || !monthISO.includes('-')) return monthISO || '';
  const [y, m] = monthISO.split('-').map(Number);
  const monthName = GUJARATI_MONTHS[m - 1] || '';
  return `${monthName} ${y}`;
}

function getGujaratiTimestamp() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  let hrs = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12 || 12;
  return `${d}/${m}/${y} ${hrs}:${mins} ${ampm}`;
}

function roundMoney(val) {
  const num = Number(val) || 0;
  return Math.round(num * 100) / 100;
}

function formatRupees(amount) {
  const rounded = roundMoney(amount);
  return '₹' + rounded.toLocaleString('en-IN', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colors =
    type === 'error'
      ? 'bg-red-600 text-white border-red-400'
      : type === 'info'
      ? 'bg-slate-900 text-amber-300 border-amber-500/50'
      : 'bg-emerald-600 text-white border-emerald-400';

  toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl text-xs font-extrabold transition-all duration-300 ${colors}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!modal) return;
  titleEl.textContent = title;
  msgEl.textContent = message;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const cleanup = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  cancelBtn.onclick = cleanup;
  okBtn.onclick = () => {
    cleanup();
    if (typeof onConfirm === 'function') onConfirm();
  };
}

// =========================================================================
// 2. APPLICATION STATE & STORAGE / CLOUD SYNC
// =========================================================================
const state = {
  isAuthenticated: false,
  currentUser: ADMIN_ID,
  activeTab: 'dashboard',
  selectedDate: getTodayISO(),
  selectedMonth: getCurrentMonthISO(),
  lastSavedAt: getGujaratiTimestamp(),
  noteSearchQuery: '',
  noteFilterCategory: 'All',
  workers: [],
  attendance: {},
  notes: [],
  logs: [],
};

let deferredInstallPrompt = null;

function saveToDeviceStorage() {
  state.lastSavedAt = getGujaratiTimestamp();
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workers: state.workers,
        attendance: state.attendance,
        notes: state.notes,
        logs: state.logs,
        lastSavedAt: state.lastSavedAt,
      })
    );
  } catch (err) {
    console.warn('Storage write skipped:', err);
  }
}

function loadFromDeviceStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.workers)) state.workers = parsed.workers;
      if (parsed.attendance && typeof parsed.attendance === 'object') state.attendance = parsed.attendance;
      if (Array.isArray(parsed.notes)) state.notes = parsed.notes;
      if (Array.isArray(parsed.logs)) state.logs = parsed.logs;
      if (parsed.lastSavedAt) state.lastSavedAt = parsed.lastSavedAt;
      return true;
    }
  } catch (err) {
    console.warn('Storage read skipped:', err);
  }
  return false;
}

function seedStarterDataIfEmpty() {
  if (state.workers.length > 0 || state.notes.length > 0) return;
  const today = getTodayISO();
  state.workers = [
    {
      id: 'w_demo_1',
      name: 'રમેશભાઈ પટેલ',
      role: 'મશીન ઓપરેટર',
      dailyRate: 800,
      otRate: 100,
      phone: '98250 11223',
      savedBy: 'admin',
      createdAtMs: Date.now() - 3000,
    },
    {
      id: 'w_demo_2',
      name: 'સુરેશભાઈ પ્રજાપતિ',
      role: 'કારીગર',
      dailyRate: 700,
      otRate: 90,
      phone: '98790 44556',
      savedBy: 'admin',
      createdAtMs: Date.now() - 2000,
    },
    {
      id: 'w_demo_3',
      name: 'મહેશભાઈ ઠાકોર',
      role: 'હેલ્પર',
      dailyRate: 550,
      otRate: 70,
      phone: '97240 77889',
      savedBy: 'admin',
      createdAtMs: Date.now() - 1000,
    },
  ];
  state.attendance[today] = {
    w_demo_1: { status: 'P', otHours: 2, savedBy: 'admin' },
    w_demo_2: { status: 'P', otHours: 1, savedBy: 'admin' },
    w_demo_3: { status: 'P', otHours: 0, savedBy: 'admin' },
  };
  state.notes = [
    {
      id: 'n_demo_1',
      title: 'કાચો માલ અને પેકિંગ બોક્સ',
      category: 'માલ / સ્ટોક',
      content: 'કાલે સવારે 200 કિલો રો-મટીરીયલ અને 50 પેકિંગ બોક્સ મંગાવવાના છે.',
      updatedAt: getGujaratiTimestamp(),
      savedBy: 'admin',
      createdAtMs: Date.now(),
    },
  ];
  saveToDeviceStorage();
}

function getWorkerDayRecord(dateISO, workerId) {
  const dayMap = state.attendance[dateISO] || {};
  const entry = dayMap[workerId];
  if (!entry) return { status: '', otHours: 0, savedBy: '' };
  if (typeof entry === 'string') return { status: entry, otHours: 0, savedBy: '' };
  return {
    status: entry.status || '',
    otHours: Number(entry.otHours) || 0,
    savedBy: entry.savedBy || '',
  };
}

function calculateWorkerEarnings(worker, rec) {
  const dailyRate = Number(worker.dailyRate) || 0;
  const otRate = Number(worker.otRate) || 0;
  let shiftPay = 0;
  if (rec.status === 'P') shiftPay = roundMoney(dailyRate);
  else if (rec.status === 'H') shiftPay = roundMoney(dailyRate * 0.5);

  const otPay = roundMoney((Number(rec.otHours) || 0) * otRate);
  return {
    shiftPay,
    otPay,
    totalPay: roundMoney(shiftPay + otPay),
  };
}

function refreshActiveView() {
  if (!state.isAuthenticated) return;
  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'attendance') renderAttendancePage();
  if (state.activeTab === 'monthly') renderMonthlyPage();
  if (state.activeTab === 'notes') renderNotesPage();
  if (state.activeTab === 'records') renderRecordsPage();
}

function recordAuditLog(action, detail) {
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    action,
    detail,
    user: state.currentUser || ADMIN_ID,
    timestamp: getGujaratiTimestamp(),
    createdAtMs: Date.now(),
  };
  state.logs.unshift(logEntry);
  if (state.logs.length > 200) state.logs.length = 200;
  saveToDeviceStorage();
}

function saveSingleWorkerToCloud(workerObj, logMessage) {
  const idx = state.workers.findIndex((w) => w.id === workerObj.id);
  if (idx >= 0) state.workers[idx] = workerObj;
  else state.workers.push(workerObj);
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('કારીગર સેવ', logMessage);
}

function deleteWorkerFromCloud(workerId, logMessage) {
  state.workers = state.workers.filter((w) => w.id !== workerId);
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('કારીગર ડિલીટ', logMessage);
}

function saveDateAttendanceToCloud(dateISO, logMessage) {
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('હાજરી સેવ', logMessage);
}

function deleteDateAttendanceFromCloud(dateISO, logMessage) {
  delete state.attendance[dateISO];
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('હાજરી ડિલીટ', logMessage);
}

function saveSingleNoteToCloud(noteObj, logMessage) {
  const idx = state.notes.findIndex((n) => n.id === noteObj.id);
  if (idx >= 0) state.notes[idx] = noteObj;
  else state.notes.unshift(noteObj);
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('નોંધ સેવ', logMessage);
}

function deleteNoteFromCloud(noteId, logMessage) {
  state.notes = state.notes.filter((n) => n.id !== noteId);
  saveToDeviceStorage();
  if (logMessage) recordAuditLog('નોંધ ડિલીટ', logMessage);
}

function updateStorageBadge() {
  const dot = document.getElementById('cloud-sync-dot');
  const label = document.getElementById('cloud-sync-label');
  const recStatus = document.getElementById('records-cloud-status');
  const recUid = document.getElementById('records-device-uid');

  if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  if (label) label.textContent = 'ઓટો-સેવ ચાલુ';
  if (recStatus) recStatus.textContent = 'બધો ડેટા ઓટોમેટિક સેવ થાય છે';
  if (recUid) recUid.textContent = 'LOCAL-AUTO-SAVE';
}
}

function loadFromDeviceStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.workers)) state.workers = parsed.workers;
      if (parsed.attendance && typeof parsed.attendance === 'object') state.attendance = parsed.attendance;
      if (Array.isArray(parsed.notes)) state.notes = parsed.notes;
      if (Array.isArray(parsed.logs)) state.logs = parsed.logs;
      if (parsed.lastSavedAt) state.lastSavedAt = parsed.lastSavedAt;
      return true;
    }
  } catch (err) {
    console.warn('Storage read skipped:', err);
  }
  return false;
}

function seedStarterDataIfEmpty() {
  if (state.workers.length > 0 || state.notes.length > 0) return;
  const today = getTodayISO();
  state.workers = [
    {
      id: 'w_demo_1',
      name: 'રમેશભાઈ પટેલ',
      role: 'મશીન ઓપરેટર',
      dailyRate: 800,
      otRate: 100,
      phone: '98250 11223',
      savedBy: 'admin',
      createdAtMs: Date.now() - 3000,
    },
    {
      id: 'w_demo_2',
      name: 'સુરેશભાઈ પ્રજાપતિ',
      role: 'કારીગર',
      dailyRate: 700,
      otRate: 90,
      phone: '98790 44556',
      savedBy: 'admin',
      createdAtMs: Date.now() - 2000,
    },
    {
      id: 'w_demo_3',
      name: 'મહેશભાઈ ઠાકોર',
      role: 'હેલ્પર',
      dailyRate: 550,
      otRate: 70,
      phone: '97240 77889',
      savedBy: 'admin',
      createdAtMs: Date.now() - 1000,
    },
  ];
  state.attendance[today] = {
    w_demo_1: { status: 'P', otHours: 2, savedBy: 'admin' },
    w_demo_2: { status: 'P', otHours: 1, savedBy: 'admin' },
    w_demo_3: { status: 'P', otHours: 0, savedBy: 'admin' },
  };
  state.notes = [
    {
      id: 'n_demo_1',
      title: 'કાચો માલ અને પેકિંગ બોક્સ',
      category: 'માલ / સ્ટોક',
      content: 'કાલે સવારે 200 કિલો રો-મટીરીયલ અને 50 પેકિંગ બોક્સ મંગાવવાના છે.',
      updatedAt: getGujaratiTimestamp(),
      savedBy: 'admin',
      createdAtMs: Date.now(),
    },
  ];
  saveToDeviceStorage();
}

function getSharedCollection(colName) {
  return collection(db, 'artifacts', appId, 'public', 'data', colName);
}

function getSharedDoc(colName, docId) {
  return doc(db, 'artifacts', appId, 'public', 'data', colName, docId);
}

function getWorkerDayRecord(dateISO, workerId) {
  const dayMap = state.attendance[dateISO] || {};
  const entry = dayMap[workerId];
  if (!entry) return { status: '', otHours: 0, savedBy: '' };
  if (typeof entry === 'string') return { status: entry, otHours: 0, savedBy: '' };
  return {
    status: entry.status || '',
    otHours: Number(entry.otHours) || 0,
    savedBy: entry.savedBy || '',
  };
}

function calculateWorkerEarnings(worker, rec) {
  const dailyRate = Number(worker.dailyRate) || 0;
  const otRate = Number(worker.otRate) || 0;
  let shiftPay = 0;
  if (rec.status === 'P') shiftPay = roundMoney(dailyRate);
  else if (rec.status === 'H') shiftPay = roundMoney(dailyRate * 0.5);

  const otPay = roundMoney((Number(rec.otHours) || 0) * otRate);
  return {
    shiftPay,
    otPay,
    totalPay: roundMoney(shiftPay + otPay),
  };
}

function refreshActiveView() {
  if (!state.isAuthenticated) return;
  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'attendance') renderAttendancePage();
  if (state.activeTab === 'monthly') renderMonthlyPage();
  if (state.activeTab === 'notes') renderNotesPage();
  if (state.activeTab === 'records') renderRecordsPage();
}

async function recordAuditLog(action, detail) {
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    action,
    detail,
    user: state.currentUser || ADMIN_ID,
    timestamp: getGujaratiTimestamp(),
    createdAtMs: Date.now(),
  };
  state.logs.unshift(logEntry);
  if (state.logs.length > 200) state.logs.length = 200;
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await setDoc(getSharedDoc('karkhano_logs', logEntry.id), logEntry);
    } catch (err) {
      console.warn('Cloud log sync skipped:', err);
    }
  }
}

async function saveSingleWorkerToCloud(workerObj, logMessage) {
  const idx = state.workers.findIndex((w) => w.id === workerObj.id);
  if (idx >= 0) state.workers[idx] = workerObj;
  else state.workers.push(workerObj);
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await setDoc(getSharedDoc('karkhano_workers', workerObj.id), workerObj);
    } catch (err) {
      console.warn('Cloud worker save skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('કારીગર સેવ', logMessage);
}

async function deleteWorkerFromCloud(workerId, logMessage) {
  state.workers = state.workers.filter((w) => w.id !== workerId);
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await deleteDoc(getSharedDoc('karkhano_workers', workerId));
    } catch (err) {
      console.warn('Cloud worker delete skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('કારીગર ડિલીટ', logMessage);
}

async function saveDateAttendanceToCloud(dateISO, logMessage) {
  const recordsForDate = state.attendance[dateISO] || {};
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await setDoc(getSharedDoc('karkhano_attendance', dateISO), {
        dateISO,
        records: recordsForDate,
        updatedAt: state.lastSavedAt,
        updatedBy: state.currentUser || ADMIN_ID,
      });
    } catch (err) {
      console.warn('Cloud attendance save skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('હાજરી સેવ', logMessage);
}

async function deleteDateAttendanceFromCloud(dateISO, logMessage) {
  delete state.attendance[dateISO];
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await deleteDoc(getSharedDoc('karkhano_attendance', dateISO));
    } catch (err) {
      console.warn('Cloud attendance delete skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('હાજરી ડિલીટ', logMessage);
}

async function saveSingleNoteToCloud(noteObj, logMessage) {
  const idx = state.notes.findIndex((n) => n.id === noteObj.id);
  if (idx >= 0) state.notes[idx] = noteObj;
  else state.notes.unshift(noteObj);
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await setDoc(getSharedDoc('karkhano_notes', noteObj.id), noteObj);
    } catch (err) {
      console.warn('Cloud note save skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('નોંધ સેવ', logMessage);
}

async function deleteNoteFromCloud(noteId, logMessage) {
  state.notes = state.notes.filter((n) => n.id !== noteId);
  saveToDeviceStorage();

  if (cloudReady && cloudUser) {
    try {
      await deleteDoc(getSharedDoc('karkhano_notes', noteId));
    } catch (err) {
      console.warn('Cloud note delete skipped:', err);
    }
  }
  if (logMessage) await recordAuditLog('નોંધ ડિલીટ', logMessage);
}

function updateCloudBadge(isOnline, uidText) {
  const dot = document.getElementById('cloud-sync-dot');
  const label = document.getElementById('cloud-sync-label');
  const recStatus = document.getElementById('records-cloud-status');
  const recUid = document.getElementById('records-device-uid');

  if (isOnline) {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (label) label.textContent = 'લાઇવ ક્લાઉડ સિંક ચાલુ';
    if (recStatus) recStatus.textContent = 'લાઇવ ક્લાઉડ સિંક ચાલુ છે';
    if (recUid && uidText) recUid.textContent = uidText.slice(0, 12);
  } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (label) label.textContent = 'લોકલ સેવ ચાલુ';
    if (recStatus) recStatus.textContent = 'ફોન/કોમ્પ્યુટરમાં ઓટો-સેવ ચાલુ છે';
  }
}

async function initCloudSync() {
  if (!rawFirebaseConfig) {
    updateCloudBadge(false);
    return;
  }

  try {
    const parsedConfig = typeof rawFirebaseConfig === 'string' ? JSON.parse(rawFirebaseConfig) : rawFirebaseConfig;
    const fbApp = initializeApp(parsedConfig);
    auth = getAuth(fbApp);
    db = getFirestore(fbApp);

    const authPromise = initialAuthToken
      ? signInWithCustomToken(auth, initialAuthToken)
      : signInAnonymously(auth);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));

    const cred = await Promise.race([authPromise, timeoutPromise]);
    cloudUser = cred.user;
    if (!cloudUser) return;

    cloudReady = true;
    updateCloudBadge(true, cloudUser.uid);

    onSnapshot(getSharedCollection('karkhano_workers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
      if (list.length > 0) {
        state.workers = list;
        saveToDeviceStorage();
      }
      refreshActiveView();
    });

    onSnapshot(getSharedCollection('karkhano_attendance'), (snap) => {
      const cloudAttendance = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data && data.dateISO && data.records) {
          cloudAttendance[data.dateISO] = data.records;
        }
      });
      state.attendance = { ...state.attendance, ...cloudAttendance };
      saveToDeviceStorage();
      refreshActiveView();
    });

    onSnapshot(getSharedCollection('karkhano_notes'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      if (list.length > 0) {
        state.notes = list;
        saveToDeviceStorage();
      }
      refreshActiveView();
    });

    onSnapshot(getSharedCollection('karkhano_logs'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      state.logs = list.slice(0, 200);
      saveToDeviceStorage();
      if (state.isAuthenticated && state.activeTab === 'records') renderRecordsPage();
    });
  } catch (err) {
    updateCloudBadge(false);
  }
}

// =========================================================================
// 3. AUTHENTICATION & ONE-TIME LOGIN PERSISTENCE
// =========================================================================
function savePersistentLoginSession(userDisplayName) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        isAuthenticated: true,
        currentUser: userDisplayName || ADMIN_ID,
        loggedInAt: Date.now(),
      })
    );
  } catch (err) {
    console.warn('Session storage skipped:', err);
  }
}

function clearPersistentLoginSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn('Session clear skipped:', err);
  }
}

function restorePersistentLoginSession() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autologin') === '1') {
      const staffName = urlParams.get('user') || 'કારખાના સ્ટાફ (admin)';
      state.isAuthenticated = true;
      state.currentUser = staffName;
      savePersistentLoginSession(staffName);
      return true;
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isAuthenticated === true) {
        state.isAuthenticated = true;
        state.currentUser = parsed.currentUser || ADMIN_ID;
        return true;
      }
    }
  } catch (err) {
    console.warn('Session restore skipped:', err);
  }
  return false;
}

function updateAuthUI() {
  const loginView = document.getElementById('login-view');
  const appShell = document.getElementById('app-shell');

  if (state.isAuthenticated) {
    loginView.classList.add('hidden');
    appShell.classList.remove('hidden');
    appShell.classList.add('flex');
    const userLabel = document.getElementById('active-user-label');
    if (userLabel) userLabel.textContent = `લોગિન: ${state.currentUser}`;
    switchTab(state.activeTab);
  } else {
    appShell.classList.add('hidden');
    appShell.classList.remove('flex');
    loginView.classList.remove('hidden');
  }
}

function setupLoginEvents() {
  const loginForm = document.getElementById('login-form');
  const loginIdInput = document.getElementById('login-id');
  const loginPassInput = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const loginErrorText = document.getElementById('login-error-text');
  const quickFillBtn = document.getElementById('quick-fill-btn');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const logoutBtn = document.getElementById('logout-btn');

  quickFillBtn.addEventListener('click', () => {
    const opInput = document.getElementById('login-operator-name');
    if (opInput && !opInput.value.trim()) opInput.value = 'મુખ્ય એડમિન';
    loginIdInput.value = ADMIN_ID;
    loginPassInput.value = ADMIN_PASS;
    loginError.classList.add('hidden');
    showToast('એડમિન ID અને પાસવર્ડ ભરાઈ ગયા છે', 'info');
  });

  togglePassBtn.addEventListener('click', () => {
    loginPassInput.type = loginPassInput.type === 'password' ? 'text' : 'password';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const operatorName = (document.getElementById('login-operator-name')?.value || '').trim();
    const enteredId = loginIdInput.value.trim();
    const enteredPass = loginPassInput.value;

    if (enteredId === ADMIN_ID && enteredPass === ADMIN_PASS) {
      loginError.classList.add('hidden');
      const activeDisplayUser = operatorName ? `${operatorName} (${enteredId})` : enteredId;
      state.isAuthenticated = true;
      state.currentUser = activeDisplayUser;
      savePersistentLoginSession(activeDisplayUser);
      await recordAuditLog('લોગિન', `યુઝર "${activeDisplayUser}" એ લોગિન કર્યું.`);
      loginForm.reset();
      updateAuthUI();
      showToast(`સ્વાગત છે ${activeDisplayUser}!`);
    } else {
      loginErrorText.textContent = 'ખોટું ID અથવા પાસવર્ડ. કૃપા કરીને ID: admin અને પાસવર્ડ: admin@123 લખો.';
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await recordAuditLog('લોગઆઉટ', `યુઝર "${state.currentUser}" એ લોગઆઉટ કર્યું.`);
    clearPersistentLoginSession();
    state.isAuthenticated = false;
    updateAuthUI();
    showToast('સુરક્ષિત રીતે લોગઆઉટ થઈ ગયું છે.', 'info');
  });
}

// =========================================================================
// 4. NAVIGATION & PWA INSTALL HANDLERS
// =========================================================================
function switchTab(tabName) {
  state.activeTab = tabName;

  const pages = {
    dashboard: document.getElementById('page-dashboard'),
    attendance: document.getElementById('page-attendance'),
    monthly: document.getElementById('page-monthly'),
    notes: document.getElementById('page-notes'),
    records: document.getElementById('page-records'),
  };

  Object.keys(pages).forEach((key) => {
    if (pages[key]) {
      pages[key].classList.toggle('hidden', key !== tabName);
    }
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    const isMatch = btn.dataset.nav === tabName;
    btn.className = isMatch
      ? 'nav-btn px-3.5 py-2 rounded-lg text-sm font-bold transition cursor-pointer bg-amber-500 text-slate-950 shadow-xs'
      : 'nav-btn px-3.5 py-2 rounded-lg text-sm font-bold transition cursor-pointer text-slate-300 hover:text-white hover:bg-slate-700/60';
  });

  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
    const isMatch = btn.dataset.nav === tabName;
    btn.className = isMatch
      ? 'mobile-nav-btn flex flex-col items-center justify-center py-2.5 text-[10px] font-bold transition cursor-pointer text-amber-400 bg-slate-800/80 border-t-2 border-amber-400'
      : 'mobile-nav-btn flex flex-col items-center justify-center py-2.5 text-[10px] font-bold transition cursor-pointer text-slate-400 hover:text-white';
  });

  refreshActiveView();
}

function setupNavigationAndPWAEvents() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.nav));
  });

  document.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.jump));
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  document.querySelectorAll('[data-install-app-trigger]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          showToast('એપ ઇન્સ્ટોલ થઈ રહી છે! હોમ સ્ક્રીન પર આઇકન આવી જશે.');
        }
      } else {
        showConfirmModal(
          'એપ ઇન્સ્ટોલ કરવાની સરળ રીત',
          '1) એન્ડ્રોઇડ Chrome માં: ઉપર 3 ટપકાં (⋮) દબાવો અને "Add to Home screen" અથવા "Install app" દબાવો.\n\n2) iPhone (Safari) માં: નીચે Share દબાવી "Add to Home Screen" દબાવો.\n\n3) કોમ્પ્યુટર Chrome/Edge માં: એડ્રેસ બારની જમણી બાજુ Install આઇકન દબાવો.',
          () => {}
        );
      }
    });
  });
}

// =========================================================================
// 5. DASHBOARD RENDERING
// =========================================================================
function renderDashboard() {
  const today = getTodayISO();
  document.getElementById('dashboard-today-label').textContent = `આજની તારીખ: ${formatGujaratiDate(today)} • શિફ્ટ: સવારે 8:00 થી સાંજે 5:00`;

  const totalWorkers = state.workers.length;
  let presentCount = 0;
  let halfCount = 0;
  let absentCount = 0;
  let totalOtHours = 0;
  let totalWageToday = 0;

  state.workers.forEach((w) => {
    const rec = getWorkerDayRecord(today, w.id);
    if (rec.status === 'P') presentCount++;
    else if (rec.status === 'H') halfCount++;
    else if (rec.status === 'A') absentCount++;

    totalOtHours += rec.otHours;
    totalWageToday += calculateWorkerEarnings(w, rec).totalPay;
  });

  document.getElementById('stat-total-workers').textContent = totalWorkers;
  document.getElementById('stat-present-today').textContent = presentCount;
  document.getElementById('stat-attendance-breakdown').textContent = `${presentCount} હાજર • ${halfCount} અડધો • ${absentCount} ગેરહાજર`;
  document.getElementById('stat-ot-hours').textContent = `${roundMoney(totalOtHours)} કલાક`;
  document.getElementById('stat-total-wage').textContent = formatRupees(totalWageToday);

  const workerPreviewEl = document.getElementById('dashboard-worker-preview');
  if (state.workers.length === 0) {
    workerPreviewEl.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">હજુ સુધી કોઈ કારીગર ઉમેરવામાં આવ્યા નથી.</p>`;
  } else {
    workerPreviewEl.innerHTML = state.workers
      .slice(0, 6)
      .map((w) => {
        const rec = getWorkerDayRecord(today, w.id);
        const earnings = calculateWorkerEarnings(w, rec);
        let badge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500">બાકી</span>`;
        if (rec.status === 'P') badge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">હાજર</span>`;
        if (rec.status === 'H') badge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800">અડધો દિવસ</span>`;
        if (rec.status === 'A') badge = `<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800">ગેરહાજર</span>`;

        return `
          <div class="py-2.5 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-bold text-slate-900">${escapeHTML(w.name)}</p>
              <p class="text-xs text-slate-500">${escapeHTML(w.role)} &bull; રોજ: ${formatRupees(w.dailyRate)} &bull; OT: ${rec.otHours} કલાક</p>
            </div>
            <div class="text-right flex flex-col items-end gap-1">
              ${badge}
              <span class="text-xs font-extrabold text-blue-700">${formatRupees(earnings.totalPay)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  const notesPreviewEl = document.getElementById('dashboard-notes-preview');
  if (state.notes.length === 0) {
    notesPreviewEl.innerHTML = `<p class="text-sm text-slate-500 py-4 text-center">હજુ સુધી કોઈ નોંધ લખવામાં આવી નથી.</p>`;
  } else {
    notesPreviewEl.innerHTML = state.notes
      .slice(0, 3)
      .map(
        (n) => `
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">${escapeHTML(n.category)}</span>
            <span class="text-[11px] text-slate-400">${escapeHTML(n.updatedAt)}</span>
          </div>
          <h4 class="text-sm font-bold text-slate-900 truncate">${escapeHTML(n.title)}</h4>
          <p class="text-xs text-slate-600 line-clamp-2 mt-0.5">${escapeHTML(n.content)}</p>
        </div>
      `
      )
      .join('');
  }
}

// =========================================================================
// 6. WORKER ATTENDANCE & OVERTIME PAGE LOGIC
// =========================================================================
function renderAttendancePage() {
  const dateInput = document.getElementById('attendance-date');
  dateInput.value = state.selectedDate;

  const isToday = state.selectedDate === getTodayISO();
  document.getElementById('selected-date-display').textContent = isToday
    ? `આજ (${formatGujaratiDate(state.selectedDate)})`
    : formatGujaratiDate(state.selectedDate);

  let present = 0;
  let half = 0;
  let absent = 0;
  let totalOtHours = 0;
  let totalPayable = 0;

  state.workers.forEach((w) => {
    const rec = getWorkerDayRecord(state.selectedDate, w.id);
    if (rec.status === 'P') present++;
    else if (rec.status === 'H') half++;
    else if (rec.status === 'A') absent++;

    totalOtHours += rec.otHours;
    totalPayable += calculateWorkerEarnings(w, rec).totalPay;
  });

  document.getElementById('att-count-present').textContent = present;
  document.getElementById('att-count-half').textContent = half;
  document.getElementById('att-count-absent').textContent = absent;
  document.getElementById('att-total-ot').textContent = `${roundMoney(totalOtHours)} કલાક`;
  document.getElementById('att-total-payable').textContent = formatRupees(totalPayable);

  const container = document.getElementById('worker-list-container');
  if (state.workers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <p class="text-base font-bold text-slate-700">હજુ સુધી કોઈ કારીગર ઉમેરવામાં આવ્યા નથી</p>
        <p class="text-xs text-slate-500 mt-1">ઉપર આપેલા "નવો કારીગર ઉમેરો" ફોર્મમાંથી કારીગરનું નામ અને પગાર ઉમેરો.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.workers
    .map((worker, index) => {
      const rec = getWorkerDayRecord(state.selectedDate, worker.id);
      const earnings = calculateWorkerEarnings(worker, rec);

      const rowBorder =
        rec.status === 'P'
          ? 'border-emerald-300 bg-emerald-50/30'
          : rec.status === 'H'
          ? 'border-amber-300 bg-amber-50/30'
          : rec.status === 'A'
          ? 'border-red-300 bg-red-50/30'
          : 'border-slate-200 bg-white';

      const btnP =
        rec.status === 'P'
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
          : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-300';

      const btnH =
        rec.status === 'H'
          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
          : 'bg-white hover:bg-amber-50 text-amber-700 border-slate-300';

      const btnA =
        rec.status === 'A'
          ? 'bg-red-600 text-white border-red-600 shadow-sm'
          : 'bg-white hover:bg-red-50 text-red-700 border-slate-300';

      return `
        <div class="border ${rowBorder} rounded-2xl p-4 transition">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                #${index + 1}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-base font-extrabold text-slate-900 leading-snug">${escapeHTML(worker.name)}</h4>
                  <span class="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs font-bold">${escapeHTML(worker.role)}</span>
                  ${worker.phone ? `<span class="text-xs text-slate-500 font-medium">📞 ${escapeHTML(worker.phone)}</span>` : ''}
                </div>
                <div class="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                  <span class="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                    શિફ્ટ (8 થી 5): ${formatRupees(worker.dailyRate)}/દિવસ
                  </span>
                  <span class="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                    ઓવરટાઇમ: ${formatRupees(worker.otRate)}/કલાક
                  </span>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/80">
              <div class="grid grid-cols-3 gap-1.5">
                <button type="button" data-worker-id="${worker.id}" data-status="P" class="att-status-btn px-3 py-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${btnP}">
                  હાજર (8-5)
                </button>
                <button type="button" data-worker-id="${worker.id}" data-status="H" class="att-status-btn px-3 py-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${btnH}">
                  અડધો દિવસ
                </button>
                <button type="button" data-worker-id="${worker.id}" data-status="A" class="att-status-btn px-3 py-2.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${btnA}">
                  ગેરહાજર
                </button>
              </div>

              <div class="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5">
                <span class="text-xs font-bold text-slate-700 mr-1">ઓવરટાઇમ:</span>
                <button type="button" data-ot-delta="-0.5" data-worker-id="${worker.id}" class="ot-step-btn w-8 h-8 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-900 font-extrabold text-sm flex items-center justify-center cursor-pointer">
                  &minus;
                </button>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="any"
                  inputmode="decimal"
                  value="${rec.otHours}"
                  data-worker-id="${worker.id}"
                  class="ot-input w-16 text-center bg-white border border-slate-300 rounded-lg py-1 text-sm font-extrabold text-slate-900 focus:outline-none focus:border-amber-500"
                />
                <button type="button" data-ot-delta="0.5" data-worker-id="${worker.id}" class="ot-step-btn w-8 h-8 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-900 font-extrabold text-sm flex items-center justify-center cursor-pointer">
                  +
                </button>
                <span class="text-[11px] font-bold text-slate-500 ml-0.5">કલાક</span>
              </div>
            </div>

            <div class="flex items-center justify-between lg:justify-end gap-3 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-slate-200/80">
              <div class="text-left lg:text-right">
                <span class="block text-[11px] font-bold text-slate-500">આજનો કુલ હિસાબ</span>
                <span class="text-lg font-extrabold text-blue-700">${formatRupees(earnings.totalPay)}</span>
                <span class="block text-[11px] text-slate-500">
                  શિફ્ટ ${formatRupees(earnings.shiftPay)} + OT ${formatRupees(earnings.otPay)}
                </span>
              </div>

              <div class="flex items-center gap-1">
                <button type="button" data-edit-worker="${worker.id}" class="p-2 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition cursor-pointer" title="સુધારો">
                  ✎
                </button>
                <button type="button" data-delete-worker="${worker.id}" class="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer" title="દૂર કરો">
                  🗑
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function resetWorkerForm() {
  document.getElementById('add-worker-form').reset();
  document.getElementById('worker-edit-id').value = '';
  document.getElementById('worker-form-heading').innerHTML = `
    <span class="w-6 h-6 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center text-sm font-black">+</span>
    <span>નવો કારીગર ઉમેરો (અલગ પગાર અને ઓવરટાઇમ દર સાથે)</span>
  `;
  document.getElementById('worker-submit-btn').textContent = '+ નવો કારીગર ઉમેરો';
  document.getElementById('cancel-edit-worker-btn').classList.add('hidden');
}

function setupAttendanceEvents() {
  const dateInput = document.getElementById('attendance-date');
  const todayBtn = document.getElementById('today-date-btn');
  const addWorkerForm = document.getElementById('add-worker-form');
  const dailyRateInput = document.getElementById('worker-daily-rate');
  const otRateInput = document.getElementById('worker-ot-rate');
  const cancelEditWorkerBtn = document.getElementById('cancel-edit-worker-btn');
  const workerListContainer = document.getElementById('worker-list-container');
  const markAllPresentBtn = document.getElementById('mark-all-present-btn');
  const copyReportBtn = document.getElementById('copy-report-btn');

  dateInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.selectedDate = e.target.value;
      renderAttendancePage();
    }
  });

  todayBtn.addEventListener('click', () => {
    state.selectedDate = getTodayISO();
    renderAttendancePage();
    showToast('આજની તારીખ પસંદ કરવામાં આવી છે.', 'info');
  });

  cancelEditWorkerBtn.addEventListener('click', resetWorkerForm);

  dailyRateInput.addEventListener('input', () => {
    const editId = document.getElementById('worker-edit-id').value;
    if (!editId) {
      const dailyVal = parseFloat(dailyRateInput.value);
      if (!isNaN(dailyVal) && dailyVal > 0) {
        otRateInput.value = roundMoney(dailyVal / 8);
      }
    }
  });

  addWorkerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('worker-edit-id').value;
    const name = document.getElementById('worker-name').value.trim();
    const role = document.getElementById('worker-role').value;
    const dailyRate = Math.max(0, roundMoney(parseFloat(dailyRateInput.value) || 0));
    const otRate = Math.max(0, roundMoney(parseFloat(otRateInput.value) || 0));
    const phone = document.getElementById('worker-phone').value.trim();

    if (!name) {
      showToast('કૃપા કરીને કારીગરનું નામ લખો.', 'error');
      return;
    }

    if (editId) {
      const existing = state.workers.find((w) => w.id === editId) || {};
      const updatedWorker = {
        ...existing,
        id: editId,
        name,
        role,
        dailyRate,
        otRate,
        phone,
        savedBy: state.currentUser || ADMIN_ID,
      };
      await saveSingleWorkerToCloud(updatedWorker, `કારીગર "${name}" ની વિગત અને પગાર સુધાર્યા.`);
      showToast(`${name} ની વિગત અને પગાર અપડેટ થઈ ગયા છે!`);
    } else {
      const newWorker = {
        id: 'w_' + Date.now(),
        name,
        role,
        dailyRate,
        otRate,
        phone,
        savedBy: state.currentUser || ADMIN_ID,
        createdAtMs: Date.now(),
      };
      await saveSingleWorkerToCloud(newWorker, `નવો કારીગર "${name}" ઉમેર્યો.`);
      showToast(`${name} કારીગર લિસ્ટમાં ઉમેરાઈ ગયા છે!`);
    }

    resetWorkerForm();
    renderAttendancePage();
  });

  workerListContainer.addEventListener('click', async (e) => {
    const statusBtn = e.target.closest('.att-status-btn');
    if (statusBtn) {
      const workerId = statusBtn.dataset.workerId;
      const status = statusBtn.dataset.status;

      if (!state.attendance[state.selectedDate]) state.attendance[state.selectedDate] = {};
      const current = getWorkerDayRecord(state.selectedDate, workerId);
      state.attendance[state.selectedDate][workerId] = {
        status,
        otHours: status === 'A' ? 0 : current.otHours,
        savedBy: state.currentUser || ADMIN_ID,
      };
      const workerObj = state.workers.find((w) => w.id === workerId);
      const statusGu = status === 'P' ? 'હાજર' : status === 'H' ? 'અડધો દિવસ' : 'ગેરહાજર';
      renderAttendancePage();
      await saveDateAttendanceToCloud(
        state.selectedDate,
        `${state.selectedDate}: ${workerObj ? workerObj.name : workerId} ની હાજરી "${statusGu}" સેવ કરી.`
      );
      return;
    }

    const otStepBtn = e.target.closest('.ot-step-btn');
    if (otStepBtn) {
      const workerId = otStepBtn.dataset.workerId;
      const delta = Number(otStepBtn.dataset.otDelta) || 0;

      if (!state.attendance[state.selectedDate]) state.attendance[state.selectedDate] = {};
      const current = getWorkerDayRecord(state.selectedDate, workerId);
      const nextHours = Math.max(0, Math.min(24, Math.round((current.otHours + delta) * 100) / 100));
      const nextStatus = nextHours > 0 && !current.status ? 'P' : current.status;

      state.attendance[state.selectedDate][workerId] = {
        status: nextStatus,
        otHours: nextHours,
        savedBy: state.currentUser || ADMIN_ID,
      };
      const workerObj = state.workers.find((w) => w.id === workerId);
      renderAttendancePage();
      await saveDateAttendanceToCloud(
        state.selectedDate,
        `${state.selectedDate}: ${workerObj ? workerObj.name : workerId} નો ઓવરટાઇમ ${nextHours} કલાક સેવ કર્યો.`
      );
      return;
    }

    const editBtn = e.target.closest('[data-edit-worker]');
    if (editBtn) {
      const workerId = editBtn.dataset.editWorker;
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) return;

      document.getElementById('worker-edit-id').value = worker.id;
      document.getElementById('worker-name').value = worker.name;
      document.getElementById('worker-role').value = worker.role;
      document.getElementById('worker-daily-rate').value = worker.dailyRate;
      document.getElementById('worker-ot-rate').value = worker.otRate;
      document.getElementById('worker-phone').value = worker.phone || '';
      document.getElementById('worker-form-heading').innerHTML = `
        <span class="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-black">✎</span>
        <span>કારીગરની વિગત અને પગાર સુધારો: ${escapeHTML(worker.name)}</span>
      `;
      document.getElementById('worker-submit-btn').textContent = 'ફેરફાર સાચવો';
      document.getElementById('cancel-edit-worker-btn').classList.remove('hidden');
      document.getElementById('worker-name').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-worker]');
    if (deleteBtn) {
      const workerId = deleteBtn.dataset.deleteWorker;
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) return;

      showConfirmModal(
        'કારીગર દૂર કરો?',
        `શું તમે ખરેખર "${worker.name}" ને સેન્ચ્યુરી પ્રોડક્ટ લિસ્ટમાંથી દૂર કરવા માંગો છો?`,
        async () => {
          await deleteWorkerFromCloud(workerId, `કારીગર "${worker.name}" ને ડિલીટ કર્યા.`);
          if (document.getElementById('worker-edit-id').value === workerId) resetWorkerForm();
          renderAttendancePage();
          showToast(`${worker.name} ને લિસ્ટમાંથી દૂર કર્યા છે.`, 'info');
        }
      );
    }
  });

  workerListContainer.addEventListener('change', async (e) => {
    const otInput = e.target.closest('.ot-input');
    if (!otInput) return;

    const workerId = otInput.dataset.workerId;
    const parsedVal = parseFloat(otInput.value);
    const val = Math.max(0, Math.min(24, isNaN(parsedVal) ? 0 : Math.round(parsedVal * 100) / 100));

    if (!state.attendance[state.selectedDate]) state.attendance[state.selectedDate] = {};
    const current = getWorkerDayRecord(state.selectedDate, workerId);
    const nextStatus = val > 0 && !current.status ? 'P' : current.status;

    state.attendance[state.selectedDate][workerId] = {
      status: nextStatus,
      otHours: val,
      savedBy: state.currentUser || ADMIN_ID,
    };
    const workerObj = state.workers.find((w) => w.id === workerId);
    renderAttendancePage();
    await saveDateAttendanceToCloud(
      state.selectedDate,
      `${state.selectedDate}: ${workerObj ? workerObj.name : workerId} નો ઓવરટાઇમ ${val} કલાક સેવ કર્યો.`
    );
  });

  markAllPresentBtn.addEventListener('click', async () => {
    if (state.workers.length === 0) {
      showToast('હાજરી ભરવા માટે કોઈ કારીગર નથી.', 'error');
      return;
    }
    if (!state.attendance[state.selectedDate]) state.attendance[state.selectedDate] = {};
    state.workers.forEach((w) => {
      const current = getWorkerDayRecord(state.selectedDate, w.id);
      state.attendance[state.selectedDate][w.id] = {
        status: 'P',
        otHours: current.otHours,
        savedBy: state.currentUser || ADMIN_ID,
      };
    });
    renderAttendancePage();
    await saveDateAttendanceToCloud(state.selectedDate, `${state.selectedDate}: બધા કારીગરોને હાજર સેવ કર્યા.`);
    showToast('બધા કારીગરોને હાજર (8 થી 5) કરી દેવામાં આવ્યા છે!');
  });

  copyReportBtn.addEventListener('click', () => {
    if (state.workers.length === 0) {
      showToast('રિપોર્ટ બનાવવા માટે કોઈ કારીગર નથી.', 'error');
      return;
    }

    let present = 0;
    let half = 0;
    let absent = 0;
    let totalOt = 0;
    let grandTotal = 0;

    const lines = state.workers.map((w, idx) => {
      const rec = getWorkerDayRecord(state.selectedDate, w.id);
      const earnings = calculateWorkerEarnings(w, rec);
      totalOt += rec.otHours;
      grandTotal += earnings.totalPay;

      let label = 'બાકી';
      if (rec.status === 'P') {
        present++;
        label = '✅ હાજર (8-5)';
      } else if (rec.status === 'H') {
        half++;
        label = '🌓 અડધો દિવસ';
      } else if (rec.status === 'A') {
        absent++;
        label = '❌ ગેરહાજર';
      }

      const otPart = rec.otHours > 0 ? ` + OT ${rec.otHours} કલાક` : '';
      return `${idx + 1}. ${w.name} (${w.role}) — ${label}${otPart} = ${formatRupees(earnings.totalPay)}`;
    });

    const reportText = [
      `*સેન્ચ્યુરી પ્રોડક્ટ — કારખાના હાજરી અને પગાર રિપોર્ટ*`,
      `તારીખ: ${formatGujaratiDate(state.selectedDate)}`,
      `શિફ્ટ સમય: સવારે 8:00 થી સાંજે 5:00`,
      `કુલ: હાજર: ${present} | અડધો દિવસ: ${half} | ગેરહાજર: ${absent}`,
      `કુલ ઓવરટાઇમ: ${roundMoney(totalOt)} કલાક | કુલ પગાર: ${formatRupees(grandTotal)}`,
      `----------------------------------`,
      ...lines,
    ].join('\n');

    const tempArea = document.createElement('textarea');
    tempArea.value = reportText;
    tempArea.style.position = 'fixed';
    tempArea.style.left = '-9999px';
    document.body.appendChild(tempArea);
    tempArea.select();
    try {
      document.execCommand('copy');
      showToast('ગુજરાતી રિપોર્ટ કોપી થઈ ગયો! હવે WhatsApp માં પેસ્ટ કરો.');
    } catch (err) {
      showToast('રિપોર્ટ કોપી થઈ શક્યો નથી.', 'error');
    } finally {
      document.body.removeChild(tempArea);
    }
  });
}

// =========================================================================
// 7. MONTHLY SUMMARY & INDIVIDUAL WORKER PDF REPORTS
// =========================================================================
function computeWorkerMonthlyReport(worker, monthISO) {
  const [yearStr, monthStr] = monthISO.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let unmarkedDays = 0;
  let regularHours = 0;
  let totalOtHours = 0;
  let totalRegularPay = 0;
  let totalOtPay = 0;
  let grandTotalPay = 0;

  const dayRows = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayPadded = String(d).padStart(2, '0');
    const dateISO = `${yearStr}-${monthStr}-${dayPadded}`;
    const dateObj = new Date(year, month - 1, d);
    const weekdayGu = getGujaratiWeekday(dateObj);

    const rec = getWorkerDayRecord(dateISO, worker.id);
    const earnings = calculateWorkerEarnings(worker, rec);

    let statusLabelGu = 'નોંધ નથી';
    let regHrsDay = 0;

    if (rec.status === 'P') {
      presentDays++;
      regHrsDay = 8;
      statusLabelGu = 'હાજર (8:00 થી 5:00)';
    } else if (rec.status === 'H') {
      halfDays++;
      regHrsDay = 4;
      statusLabelGu = 'અડધો દિવસ';
    } else if (rec.status === 'A') {
      absentDays++;
      statusLabelGu = 'ગેરહાજર';
    } else {
      unmarkedDays++;
    }

    regularHours += regHrsDay;
    totalOtHours = Math.round((totalOtHours + rec.otHours) * 100) / 100;
    totalRegularPay = roundMoney(totalRegularPay + earnings.shiftPay);
    totalOtPay = roundMoney(totalOtPay + earnings.otPay);
    grandTotalPay = roundMoney(grandTotalPay + earnings.totalPay);

    dayRows.push({
      dayNumber: d,
      dateISO,
      displayDate: `${dayPadded}/${monthStr}/${yearStr}`,
      weekdayGu,
      status: rec.status,
      statusLabelGu,
      otHours: rec.otHours,
      shiftPay: earnings.shiftPay,
      otPay: earnings.otPay,
      dayTotal: earnings.totalPay,
    });
  }

  return {
    worker,
    monthISO,
    monthLabelGu: formatGujaratiMonthYear(monthISO),
    daysInMonth,
    presentDays,
    halfDays,
    absentDays,
    unmarkedDays,
    effectiveDays: presentDays + halfDays * 0.5,
    regularHours,
    totalOtHours,
    totalRegularPay,
    totalOtPay,
    grandTotalPay,
    dayRows,
  };
}

function buildWorkerA4ReportHTML(report) {
  const w = report.worker;
  const rowsHTML = report.dayRows
    .map((row) => {
      let statusColor = '#64748b';
      let rowBg = row.dayNumber % 2 === 0 ? '#f8fafc' : '#ffffff';
      if (row.status === 'P') {
        statusColor = '#047857';
        rowBg = '#ecfdf5';
      } else if (row.status === 'H') {
        statusColor = '#b45309';
        rowBg = '#fffbeb';
      } else if (row.status === 'A') {
        statusColor = '#b91c1c';
        rowBg = '#fef2f2';
      }

      return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: #0f172a;">${row.displayDate}</td>
          <td style="padding: 5px 8px; text-align: center; color: #334155;">${row.weekdayGu}</td>
          <td style="padding: 5px 8px; text-align: center; font-weight: 700; color: ${statusColor};">${row.statusLabelGu}</td>
          <td style="padding: 5px 8px; text-align: center; font-weight: 600; color: #0f172a;">${row.otHours > 0 ? row.otHours + ' કલાક' : '-'}</td>
          <td style="padding: 5px 8px; text-align: right; color: #1e293b;">${formatRupees(row.shiftPay)}</td>
          <td style="padding: 5px 8px; text-align: right; color: #92400e;">${row.otPay > 0 ? formatRupees(row.otPay) : '₹0'}</td>
          <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #1d4ed8;">${formatRupees(row.dayTotal)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family: 'Noto Sans Gujarati', 'Inter', sans-serif; width: 794px; padding: 28px 32px; background: #ffffff; color: #0f172a; box-sizing: border-box;">
      <div style="border-bottom: 3px solid #f59e0b; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #b45309;">CENTURY KARKHANO &bull; પગાર અને હાજરી પત્રક</div>
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 2px 0;">સેન્ચ્યુરી પ્રોડક્ટ — સેન્ચ્યુરી કારખાનું</h1>
          <div style="font-size: 12px; color: #475569;">શિફ્ટ સમય: સવારે 8:00 થી સાંજે 5:00 &bull; વ્યક્તિગત માસિક કામનો અહેવાલ</div>
        </div>
        <div style="text-align: right; background: #0f172a; color: #ffffff; padding: 10px 16px; border-radius: 10px;">
          <div style="font-size: 11px; color: #fbbf24; font-weight: 700;">રિપોર્ટ મહિનો</div>
          <div style="font-size: 17px; font-weight: 800; margin-top: 2px;">${escapeHTML(report.monthLabelGu)}</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 11px; color: #64748b; font-weight: 700;">કારીગરનું નામ</div>
          <div style="font-size: 17px; font-weight: 800; color: #0f172a;">${escapeHTML(w.name)}</div>
          <div style="font-size: 12px; color: #334155; margin-top: 2px;">વિભાગ: <strong>${escapeHTML(w.role)}</strong> ${w.phone ? '&bull; મોબાઇલ: <strong>' + escapeHTML(w.phone) + '</strong>' : ''}</div>
        </div>
        <div style="display: flex; gap: 14px; align-items: center;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 10px; color: #1e40af; font-weight: 700;">રોજનો પગાર (8-5)</div>
            <div style="font-size: 15px; font-weight: 800; color: #1d4ed8;">${formatRupees(w.dailyRate)} / દિવસ</div>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 10px; color: #92400e; font-weight: 700;">ઓવરટાઇમ દર</div>
            <div style="font-size: 15px; font-weight: 800; color: #b45309;">${formatRupees(w.otRate)} / કલાક</div>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff;">
            <th style="padding: 7px 8px; text-align: center;">તારીખ</th>
            <th style="padding: 7px 8px; text-align: center;">વાર</th>
            <th style="padding: 7px 8px; text-align: center;">હાજરી સ્થિતિ (8 થી 5)</th>
            <th style="padding: 7px 8px; text-align: center;">ઓવરટાઇમ</th>
            <th style="padding: 7px 8px; text-align: right;">શિફ્ટ પગાર</th>
            <th style="padding: 7px 8px; text-align: right;">OT પગાર</th>
            <th style="padding: 7px 8px; text-align: right;">દિવસનો કુલ ₹</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr style="background: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 800;">
            <td colspan="3" style="padding: 8px 10px; text-align: left; color: #0f172a;">
              કુલ સરવાળો: ${report.presentDays} હાજર, ${report.halfDays} અડધો દિવસ (${report.regularHours} નિયમિત કલાક)
            </td>
            <td style="padding: 8px; text-align: center; color: #92400e;">${report.totalOtHours} કલાક</td>
            <td style="padding: 8px; text-align: right; color: #0f172a;">${formatRupees(report.totalRegularPay)}</td>
            <td style="padding: 8px; text-align: right; color: #92400e;">${formatRupees(report.totalOtPay)}</td>
            <td style="padding: 8px 10px; text-align: right; font-size: 14px; color: #1d4ed8;">${formatRupees(report.grandTotalPay)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #334155;">
        <div>
          <div style="font-size: 11px; color: #64748b;">તૈયાર કર્યા તારીખ: ${escapeHTML(getGujaratiTimestamp())}</div>
          <div style="font-size: 11px; color: #64748b;">સેન્ચ્યુરી પ્રોડક્ટ — કારખાના મેનેજમેન્ટ સિસ્ટમ</div>
        </div>
        <div style="display: flex; gap: 50px;">
          <div style="text-align: center;">
            <div style="width: 140px; border-bottom: 1px dashed #64748b; height: 28px;"></div>
            <div style="margin-top: 4px; font-weight: 700;">કારીગરની સહી</div>
          </div>
          <div style="text-align: center;">
            <div style="width: 140px; border-bottom: 1px dashed #64748b; height: 28px;"></div>
            <div style="margin-top: 4px; font-weight: 700;">એડમિન / માલિકની સહી</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function sanitizeFilePart(str, fallback) {
  const cleaned = String(str || '')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

async function generateAndSaveSingleWorkerPDF(worker, workerIndex) {
  const report = computeWorkerMonthlyReport(worker, state.selectedMonth);
  const sandbox = document.getElementById('pdf-offscreen-sandbox');
  sandbox.innerHTML = buildWorkerA4ReportHTML(report);
  const targetEl = sandbox.firstElementChild;

  if (!window.html2canvas || !window.jspdf) {
    showToast('PDF લાઇબ્રેરી લોડ થઈ નથી. પ્રિન્ટ પ્રિવ્યૂ ખોલી રહ્યા છીએ.', 'error');
    openWorkerPrintPreview(worker);
    return false;
  }

  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const canvas = await window.html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.96);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    if (imgHeight <= pageHeight - margin * 2) {
      pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, imgHeight);
    } else {
      const scaleFactor = (pageHeight - margin * 2) / imgHeight;
      const fittedWidth = usableWidth * scaleFactor;
      const fittedHeight = imgHeight * scaleFactor;
      const xOffset = (pageWidth - fittedWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xOffset, margin, fittedWidth, fittedHeight);
    }

    const safeName = sanitizeFilePart(worker.name, `Worker_${workerIndex + 1}`);
    pdf.save(`${workerIndex + 1}_${safeName}_${state.selectedMonth}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF generation failed:', err);
    openWorkerPrintPreview(worker);
    return false;
  } finally {
    sandbox.innerHTML = '';
  }
}

let currentPreviewWorker = null;

function openWorkerPrintPreview(worker) {
  currentPreviewWorker = worker;
  const report = computeWorkerMonthlyReport(worker, state.selectedMonth);
  document.getElementById('modal-pdf-title').textContent = `${worker.name} — ${report.monthLabelGu} પગાર સ્લિપ`;
  document.getElementById('print-preview-area').innerHTML = buildWorkerA4ReportHTML(report);

  const modal = document.getElementById('pdf-preview-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function renderMonthlyPage() {
  const monthInput = document.getElementById('monthly-month-input');
  monthInput.value = state.selectedMonth;

  const monthLabelGu = formatGujaratiMonthYear(state.selectedMonth);
  const [yStr, mStr] = state.selectedMonth.split('-');
  const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();

  document.getElementById('monthly-label-display').textContent = monthLabelGu;
  document.getElementById('monthly-days-count').textContent = `કુલ ${daysInMonth} દિવસનો મહિનો`;

  let allEffectiveDays = 0;
  let allRegHours = 0;
  let allOtHours = 0;
  let allOtPay = 0;
  let allGrandTotal = 0;

  const reports = state.workers.map((w) => {
    const r = computeWorkerMonthlyReport(w, state.selectedMonth);
    allEffectiveDays += r.effectiveDays;
    allRegHours += r.regularHours;
    allOtHours += r.totalOtHours;
    allOtPay += r.totalOtPay;
    allGrandTotal += r.grandTotalPay;
    return r;
  });

  document.getElementById('monthly-total-days').textContent = `${allEffectiveDays} દિવસ`;
  document.getElementById('monthly-total-reg-hours').textContent = `${allRegHours} નિયમિત કલાક (8-5)`;
  document.getElementById('monthly-total-ot').textContent = `${roundMoney(allOtHours)} કલાક`;
  document.getElementById('monthly-total-ot-pay').textContent = `OT પગાર: ${formatRupees(allOtPay)}`;
  document.getElementById('monthly-grand-total').textContent = formatRupees(allGrandTotal);

  const listEl = document.getElementById('monthly-workers-list');
  if (reports.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <p class="text-base font-bold text-slate-700">કોઈ કારીગર નોંધાયેલ નથી</p>
        <p class="text-xs text-slate-500 mt-1">પહેલા "કારીગર હાજરી અને પગાર" પેજ પર કારીગર ઉમેરો.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = reports
    .map((rep, idx) => {
      const w = rep.worker;
      return `
        <div class="border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 bg-slate-50/60 transition">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 font-extrabold text-sm flex items-center justify-center shrink-0">
                #${idx + 1}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="text-base font-extrabold text-slate-900">${escapeHTML(w.name)}</h4>
                  <span class="px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-800 text-xs font-bold">${escapeHTML(w.role)}</span>
                </div>
                <p class="text-xs text-slate-600 mt-1">
                  દર: <strong>${formatRupees(w.dailyRate)}/દિવસ (8-5)</strong> &bull; ઓવરટાઇમ: <strong>${formatRupees(w.otRate)}/કલાક</strong>
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div class="bg-white border border-emerald-200 rounded-xl px-3 py-2">
                <span class="block text-[11px] font-bold text-emerald-700">હાજર / અડધો</span>
                <span class="text-sm font-extrabold text-emerald-800">${rep.presentDays} હાજર • ${rep.halfDays} અડધો</span>
              </div>
              <div class="bg-white border border-red-200 rounded-xl px-3 py-2">
                <span class="block text-[11px] font-bold text-red-700">ગેરહાજર</span>
                <span class="text-sm font-extrabold text-red-700">${rep.absentDays} દિવસ</span>
              </div>
              <div class="bg-white border border-amber-200 rounded-xl px-3 py-2">
                <span class="block text-[11px] font-bold text-amber-800">ઓવરટાઇમ</span>
                <span class="text-sm font-extrabold text-amber-900">${rep.totalOtHours} કલાક</span>
              </div>
              <div class="bg-blue-600 text-white rounded-xl px-3 py-2">
                <span class="block text-[11px] font-bold text-blue-100">કુલ માસિક પગાર</span>
                <span class="text-base font-extrabold">${formatRupees(rep.grandTotalPay)}</span>
              </div>
            </div>

            <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
              <button type="button" data-preview-worker-pdf="${w.id}" class="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold cursor-pointer">
                પ્રિવ્યૂ જુઓ
              </button>
              <button type="button" data-download-worker-pdf="${w.id}" class="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer">
                ⬇ PDF ડાઉનલોડ કરો
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function setupMonthlyEvents() {
  const monthInput = document.getElementById('monthly-month-input');
  const listEl = document.getElementById('monthly-workers-list');
  const bulkDownloadBtn = document.getElementById('download-all-pdfs-btn');
  const previewModal = document.getElementById('pdf-preview-modal');
  const closeModalBtn = document.getElementById('modal-close-pdf-btn');
  const modalDownloadBtn = document.getElementById('modal-download-pdf-btn');
  const modalPrintBtn = document.getElementById('modal-print-btn');

  monthInput.addEventListener('change', (e) => {
    if (e.target.value) {
      state.selectedMonth = e.target.value;
      renderMonthlyPage();
    }
  });

  listEl.addEventListener('click', async (e) => {
    const downloadBtn = e.target.closest('[data-download-worker-pdf]');
    if (downloadBtn) {
      const workerId = downloadBtn.dataset.downloadWorkerPdf;
      const idx = state.workers.findIndex((w) => w.id === workerId);
      if (idx === -1) return;

      const worker = state.workers[idx];
      const originalHTML = downloadBtn.innerHTML;
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'PDF બને છે...';

      const ok = await generateAndSaveSingleWorkerPDF(worker, idx);
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = originalHTML;
      if (ok) showToast(`${worker.name} ની PDF ડાઉનલોડ થઈ ગઈ છે!`);
      return;
    }

    const previewBtn = e.target.closest('[data-preview-worker-pdf]');
    if (previewBtn) {
      const worker = state.workers.find((w) => w.id === previewBtn.dataset.previewWorkerPdf);
      if (worker) openWorkerPrintPreview(worker);
    }
  });

  bulkDownloadBtn.addEventListener('click', async () => {
    if (state.workers.length === 0) {
      showToast('PDF ડાઉનલોડ કરવા માટે કોઈ કારીગર નથી.', 'error');
      return;
    }

    const progressBox = document.getElementById('bulk-pdf-progress');
    const statusText = document.getElementById('bulk-pdf-status-text');
    const counterText = document.getElementById('bulk-pdf-counter');
    const progressBar = document.getElementById('bulk-pdf-bar');

    bulkDownloadBtn.disabled = true;
    progressBox.classList.remove('hidden');

    const total = state.workers.length;
    for (let i = 0; i < total; i++) {
      const worker = state.workers[i];
      statusText.textContent = `ડાઉનલોડ થાય છે: ${worker.name} ની અલગ PDF...`;
      counterText.textContent = `${i + 1} / ${total}`;
      progressBar.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

      await generateAndSaveSingleWorkerPDF(worker, i);
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    statusText.textContent = `બધા ${total} કારીગરોની અલગ-અલગ PDF ડાઉનલોડ થઈ ગઈ છે!`;
    bulkDownloadBtn.disabled = false;
    showToast(`બધા ${total} કારીગરોની અલગ PDF ડાઉનલોડ થઈ ગઈ!`);

    setTimeout(() => {
      progressBox.classList.add('hidden');
      progressBar.style.width = '0%';
    }, 3500);
  });

  closeModalBtn.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    previewModal.classList.remove('flex');
  });

  modalPrintBtn.addEventListener('click', () => window.print());

  modalDownloadBtn.addEventListener('click', async () => {
    if (!currentPreviewWorker) return;
    const idx = state.workers.findIndex((w) => w.id === currentPreviewWorker.id);
    await generateAndSaveSingleWorkerPDF(currentPreviewWorker, idx >= 0 ? idx : 0);
  });
}

// =========================================================================
// 8. NOTES PAGE LOGIC (કારખાનાની નોંધ)
// =========================================================================
function getCategoryBadgeClasses(category) {
  switch (category) {
    case 'ઉત્પાદન':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'માલ / સ્ટોક':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'મશીન રિપેરિંગ':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-slate-200 text-slate-800 border-slate-300';
  }
}

function renderNotesPage() {
  const grid = document.getElementById('notes-grid');
  const query = state.noteSearchQuery.toLowerCase();

  document.querySelectorAll('.cat-filter-btn').forEach((btn) => {
    const active = btn.dataset.cat === state.noteFilterCategory;
    btn.className = active
      ? 'cat-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-slate-900 text-amber-400'
      : 'cat-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200';
  });

  const filteredNotes = state.notes.filter((note) => {
    const matchesCat = state.noteFilterCategory === 'All' || note.category === state.noteFilterCategory;
    const matchesQuery =
      !query ||
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.category.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  if (filteredNotes.length === 0) {
    grid.innerHTML = `
      <div class="md:col-span-2 text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
        <p class="text-base font-bold text-slate-700">કોઈ નોંધ મળી નથી</p>
        <p class="text-xs text-slate-500 mt-1">ઉપરથી નવી નોંધ ઉમેરો અથવા સર્ચ ફિલ્ટર બદલો.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredNotes
    .map((note) => {
      const badgeClass = getCategoryBadgeClasses(note.category);
      return `
        <article class="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="px-2.5 py-0.5 rounded-lg border text-xs font-extrabold ${badgeClass}">${escapeHTML(note.category)}</span>
              <span class="text-[11px] text-slate-400 font-medium">${escapeHTML(note.updatedAt)}</span>
            </div>
            ${note.title ? `<h3 class="text-sm font-extrabold text-slate-900 mb-1">${escapeHTML(note.title)}</h3>` : ''}
            <p class="text-base text-slate-800 whitespace-pre-line leading-relaxed font-medium">${escapeHTML(note.content)}</p>
          </div>
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <span class="text-[11px] font-bold text-slate-400">${note.savedBy ? 'સેવ: ' + escapeHTML(note.savedBy) : ''}</span>
            <div class="flex items-center gap-1.5">
              <button type="button" data-copy-note="${note.id}" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold cursor-pointer">
                📋 કોપી
              </button>
              <button type="button" data-edit-note="${note.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 text-xs font-bold cursor-pointer">
                સુધારો
              </button>
              <button type="button" data-delete-note="${note.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 text-xs font-bold cursor-pointer">
                દૂર કરો
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function resetNoteForm() {
  document.getElementById('note-form').reset();
  document.getElementById('note-edit-id').value = '';
  document.getElementById('note-form-heading').textContent = 'સરળ કારખાના નોટપેડ';
  document.getElementById('note-submit-btn').textContent = '✓ નોંધ સેવ કરો';
  document.getElementById('cancel-edit-note-btn').classList.add('hidden');
}

function setupNotesEvents() {
  const noteForm = document.getElementById('note-form');
  const cancelEditBtn = document.getElementById('cancel-edit-note-btn');
  const searchInput = document.getElementById('note-search-input');
  const categoryFilters = document.getElementById('note-category-filters');
  const notesGrid = document.getElementById('notes-grid');
  const quickChips = document.getElementById('quick-note-chips');

  if (quickChips) {
    quickChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-quick-cat]');
      if (!chip) return;
      document.getElementById('note-category').value = chip.dataset.quickCat;
      const contentBox = document.getElementById('note-content');
      if (!contentBox.value.trim()) contentBox.value = chip.dataset.quickPrefix || '';
      contentBox.focus();
    });
  }

  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('note-edit-id').value;
    const rawTitle = document.getElementById('note-title').value.trim();
    const category = document.getElementById('note-category').value;
    const content = document.getElementById('note-content').value.trim();

    if (!content) {
      showToast('કૃપા કરીને નોંધમાં કંઈક લખો.', 'error');
      return;
    }

    const firstLine = content.split('\n')[0].trim();
    const title = rawTitle || (firstLine.length > 36 ? firstLine.slice(0, 36) + '...' : firstLine);
    const timestamp = getGujaratiTimestamp();

    if (editId) {
      const existing = state.notes.find((n) => n.id === editId) || {};
      const updatedNote = {
        ...existing,
        id: editId,
        title,
        category,
        content,
        updatedAt: timestamp,
        savedBy: state.currentUser || ADMIN_ID,
      };
      await saveSingleNoteToCloud(updatedNote, `નોંધ "${title}" સુધારીને સેવ કરી.`);
      showToast('નોંધ સુધારાઈ ગઈ છે!');
    } else {
      const newNote = {
        id: 'n_' + Date.now(),
        title,
        category,
        content,
        updatedAt: timestamp,
        savedBy: state.currentUser || ADMIN_ID,
        createdAtMs: Date.now(),
      };
      await saveSingleNoteToCloud(newNote, `નવી નોંધ "${title}" સેવ કરી.`);
      showToast('નોંધ સેવ થઈ ગઈ છે!');
    }

    resetNoteForm();
    renderNotesPage();
  });

  cancelEditBtn.addEventListener('click', resetNoteForm);

  searchInput.addEventListener('input', (e) => {
    state.noteSearchQuery = e.target.value;
    renderNotesPage();
  });

  categoryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-filter-btn');
    if (!btn) return;
    state.noteFilterCategory = btn.dataset.cat;
    renderNotesPage();
  });

  notesGrid.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy-note]');
    if (copyBtn) {
      const note = state.notes.find((n) => n.id === copyBtn.dataset.copyNote);
      if (!note) return;

      const temp = document.createElement('textarea');
      temp.value = `*સેન્ચ્યુરી કારખાનું (${note.category})*\n${note.content}`;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        showToast('નોંધ કોપી થઈ ગઈ! હવે WhatsApp માં મોકલી શકો છો.');
      } catch (err) {
        showToast('નોંધ કોપી થઈ શકી નથી.', 'error');
      } finally {
        document.body.removeChild(temp);
      }
      return;
    }

    const editBtn = e.target.closest('[data-edit-note]');
    if (editBtn) {
      const note = state.notes.find((n) => n.id === editBtn.dataset.editNote);
      if (!note) return;

      document.getElementById('note-edit-id').value = note.id;
      document.getElementById('note-title').value = note.title;
      document.getElementById('note-category').value = note.category;
      document.getElementById('note-content').value = note.content;
      document.getElementById('note-form-heading').textContent = 'નોંધમાં ફેરફાર કરો';
      document.getElementById('note-submit-btn').textContent = 'ફેરફાર સાચવો';
      document.getElementById('cancel-edit-note-btn').classList.remove('hidden');
      document.getElementById('note-content').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-note]');
    if (deleteBtn) {
      const noteId = deleteBtn.dataset.deleteNote;
      const note = state.notes.find((n) => n.id === noteId);
      if (!note) return;

      showConfirmModal(
        'નોંધ દૂર કરો?',
        `શું તમે ખરેખર "${note.title}" નોંધ કાયમ માટે દૂર કરવા માંગો છો?`,
        async () => {
          await deleteNoteFromCloud(noteId, `નોંધ "${note.title}" ડિલીટ કરી.`);
          if (document.getElementById('note-edit-id').value === noteId) resetNoteForm();
          renderNotesPage();
          showToast('નોંધ દૂર કરવામાં આવી છે.', 'info');
        }
      );
    }
  });
}

// =========================================================================
// 9. SAVED RECORDS, LOGIN LOGS & ADMIN MASTER CONTROLS
// =========================================================================
function renderRecordsPage() {
  document.getElementById('rec-current-user').textContent = state.currentUser || ADMIN_ID;
  document.getElementById('rec-last-saved').textContent = `છેલ્લું સેવ: ${state.lastSavedAt || getGujaratiTimestamp()}`;
  document.getElementById('rec-workers-count').textContent = state.workers.length;

  const savedDateKeys = Object.keys(state.attendance).sort().reverse();
  document.getElementById('rec-attendance-days').textContent = savedDateKeys.length;
  document.getElementById('rec-logs-count').textContent = state.logs.length;

  const tbody = document.getElementById('master-workers-tbody');
  if (state.workers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-500 font-bold">કોઈ કારીગર સેવ થયેલ નથી.</td></tr>`;
  } else {
    tbody.innerHTML = state.workers
      .map((w, idx) => {
        let totalPresentDays = 0;
        Object.values(state.attendance).forEach((dayObj) => {
          const entry = dayObj && dayObj[w.id];
          const st = typeof entry === 'string' ? entry : entry && entry.status;
          if (st === 'P') totalPresentDays += 1;
          else if (st === 'H') totalPresentDays += 0.5;
        });

        return `
          <tr class="hover:bg-slate-50">
            <td class="py-3 px-3 font-extrabold text-slate-700">#${idx + 1}</td>
            <td class="py-3 px-3 font-extrabold text-slate-900">${escapeHTML(w.name)}</td>
            <td class="py-3 px-3"><span class="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs font-bold">${escapeHTML(w.role)}</span></td>
            <td class="py-3 px-3 text-slate-600 font-medium">${w.phone ? escapeHTML(w.phone) : '-'}</td>
            <td class="py-3 px-3 font-extrabold text-blue-700">${formatRupees(w.dailyRate)}</td>
            <td class="py-3 px-3 font-extrabold text-amber-700">${formatRupees(w.otRate)} / કલાક</td>
            <td class="py-3 px-3 font-bold text-emerald-700">${totalPresentDays} દિવસ</td>
            <td class="py-3 px-3 text-xs font-bold text-slate-600">${escapeHTML(w.savedBy || 'admin')}</td>
            <td class="py-3 px-3 text-right">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" data-rec-edit-worker="${w.id}" class="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-extrabold cursor-pointer">Edit કરો</button>
                <button type="button" data-rec-delete-worker="${w.id}" class="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-extrabold cursor-pointer">Delete કરો</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  const logsListEl = document.getElementById('activity-logs-list');
  if (state.logs.length === 0) {
    logsListEl.innerHTML = `<p class="text-sm text-slate-500 text-center py-6">હજુ સુધી કોઈ લોગિન કે ફેરફાર નોંધાયેલ નથી.</p>`;
  } else {
    logsListEl.innerHTML = state.logs
      .map((log) => {
        const badgeColor =
          log.action === 'લોગિન'
            ? 'bg-emerald-100 text-emerald-800'
            : log.action === 'લોગઆઉટ'
            ? 'bg-slate-200 text-slate-800'
            : 'bg-amber-100 text-amber-900';
        return `
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded text-[11px] font-extrabold ${badgeColor}">${escapeHTML(log.action)}</span>
                <span class="text-xs font-extrabold text-slate-900">યુઝર: ${escapeHTML(log.user)}</span>
              </div>
              <p class="text-xs text-slate-700 font-medium">${escapeHTML(log.detail)}</p>
            </div>
            <span class="text-[11px] text-slate-400 shrink-0 text-right">${escapeHTML(log.timestamp)}</span>
          </div>
        `;
      })
      .join('');
  }

  const datesListEl = document.getElementById('saved-dates-list');
  if (savedDateKeys.length === 0) {
    datesListEl.innerHTML = `<p class="text-sm text-slate-500 text-center py-6">કોઈ હાજરી રેકોર્ડ સેવ થયેલ નથી.</p>`;
  } else {
    datesListEl.innerHTML = savedDateKeys
      .map((dateISO) => {
        const dayRecords = state.attendance[dateISO] || {};
        let pCount = 0;
        let hCount = 0;
        let aCount = 0;
        Object.values(dayRecords).forEach((entry) => {
          const st = typeof entry === 'string' ? entry : entry && entry.status;
          if (st === 'P') pCount++;
          else if (st === 'H') hCount++;
          else if (st === 'A') aCount++;
        });

        return `
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-extrabold text-slate-900">${escapeHTML(formatGujaratiDate(dateISO))}</p>
              <p class="text-xs text-slate-600 mt-0.5">
                <span class="text-emerald-700 font-bold">${pCount} હાજર</span> &bull;
                <span class="text-amber-700 font-bold">${hCount} અડધો</span> &bull;
                <span class="text-red-700 font-bold">${aCount} ગેરહાજર</span>
              </p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" data-rec-open-date="${dateISO}" class="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-extrabold cursor-pointer">Edit</button>
              <button type="button" data-rec-delete-date="${dateISO}" class="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-extrabold cursor-pointer">Delete</button>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

function setupRecordsEvents() {
  const tbody = document.getElementById('master-workers-tbody');
  const datesListEl = document.getElementById('saved-dates-list');
  const exportBtn = document.getElementById('export-backup-btn');
  const importInput = document.getElementById('import-backup-input');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const clearAllBtn = document.getElementById('clear-all-records-btn');
  const copyAppLinkBtn = document.getElementById('copy-app-link-btn');
  const copyAutoLoginLinkBtn = document.getElementById('copy-autologin-link-btn');

  if (copyAppLinkBtn) {
    copyAppLinkBtn.addEventListener('click', () => {
      const baseUrl = window.location.href.split('?')[0];
      const temp = document.createElement('textarea');
      temp.value = baseUrl;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        showToast('એપ લિંક કોપી થઈ ગઈ!');
      } finally {
        document.body.removeChild(temp);
      }
    });
  }

  if (copyAutoLoginLinkBtn) {
    copyAutoLoginLinkBtn.addEventListener('click', () => {
      const baseUrl = window.location.href.split('?')[0];
      const temp = document.createElement('textarea');
      temp.value = `${baseUrl}?autologin=1`;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand('copy');
        showToast('ઓટો-લોગિન લિંક કોપી થઈ ગઈ!');
      } finally {
        document.body.removeChild(temp);
      }
    });
  }

  tbody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-rec-edit-worker]');
    if (editBtn) {
      const worker = state.workers.find((w) => w.id === editBtn.dataset.recEditWorker);
      if (!worker) return;

      switchTab('attendance');
      document.getElementById('worker-edit-id').value = worker.id;
      document.getElementById('worker-name').value = worker.name;
      document.getElementById('worker-role').value = worker.role;
      document.getElementById('worker-daily-rate').value = worker.dailyRate;
      document.getElementById('worker-ot-rate').value = worker.otRate;
      document.getElementById('worker-phone').value = worker.phone || '';
      document.getElementById('worker-submit-btn').textContent = 'ફેરફાર સાચવો';
      document.getElementById('cancel-edit-worker-btn').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const delBtn = e.target.closest('[data-rec-delete-worker]');
    if (delBtn) {
      const workerId = delBtn.dataset.recDeleteWorker;
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) return;

      showConfirmModal(
        'કારીગર કાયમ માટે ડિલીટ કરો?',
        `શું તમે ખરેખર "${worker.name}" અને તેની બધી માહિતી ડિલીટ કરવા માંગો છો?`,
        async () => {
          const affectedDates = Object.keys(state.attendance).filter(
            (dKey) => state.attendance[dKey] && state.attendance[dKey][workerId]
          );
          for (const dKey of affectedDates) {
            delete state.attendance[dKey][workerId];
            await saveDateAttendanceToCloud(dKey);
          }
          await deleteWorkerFromCloud(workerId, `કારીગર "${worker.name}" ડિલીટ કર્યા.`);
          renderRecordsPage();
          showToast(`${worker.name} ની બધી માહિતી ડિલીટ થઈ ગઈ છે.`, 'info');
        }
      );
    }
  });

  datesListEl.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-rec-open-date]');
    if (openBtn) {
      state.selectedDate = openBtn.dataset.recOpenDate;
      switchTab('attendance');
      return;
    }

    const delDateBtn = e.target.closest('[data-rec-delete-date]');
    if (delDateBtn) {
      const dateISO = delDateBtn.dataset.recDeleteDate;
      showConfirmModal(
        'તારીખનો હાજરી રેકોર્ડ ડિલીટ કરો?',
        `શું તમે ખરેખર ${dateISO} ની બધી હાજરી માહિતી ડિલીટ કરવા માંગો છો?`,
        async () => {
          await deleteDateAttendanceFromCloud(dateISO, `તારીખ ${dateISO} નો રેકોર્ડ ડિલીટ કર્યો.`);
          renderRecordsPage();
          showToast(`${dateISO} નો રેકોર્ડ ડિલીટ થઈ ગયો છે.`, 'info');
        }
      );
    }
  });

  exportBtn.addEventListener('click', async () => {
    const backupPayload = {
      app: 'Century Product - Karkhano Management',
      exportedAt: new Date().toISOString(),
      exportedBy: state.currentUser,
      workers: state.workers,
      attendance: state.attendance,
      notes: state.notes,
      logs: state.logs,
    };
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Century_Karkhano_Backup_${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await recordAuditLog('બેકઅપ', `પૂરો ડેટા બેકઅપ ડાઉનલોડ કર્યો.`);
    renderRecordsPage();
    showToast('પૂરો બેકઅપ ડાઉનલોડ થઈ ગયો છે!');
  });

  importInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (Array.isArray(parsed.workers)) {
          for (const w of parsed.workers) await saveSingleWorkerToCloud(w);
        }
        if (parsed.attendance && typeof parsed.attendance === 'object') {
          for (const [dKey, recMap] of Object.entries(parsed.attendance)) {
            state.attendance[dKey] = recMap;
            await saveDateAttendanceToCloud(dKey);
          }
        }
        if (Array.isArray(parsed.notes)) {
          for (const n of parsed.notes) await saveSingleNoteToCloud(n);
        }
        await recordAuditLog('બેકઅપ રિસ્ટોર', `બેકઅપ ફાઇલ "${file.name}" રિસ્ટોર કરી.`);
        renderRecordsPage();
        showToast('બેકઅપ ફાઇલમાંથી બધો ડેટા સેવ થઈ ગયો છે!');
      } catch (err) {
        showToast('ખોટી બેકઅપ ફાઇલ છે.', 'error');
      } finally {
        importInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  clearLogsBtn.addEventListener('click', () => {
    showConfirmModal(
      'લોગિન હિસ્ટ્રી સાફ કરો?',
      'શું તમે લોગિન અને ફેરફાર હિસ્ટ્રી લિસ્ટ સાફ કરવા માંગો છો?',
      async () => {
        const oldLogs = [...state.logs];
        state.logs = [];
        saveToDeviceStorage();
        if (cloudReady && cloudUser) {
          for (const l of oldLogs) await deleteDoc(getSharedDoc('karkhano_logs', l.id)).catch(() => {});
        }
        await recordAuditLog('લોગ સાફ', `જૂની હિસ્ટ્રી સાફ કરી.`);
        renderRecordsPage();
        showToast('હિસ્ટ્રી સાફ થઈ ગઈ છે.', 'info');
      }
    );
  });

  clearAllBtn.addEventListener('click', () => {
    showConfirmModal(
      'બધા કારીગરો, હાજરી અને નોંધ ડિલીટ કરો?',
      'ચેતવણી: આનાથી બધા કારીગરો, બધી હાજરી અને બધી નોંધ કાયમ માટે ડિલીટ થઈ જશે!',
      async () => {
        const workerIds = state.workers.map((w) => w.id);
        const dateKeys = Object.keys(state.attendance);
        const noteIds = state.notes.map((n) => n.id);

        for (const wId of workerIds) await deleteWorkerFromCloud(wId);
        for (const dKey of dateKeys) await deleteDateAttendanceFromCloud(dKey);
        for (const nId of noteIds) await deleteNoteFromCloud(nId);

        await recordAuditLog('બધો ડેટા ડિલીટ', `બધા કારીગરો, હાજરી અને નોંધ ડિલીટ કર્યા.`);
        renderRecordsPage();
        showToast('બધા રેકોર્ડ્સ ડિલીટ થઈ ગયા છે.', 'info');
      }
    );
  });
}

// =========================================================================
// 10. INITIALIZE APPLICATION ON DOM READY
// =========================================================================
function bootApp() {
  const hasSaved = loadFromDeviceStorage();
  if (!hasSaved) seedStarterDataIfEmpty();
  restorePersistentLoginSession();
  setupLoginEvents();
  setupNavigationAndPWAEvents();
  setupAttendanceEvents();
  setupMonthlyEvents();
  setupNotesEvents();
  setupRecordsEvents();
  updateStorageBadge();
  updateAuthUI();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
