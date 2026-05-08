/* dashboard.js — full CRUD + overview + auth for Mark's Fade Dashboard */

/* ---- EMAILJS CONFIGURATION ---- */
const EMAILJS_SERVICE_ID = 'service_ugm87w9';
const EMAILJS_TEMPLATE_ID = 'template_9g3h2r3';
const EMAILJS_PUBLIC_KEY = 'sk3FGrUYNvxDWPn4S';

/* ---- AUTH GUARD ---- */
const currentUser = DB.session.get();
if (!currentUser) location.href = '../index.html';

/* ---- POPULATE USER INFO ---- */
document.getElementById('sidebar-name').textContent  = currentUser.firstName + ' ' + currentUser.lastName;
document.getElementById('sidebar-email').textContent = currentUser.email;
document.getElementById('sidebar-avatar').textContent = currentUser.firstName.charAt(0).toUpperCase();

/* ---- LOGOUT ---- */
document.getElementById('btn-logout').addEventListener('click', () => {
  DB.session.clear();
  location.href = '../index.html';
});

/* ---- MOBILE SIDEBAR ---- */
const sidebar    = document.getElementById('sidebar');
const overlay    = document.getElementById('sidebar-overlay');
const menuToggle = document.getElementById('menu-toggle');

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
});

/* ---- SECTION NAV ---- */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const target = item.dataset.section;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('section-' + target).classList.add('active');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    if (target === 'records') renderRecords();
    if (target === 'overview') renderOverview();
  });
});

/* "View All" in overview goes to appointments tab */
document.getElementById('ov-view-all').addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelector('[data-section="records"]').classList.add('active');
  document.getElementById('section-records').classList.add('active');
});

/* ---- TOAST ---- */
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.className = 'toast', 3200);
}

/* ====================================================
   EMAIL REMINDER - WITH CUSTOM MODAL (NO BROWSER POPUP)
====================================================*/

// Variables to track which appointment we're emailing about
let currentEmailRecord = null;

// Open email modal instead of browser prompt
window.openEmailModal = function(id) {
  // Find the record
  const record = DB.records.getByUser(currentUser.id).find(r => r.id === id);
  if (!record) {
    toast('Record not found!', 'error');
    return;
  }
  
  // Store the record for later use
  currentEmailRecord = record;
  
  // Update modal with client name
  document.getElementById('email-client-name').textContent = record.clientName;
  
  // Clear previous errors and input
  document.getElementById('email-address').value = '';
  document.getElementById('err-email-address').textContent = '';
  
  // Open the modal
  openModal('email-modal-overlay');
};

// Send email from modal
async function sendEmailFromModal() {
  if (!currentEmailRecord) {
    toast('No appointment selected', 'error');
    closeModal('email-modal-overlay');
    return;
  }
  
  // Get email from input
  const clientEmail = document.getElementById('email-address').value.trim();
  
  // Validate email
  if (!clientEmail) {
    document.getElementById('err-email-address').textContent = 'Email address is required.';
    return;
  }
  
  if (!clientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    document.getElementById('err-email-address').textContent = 'Please enter a valid email address.';
    return;
  }
  
  // Clear error
  document.getElementById('err-email-address').textContent = '';
  
  // Close modal
  closeModal('email-modal-overlay');
  
  // Find the button to show loading state
  const btn = document.querySelector(`.email-btn[data-id="${currentEmailRecord.id}"]`);
  const originalHTML = btn ? btn.innerHTML : 'Send Email';
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '📧 Sending...';
  }
  
  try {
    // Format dates nicely
    const formattedDate = formatDateForEmail(currentEmailRecord.date);
    const formattedTime = formatTimeForEmail(currentEmailRecord.time);
    
    // Template parameters that match your Order Confirmation template
    const templateParams = {
      email: clientEmail,
      clientName: currentEmailRecord.clientName,
      service: currentEmailRecord.service,
      date: formattedDate,
      time: formattedTime
    };
    
    console.log('Sending email to:', clientEmail);
    console.log('Template params:', templateParams);
    
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );
    
    console.log('✅ Email sent successfully!', response);
    toast(`✅ Appointment reminder sent to ${clientEmail}!`, 'success');
    
  } catch (error) {
    console.error('❌ Email failed:', error);
    
    let errorMsg = 'Failed to send email. ';
    if (error.status === 422) {
      errorMsg = 'Email failed: Make sure you entered a valid email address';
    } else if (error.text) {
      try {
        const errData = JSON.parse(error.text);
        errorMsg += errData.message || error.text;
      } catch {
        errorMsg += error.text;
      }
    } else if (error.message) {
      errorMsg += error.message;
    }
    
    toast(errorMsg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
    currentEmailRecord = null;
  }
}

