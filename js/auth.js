const EMAILJS_SERVICE_ID  = 'service_ugm87w9';
const EMAILJS_TEMPLATE_ID = 'template_6e520ik';
const EMAILJS_PUBLIC_KEY  = 'sk3FGrUYNvxDWPn4S';

/* ---- redirect if already logged in ---- */
if (DB.session.isLoggedIn()) location.href = 'pages/dashboard.html';

/* ============================================================
   TAB SWITCHING
   ============================================================ */
const tabs   = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.form-panel');

function switchTab(name) {
  tabs.forEach(t   => t.classList.toggle('active', t.dataset.tab === name));
  panels.forEach(p => p.classList.toggle('active', p.id === name + '-panel'));
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

document.querySelectorAll('[data-switch]').forEach(el =>
  el.addEventListener('click', e => { e.preventDefault(); switchTab(el.dataset.switch); })
);

/* ============================================================
   TOAST
   ============================================================ */
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.className = 'toast', 3500);
}

/* ============================================================
   ERROR HELPERS
   ============================================================ */
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  document.querySelectorAll('.form-error').forEach(e => e.textContent = '');
}

function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/* ============================================================
   PASSWORD VISIBILITY TOGGLES
   ============================================================ */
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input  = document.getElementById(btn.dataset.target);
    const open   = btn.querySelector('.eye-open');
    const closed = btn.querySelector('.eye-closed');
    if (input.type === 'password') {
      input.type = 'text';
      open.classList.add('hidden');
      closed.classList.remove('hidden');
    } else {
      input.type = 'password';
      open.classList.remove('hidden');
      closed.classList.add('hidden');
    }
  });
});

/* ============================================================
   PASSWORD STRENGTH METER
   Scores: 1=weak  2=fair  3=good  4=strong
   ============================================================ */
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  score = Math.min(4, Math.max(1, score));
  const map = {
    1: { label: 'Weak',   color: '#e03030' },
    2: { label: 'Fair',   color: '#ddbb44' },
    3: { label: 'Good',   color: '#4488dd' },
    4: { label: 'Strong', color: '#55cc77' },
  };
  return { score, ...map[score] };
}

function renderStrengthMeter(inputId, meterId) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  if (!input || !meter) return;
  input.addEventListener('input', () => {
    const { score, label, color } = getPasswordStrength(input.value);
    const bars     = meter.querySelectorAll('.strength-bar');
    const labelEl  = meter.querySelector('.strength-label');
    bars.forEach((bar, i) => {
      bar.style.background  = i < score ? color : 'var(--surface2, #2a2a2a)';
      bar.style.transition  = 'background 0.25s ease';
    });
    if (labelEl) {
      labelEl.textContent = input.value ? label : '';
      labelEl.style.color = color;
    }
  });
}

// Attach to register form
renderStrengthMeter('reg-password', 'reg-password-meter');

/* ============================================================
   SIGN IN
   ============================================================ */
document.getElementById('btn-signin').addEventListener('click', () => {
  clearErrors();
  const username = document.getElementById('signin-username').value.trim();
  const password = document.getElementById('signin-password').value;
  let valid = true;

  if (!username) { setErr('err-signin-username', 'Username is required.'); valid = false; }
  if (!password) { setErr('err-signin-password', 'Password is required.'); valid = false; }
  if (!valid) return;

  const result = DB.users.authenticate(username, password);
  if (!result.ok) {
    document.getElementById('signin-form-error').textContent = result.error;
    return;
  }
  DB.session.set(result.user);
  toast('Welcome back, ' + result.user.firstName + '!', 'success');
  setTimeout(() => location.href = 'pages/dashboard.html', 700);
});

/* ============================================================
   FORGOT PASSWORD — show panel
   ============================================================ */
const forgotLink = document.getElementById('forgot-link');
if (forgotLink) {
  forgotLink.addEventListener('click', e => {
    e.preventDefault();
    panels.forEach(p => p.classList.remove('active'));
    tabs.forEach(t  => t.classList.remove('active'));
    const fp = document.getElementById('forgot-panel');
    if (fp) fp.classList.add('active');
  });
}

