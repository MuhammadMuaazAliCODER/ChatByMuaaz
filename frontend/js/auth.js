// ── AUTH MODULE ──────────────────────────────────────
const AUTH = {
  pendingEmail: null,
  otpMode: null,   // 'verify' | '2fa' | 'reset'
  pending2FAId: null,
  resetEmail: null,
};

// ── Screen switch ────────────────────────────────────
function S(id) {
  document.querySelectorAll('.auth-card').forEach(c => c.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
  clearAToast();
}

// ── OTP navigation ───────────────────────────────────
function otpNav(el, idx, rowId) {
  const boxes = [...document.getElementById(rowId).querySelectorAll('.otp-i')];
  if (el.value) { el.classList.add('filled'); if (idx < 5) boxes[idx + 1].focus(); }
  el.addEventListener('keydown', function h(e) {
    if (e.key === 'Backspace' && !el.value && idx > 0) { boxes[idx - 1].focus(); boxes[idx - 1].value = ''; boxes[idx - 1].classList.remove('filled'); }
  }, { once: true });
  if (idx === 5 && el.value) setTimeout(doVerifyOtp, 200);
}

function getOtp(rowId) {
  return [...document.getElementById(rowId).querySelectorAll('.otp-i')].map(b => b.value).join('');
}
function clearOtp(rowId) {
  document.getElementById(rowId).querySelectorAll('.otp-i').forEach(b => { b.value = ''; b.classList.remove('filled'); });
}

// ── Auth toast ───────────────────────────────────────
function aToast(msg, type = '') {
  const el = document.getElementById('aToast');
  el.textContent = msg; el.className = `a-toast show ${type}`;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4000);
}
function clearAToast() { document.getElementById('aToast')?.classList.remove('show'); }

// ── Eye toggle ───────────────────────────────────────
function toggleEye(id, btn) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.style.opacity = i.type === 'text' ? '0.5' : '1';
}

// ── REGISTER ─────────────────────────────────────────
async function doRegister() {
  const name = gv('r-n'), username = gv('r-u'), email = gv('r-e'), password = gv('r-p');
  if (!name || !username || !email || !password) return aToast('Fill in all fields', 'err');
  aToast('Creating account…');
  const res = await API.register({ name, username, email, password });
  if (res.ok) {
    AUTH.pendingEmail = email;
    AUTH.otpMode = 'verify';
    document.getElementById('verifyDesc').textContent = `Code sent to ${email}`;
    clearOtp('otpRow'); S('sVerify');
    aToast('Check your email!', 'ok');
  } else { aToast(res.data?.message || 'Registration failed', 'err'); }
}

// ── LOGIN ─────────────────────────────────────────────
async function doLogin() {
  const username = gv('l-u'), password = gv('l-p');
  if (!username || !password) return aToast('Enter your credentials', 'err');
  aToast('Signing in…');
  const res = await API.login({ username, password });
  if (res.ok) {
    if (res.data.token) {
      finishLogin(res.data.token, res.data.user);
    } else if (res.data.userId || res.data.user?._id) {
      AUTH.otpMode = '2fa';
      AUTH.pending2FAId = res.data.userId || res.data.user?._id;
      document.getElementById('verifyDesc').textContent = 'Enter the 2FA code from your email';
      clearOtp('otpRow'); S('sVerify');
    } else { aToast(res.data?.message || 'Unexpected response', 'err'); }
  } else { aToast(res.data?.message || 'Invalid credentials', 'err'); }
}

// ── VERIFY OTP ────────────────────────────────────────
async function doVerifyOtp() {
  const otp = getOtp('otpRow');
  if (otp.length < 6) return aToast('Enter the full 6-digit code', 'err');

  if (AUTH.otpMode === 'verify') {
    const res = await API.verifyEmail({ email: AUTH.pendingEmail, otp });
    if (res.ok) { aToast('Email verified! Sign in now.', 'ok'); setTimeout(() => S('sLogin'), 1200); }
    else aToast(res.data?.message || 'Invalid code', 'err');
  } else if (AUTH.otpMode === '2fa') {
    const res = await API.verify2FA({ userId: AUTH.pending2FAId, otp });
    if (res.ok && res.data.token) finishLogin(res.data.token, res.data.user);
    else aToast(res.data?.message || 'Invalid code', 'err');
  }
}

async function doResendOtp() {
  if (!AUTH.pendingEmail) return;
  const res = await API.resendVerification({ email: AUTH.pendingEmail });
  aToast(res.ok ? 'Code resent!' : (res.data?.message || 'Failed'), res.ok ? 'ok' : 'err');
}

// ── FORGOT / RESET ────────────────────────────────────
async function doForgotPassword() {
  const email = gv('fp-e');
  if (!email) return aToast('Enter your email', 'err');
  const res = await API.forgotPassword({ email });
  if (res.ok) {
    AUTH.resetEmail = email; clearOtp('resetOtpRow'); S('sReset');
    aToast('Reset code sent!', 'ok');
  } else aToast(res.data?.message || 'Failed', 'err');
}

async function doResetPassword() {
  const otp = getOtp('resetOtpRow'), newPassword = gv('rp-p');
  if (otp.length < 6 || !newPassword) return aToast('Fill all fields', 'err');
  const res = await API.resetPassword({ email: AUTH.resetEmail, otp, newPassword });
  if (res.ok) { aToast('Password reset! Sign in now.', 'ok'); setTimeout(() => S('sLogin'), 1200); }
  else aToast(res.data?.message || 'Failed', 'err');
}

// ── FINISH LOGIN ──────────────────────────────────────
function finishLogin(token, user) {
  API.set(token);
  try { localStorage.setItem('cba_token', token); } catch (e) {}
  APP.me = user || {};
  clearAToast();
  startApp();
}

// ── Session restore ───────────────────────────────────
function tryRestore() {
  try { const t = localStorage.getItem('cba_token'); if (t) { API.set(t); return true; } } catch (e) {}
  return false;
}

function gv(id) { return (document.getElementById(id)?.value || '').trim(); }