// Helper function for email date formatting
function formatDateForEmail(d) {
  if (!d) return 'Not specified';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Helper function for email time formatting
function formatTimeForEmail(t) {
  if (!t) return 'Not specified';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/* ====================================================
   LIVE CLOCK
====================================================*/
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (!timeEl) return;

  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  timeEl.textContent = `${h}:${m}:${s} ${ampm}`;

  dateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
updateClock();
setInterval(updateClock, 1000);

/* ====================================================
   HELPER: Sort appointments by date + time (ascending)
====================================================*/
function getAppointmentsByDateAndTime(records) {
  return [...records].sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time || '00:00'}`);
    const dateTimeB = new Date(`${b.date}T${b.time || '00:00'}`);
    return dateTimeA - dateTimeB;
  });
}

/* ====================================================
   OVERVIEW
====================================================*/
function renderOverview() {
  const all = DB.records.getByUser(currentUser.id);
  const sortedByDateTime = getAppointmentsByDateAndTime(all);
  
  document.getElementById('ov-total').textContent = all.length;
  document.getElementById('ov-done').textContent = all.filter(r => r.status === 'Completed').length;
  document.getElementById('ov-scheduled').textContent = all.filter(r => r.status === 'Scheduled').length;
  document.getElementById('ov-cancelled').textContent = all.filter(r => r.status === 'Cancelled').length;

  const sortedByCreated = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const tbody = document.getElementById('ov-recent-body');
  const empty = document.getElementById('ov-empty');

  if (sortedByCreated.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    const numberMap = new Map();
    sortedByDateTime.forEach((r, idx) => {
      numberMap.set(r.id, idx + 1);
    });
    
    tbody.innerHTML = sortedByCreated.map(r => `
      <tr>
        <td>#${numberMap.get(r.id) || '?'}</td>
        <td><span class="client-name">${esc(r.clientName)}</span></td>
        <td>${esc(r.service)}</td>
        <td>${formatDate(r.date)} ${formatTime(r.time)}</td>
        <td><span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span></td>
      </tr>
    `).join('');
  }

  renderServiceBreakdown(all);
}

function renderServiceBreakdown(all) {
  const container = document.getElementById('service-breakdown');
  
  if (all.length === 0) {
    container.innerHTML = '<div class="ov-empty">No data yet</div>';
    return;
  }

  const counts = {};
  all.forEach(r => { counts[r.service] = (counts[r.service] || 0) + 1; });

  const sortedServices = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = all.length;
  const colors = ['#e03030', '#888888', '#e07020', '#4488dd', '#55cc77', '#ddbb44', '#cc77ee'];

  let cumulativePercent = 0;
  const segments = sortedServices.map(([service, count], i) => {
    const pct = count / total;
    const startAngle = cumulativePercent * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumulativePercent + pct) * 2 * Math.PI - Math.PI / 2;
    cumulativePercent += pct;

    const cx = 80, cy = 80, r = 58, innerR = 38;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(endAngle);
    const yi1 = cy + innerR * Math.sin(endAngle);
    const xi2 = cx + innerR * Math.cos(startAngle);
    const yi2 = cy + innerR * Math.sin(startAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi1} ${yi1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi2} ${yi2}`,
      'Z'
    ].join(' ');

    return { d, color: colors[i % colors.length], service, count, pct };
  });

  const svgSegments = segments.map(seg => 
    `<path d="${seg.d}" fill="${seg.color}" stroke="#1a1a1a" stroke-width="2"/>`
  ).join('');

  const legendItems = sortedServices.slice(0, 4).map(([service, count], i) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${colors[i % colors.length]}"></span>
        <span class="donut-legend-label">${esc(service)} ${pct}%</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="donut-chart-wrap">
      <svg viewBox="0 0 160 160" width="160" height="160" class="donut-svg">
        ${svgSegments}
        <text x="80" y="74" text-anchor="middle" fill="#ffffff" font-family="Bebas Neue, sans-serif" font-size="22" letter-spacing="1">${total}</text>
        <text x="80" y="90" text-anchor="middle" fill="#888888" font-family="Barlow, sans-serif" font-size="8" letter-spacing="1.5">TOTAL</text>
      </svg>
      <div class="donut-legend">
        ${legendItems}
      </div>
    </div>
  `;
}

/* ====================================================
   RECORDS CRUD
====================================================*/
let editingId   = null;
let deleteId    = null;
let searchQuery = '';

/* ---- RENDER TABLE ---- */
function renderRecords() {
  const allUserRecords = DB.records.getByUser(currentUser.id);
  const records = searchQuery
    ? DB.records.search(currentUser.id, searchQuery)
    : allUserRecords;

  const tbody = document.getElementById('records-body');
  const empty = document.getElementById('empty-state');

  if (records.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    updateStats();
    return;
  }
  
  empty.classList.add('hidden');
  
  const sortedAllByDateTime = getAppointmentsByDateAndTime(allUserRecords);
  const numberMap = new Map();
  sortedAllByDateTime.forEach((r, idx) => {
    numberMap.set(r.id, idx + 1);
  });
  
  tbody.innerHTML = records.map(record => {
    const appointmentNumber = numberMap.get(record.id) || '?';
    const hasNotes = record.notes && record.notes.trim() !== '';
    
    return `
      <tr>
        <td class="appt-num">#${appointmentNumber}</td>
        <td>
          <div class="client-name">${esc(record.clientName)}</div>
          ${hasNotes ? `<div class="client-notes">${esc(record.notes)}</div>` : ''}
        </td>
        <td>${esc(record.service)}</td>
        <td>${formatDate(record.date)} ${formatTime(record.time)}</td>
        <td>${record.phone ? esc(record.phone) : '—'}</td>
        <td><span class="badge ${badgeClass(record.status)}">${esc(record.status)}</span></td>
        <td>
          <div class="action-btns">
            <button class="action-btn" onclick="window.openEdit('${record.id}')" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn delete" onclick="window.openDelete('${record.id}', '${esc(record.clientName)}')" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
            <button class="action-btn email-btn" data-id="${record.id}" onclick="window.openEmailModal('${record.id}')" title="Send Email Reminder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  updateStats();
}