const backToSignin = document.getElementById('back-to-signin');
if (backToSignin) {
  backToSignin.addEventListener('click', e => { e.preventDefault(); switchTab('signin'); });
}

/* ============================================================
   FORGOT PASSWORD — send email via EmailJS
   ============================================================ */
const btnForgot = document.getElementById('btn-forgot');
if (btnForgot) {
  btnForgot.addEventListener('click', async () => {
    clearErrors();
    const email = document.getElementById('forgot-email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('err-forgot-email', 'Please enter a valid email address.');
      return;
    }

    const user = DB.users.findByEmail(email);

    if (user) {
      const token = DB.resetTokens.create(email);
      // UPDATED: Point to the new reset-password.html page
      const resetLink = 'https://andreiariar.github.io/marks-fade/reset-password.html?token=' + token;

      btnForgot.disabled = true;
      btnForgot.textContent = 'Sending…';

      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          { to_email: email, user_name: user.firstName, reset_link: resetLink },
          EMAILJS_PUBLIC_KEY
        );
        console.log('Reset email sent successfully to:', email);
      } catch (err) {
        console.error('EmailJS error:', err);
        // Silent fail — never reveal whether email exists
      } finally {
        btnForgot.disabled = false;
        btnForgot.textContent = 'Send Reset Link';
      }
    }

    // Always show success (security: don't leak if email is registered)
    const fp = document.getElementById('forgot-panel');
    if (fp) {
      fp.innerHTML = `
        <div class="reset-sent">
          <svg viewBox="0 0 24 24" fill="none" stroke="#55cc77" stroke-width="1.5" width="48" height="48">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 1.6 5.18 2 2 0 0 1 3.56 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 20z"/>
          </svg>
          <h3>Check your inbox</h3>
          <p>If an account exists for <strong>${escHtml(email)}</strong>, a reset link has been sent. It expires in <strong>30 minutes</strong>.</p>
          <a href="#" id="back-from-sent" class="auth-link">Back to Sign In</a>
        </div>
      `;
      document.getElementById('back-from-sent').addEventListener('click', e => {
        e.preventDefault();
        location.href = window.location.pathname;
      });
    }
  });
}

/* ============================================================
   RESET PASSWORD PANEL (landed from email link on index.html)
   NOTE: This is for the OLD ?reset= flow. The NEW flow uses reset-password.html
   ============================================================ */