/* ---- UPDATE STATS ---- */
function updateStats() {
  const all = DB.records.getByUser(currentUser.id);
  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-scheduled').textContent = all.filter(r => r.status === 'Scheduled').length;
  document.getElementById('stat-done').textContent = all.filter(r => r.status === 'Completed').length;
  document.getElementById('stat-cancelled').textContent = all.filter(r => r.status === 'Cancelled').length;
}

/* ---- HELPERS ---- */
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function badgeClass(s) {
  const m = { 
    'Scheduled': 'badge-scheduled', 
    'Completed': 'badge-completed', 
    'Cancelled': 'badge-cancelled', 
    'No Show': 'badge-no-show' 
  };
  return m[s] || 'badge-scheduled';
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/* ---- SEARCH ---- */
const searchInput = document.getElementById('search-input');
const clearSearch = document.getElementById('clear-search');

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    if (clearSearch) {
      clearSearch.classList.toggle('hidden', !searchQuery);
    }
    renderRecords();
  });
}

if (clearSearch) {
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearch.classList.add('hidden');
    renderRecords();
  });
}

/* ---- OPEN ADD MODAL ---- */
const addBtn = document.getElementById('btn-add-record');
if (addBtn) {
  addBtn.addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add Appointment';
    document.getElementById('btn-modal-save').textContent = 'Save Record';
    clearModalFields();
    clearModalErrors();
    openModal('modal-overlay');
  });
}

/* ---- OPEN EDIT MODAL ---- */
window.openEdit = function(id) {
  const rec = DB.records.getByUser(currentUser.id).find(r => r.id === id);
  if (!rec) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Appointment';
  document.getElementById('btn-modal-save').textContent = 'Update Record';
  clearModalErrors();
  document.getElementById('m-clientName').value = rec.clientName || '';
  document.getElementById('m-service').value    = rec.service    || '';
  document.getElementById('m-date').value       = rec.date       || '';
  document.getElementById('m-time').value       = rec.time       || '';
  document.getElementById('m-phone').value      = rec.phone      || '';
  document.getElementById('m-status').value     = rec.status     || 'Scheduled';
  document.getElementById('m-notes').value      = rec.notes      || '';
  openModal('modal-overlay');
};