function showResetPanel(token, email) {
  document.querySelector('.tabs')?.classList.add('hidden');
  panels.forEach(p => p.classList.remove('active'));

  const div = document.createElement('div');
  div.id = 'reset-panel';
  div.className = 'form-panel active';
  div.innerHTML = `
    <h2 class="panel-title">Set New Password</h2>
    <p style="color:#888;font-size:13px;margin-bottom:18px;">Resetting for <strong style="color:#ccc">${escHtml(email)}</strong></p>
    <div class="field">
      <label>New Password *</label>
      <div class="input-wrap">
        <span class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
        <input type="password" id="reset-password" placeholder="New password"/>
        <button type="button" class="toggle-pw" data-target="reset-password">
          <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="eye-closed hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        </button>
      </div>
      <div id="reset-password-meter" class="strength-meter">
        <div class="strength-bars"><div class="strength-bar"></div><div class="strength-bar"></div><div class="strength-bar"></div><div class="strength-bar"></div></div>
        <span class="strength-label"></span>
      </div>
      <span class="field-error" id="err-reset-password"></span>
    </div>
    <div class="field">
      <label>Confirm Password *</label>
      <div class="input-wrap">
        <span class="input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
        <input type="password" id="reset-confirm" placeholder="Confirm password"/>
      </div>
      <span class="field-error" id="err-reset-confirm"></span>
    </div>
    <button class="btn-red" id="btn-reset-save" style="width:100%;justify-content:center;margin-top:4px;">Set New Password</button>
  `;

  const firstPanel = document.querySelector('.form-panel');
  firstPanel ? firstPanel.parentNode.insertBefore(div, firstPanel) : document.body.appendChild(div);

  div.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input  = document.getElementById(btn.dataset.target);
      const open   = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (input.type === 'password') { input.type='text'; open.classList.add('hidden'); closed.classList.remove('hidden'); }
      else { input.type='password'; open.classList.remove('hidden'); closed.classList.add('hidden'); }
    });
  });

  renderStrengthMeter('reset-password', 'reset-password-meter');

  document.getElementById('btn-reset-save').addEventListener('click', () => {
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    const pw      = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-confirm').value;
    let valid = true;

    if (!pw || pw.length < 6) { setErr('err-reset-password', 'Min 6 characters.'); valid = false; }
    if (pw !== confirm)        { setErr('err-reset-confirm', 'Passwords do not match.'); valid = false; }
    if (!valid) return;

    const check = DB.resetTokens.verify(token);
    if (!check.ok) { setErr('err-reset-password', check.error); return; }

    DB.users.resetPassword(email, pw);
    DB.resetTokens.consume(token);

    div.innerHTML = `
      <div class="reset-sent">
        <svg viewBox="0 0 24 24" fill="none" stroke="#55cc77" stroke-width="1.5" width="48" height="48"><polyline points="20 6 9 17 4 12"/></svg>
        <h3>Password updated!</h3>
        <p>Your password has been changed successfully.</p>
        <a href="${window.location.pathname}" class="btn-red" style="display:inline-flex;justify-content:center;margin-top:8px;text-decoration:none;">Go to Sign In</a>
      </div>
    `;
  });
}

function showTokenError(message) {
  panels.forEach(p => p.classList.remove('active'));
  document.querySelector('.tabs')?.classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'form-panel active';
  div.innerHTML = `
    <div class="reset-sent">
      <svg viewBox="0 0 24 24" fill="none" stroke="#e03030" stroke-width="1.5" width="48" height="48">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h3>Link invalid</h3>
      <p>${escHtml(message)}</p>
      <a href="${window.location.pathname}" class="auth-link">Back to Sign In</a>
    </div>
  `;
  const firstPanel = document.querySelector('.form-panel');
  firstPanel ? firstPanel.parentNode.insertBefore(div, firstPanel) : document.body.appendChild(div);
}

/* ============================================================
   REGISTER
   ============================================================ */
document.getElementById('btn-register').addEventListener('click', () => {
  clearErrors();
  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const phone     = document.getElementById('reg-phone').value.trim();
  const username  = document.getElementById('reg-username').value.trim();
  const password  = document.getElementById('reg-password').value;
  const confirm   = document.getElementById('reg-confirm').value;
  let valid = true;

  if (!firstName) { setErr('err-reg-firstname', 'Required.'); valid = false; }
  if (!lastName)  { setErr('err-reg-lastname',  'Required.'); valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('err-reg-email', 'Valid email required.'); valid = false; }
  if (!phone)     { setErr('err-reg-phone',     'Required.'); valid = false; }
  if (!username || username.length < 3) { setErr('err-reg-username', 'Min 3 characters.'); valid = false; }
  if (!password || password.length < 6) { setErr('err-reg-password', 'Min 6 characters.'); valid = false; }
  if (password !== confirm) { setErr('err-reg-confirm', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const result = DB.users.create({ firstName, lastName, email, phone, username, password });
  if (!result.ok) {
    document.getElementById('register-form-error').textContent = result.error;
    return;
  }
  toast('Account created! Please sign in.', 'success');
  setTimeout(() => switchTab('signin'), 800);
});

/* ============================================================
   UTILITY
   ============================================================ */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   INIT — check for reset token in URL (backward compatibility)
   ============================================================ */
const urlParams  = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('reset');
if (resetToken) {
  const check = DB.resetTokens.verify(resetToken);
  if (check.ok) {
    showResetPanel(resetToken, check.email);
  } else {
    showTokenError(check.error);
  }
}