/* ---- OPEN DELETE CONFIRM ---- */
window.openDelete = function(id, name) {
  deleteId = id;
  const deleteNameSpan = document.getElementById('delete-name');
  if (deleteNameSpan) deleteNameSpan.textContent = name;
  openModal('delete-overlay');
};

/* ---- SAVE RECORD ---- */
const saveBtn = document.getElementById('btn-modal-save');
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    clearModalErrors();
    const clientName = document.getElementById('m-clientName').value.trim();
    const service    = document.getElementById('m-service').value;
    const date       = document.getElementById('m-date').value;
    const time       = document.getElementById('m-time').value;
    const phone      = document.getElementById('m-phone').value.trim();
    const status     = document.getElementById('m-status').value;
    const notes      = document.getElementById('m-notes').value.trim();

    let valid = true;
    if (!clientName) { setModalErr('err-m-clientName', 'Client name required.'); valid = false; }
    if (!service)    { setModalErr('err-m-service', 'Please select a service.'); valid = false; }
    if (!date)       { setModalErr('err-m-date', 'Date required.'); valid = false; }
    if (!time)       { setModalErr('err-m-time', 'Time required.'); valid = false; }
    if (!valid) return;

    if (editingId) {
      DB.records.update(editingId, { clientName, service, date, time, phone, status, notes });
      toast('Appointment updated!', 'success');
    } else {
      DB.records.create({ userId: currentUser.id, clientName, service, date, time, phone, status, notes });
      toast('Appointment added!', 'success');
    }
    closeModal('modal-overlay');
    renderRecords();
    renderOverview();
  });
}

/* ---- CONFIRM DELETE ---- */
const deleteConfirmBtn = document.getElementById('btn-delete-confirm');
if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener('click', () => {
    if (deleteId) {
      DB.records.delete(deleteId);
      deleteId = null;
      toast('Record deleted.', '');
      closeModal('delete-overlay');
      renderRecords();
      renderOverview();
    }
  });
}

/* ---- MODAL HELPERS ---- */
function openModal(id)  { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden'); 
}
function closeModal(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden'); 
}
function setModalErr(id, msg) { 
  const el = document.getElementById(id); 
  if (el) el.textContent = msg; 
}
function clearModalErrors() { 
  document.querySelectorAll('.field-error').forEach(e => e.textContent = ''); 
}
function clearModalFields() {
  const fieldIds = ['m-clientName','m-service','m-date','m-time','m-phone','m-notes'];
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const statusSelect = document.getElementById('m-status');
  if (statusSelect) statusSelect.value = 'Scheduled';
}

// Modal close handlers
const modalClose = document.getElementById('modal-close');
if (modalClose) modalClose.addEventListener('click', () => closeModal('modal-overlay'));
const modalCancel = document.getElementById('btn-modal-cancel');
if (modalCancel) modalCancel.addEventListener('click', () => closeModal('modal-overlay'));
const deleteClose = document.getElementById('delete-close');
if (deleteClose) deleteClose.addEventListener('click', () => closeModal('delete-overlay'));
const deleteCancel = document.getElementById('btn-delete-cancel');
if (deleteCancel) deleteCancel.addEventListener('click', () => closeModal('delete-overlay'));

// Email modal close handlers
const emailModalClose = document.getElementById('email-modal-close');
if (emailModalClose) {
  emailModalClose.addEventListener('click', () => closeModal('email-modal-overlay'));
}

const emailCancelBtn = document.getElementById('btn-email-cancel');
if (emailCancelBtn) {
  emailCancelBtn.addEventListener('click', () => closeModal('email-modal-overlay'));
}

const emailSendBtn = document.getElementById('btn-email-send');
if (emailSendBtn) {
  emailSendBtn.addEventListener('click', sendEmailFromModal);
}

// Click outside to close email modal
const emailModalOverlay = document.getElementById('email-modal-overlay');
if (emailModalOverlay) {
  emailModalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal('email-modal-overlay');
  });
}

// Click outside to close
const modalOverlay = document.getElementById('modal-overlay');
if (modalOverlay) {
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal('modal-overlay');
  });
}
const deleteOverlay = document.getElementById('delete-overlay');
if (deleteOverlay) {
  deleteOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal('delete-overlay');
  });
}

/* ---- INIT ---- */
renderOverview();
renderRecords();