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
  if (el.value) {
    el.classList.add('filled');
    if (idx < 5) boxes[idx + 1].focus();
  }
  el.addEventListener('keydown', function h(e) {
    if (e.key === 'Backspace' && !el.value && idx > 0) {
      boxes[idx - 1].focus();
      boxes[idx - 1].value = '';
      boxes[idx - 1].classList.remove('filled');
    }
  }, { once: true });
  // Auto-submit when last digit entered
  if (idx === 5 && el.value) setTimeout(doVerifyOtp, 200);
}

function getOtp(rowId) {
  return [...document.getElementById(rowId).querySelectorAll('.otp-i')].map(b => b.value).join('');
}
function clearOtp(rowId) {
  document.getElementById(rowId).querySelectorAll('.otp-i').forEach(b => {
    b.value = ''; b.classList.remove('filled');
  });
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
  } else {
    aToast(res.data?.message || 'Registration failed', 'err');
  }
}

// ── LOGIN ─────────────────────────────────────────────
async function doLogin() {
  const username = gv('l-u'), password = gv('l-p');
  if (!username || !password) return aToast('Enter your credentials', 'err');
  aToast('Signing in…');

  const res = await API.login({ username, password });

  // Log the full response so we can debug if needed
  console.log('[Login] response:', JSON.stringify(res.data));

  if (!res.ok) {
    return aToast(res.data?.message || 'Invalid credentials', 'err');
  }

  // ── Case 1: Normal login — token returned directly ──
  if (res.data.token || res.data.accessToken) {
    return finishLogin(res.data.token || res.data.accessToken, res.data.user);
  }

  // ── Case 2: 2FA required ──────────────────────────
  // Handles all known backend response shapes:
  //   { requiresTwoFactor: true, userId: "..." }
  //   { twoFactorRequired: true, userId: "..." }
  //   { requires2FA: true }
  //   { status: "2fa_required" }
  //   { userId: "...", token: undefined }   ← original shape
  const needs2FA =
    res.data.requiresTwoFactor  === true ||
    res.data.twoFactorRequired  === true ||
    res.data.requires2FA        === true ||
    res.data.twoFactor          === true ||
    res.data.status             === '2fa_required' ||
    res.data.status             === '2fa' ||
    // Original fallback: no token but userId present
    (!res.data.token && !res.data.accessToken && (res.data.userId || res.data.user?._id));

  if (needs2FA) {
    // Store the identifier the backend needs for /auth/verify-2fa
    AUTH.otpMode      = '2fa';
    AUTH.pending2FAId =
      res.data.userId       ||
      res.data.tempUserId   ||
      res.data.user?._id    ||
      res.data.id           ||
      null;

    console.log('[2FA] required, pending ID:', AUTH.pending2FAId);

    document.getElementById('verifyDesc').textContent = 'Enter the 2FA code sent to your email';
    clearOtp('otpRow');
    S('sVerify');
    // Auto-focus first OTP box
    setTimeout(() => document.querySelector('#otpRow .otp-i')?.focus(), 120);
    aToast('Check your email for the 2FA code', 'ok');
    return;
  }

  // ── Case 3: Truly unexpected response ─────────────
  console.warn('[Login] unexpected response shape:', res.data);
  aToast(res.data?.message || 'Unexpected response — check console', 'err');
}

// ── VERIFY OTP (handles both email verify + 2FA) ──────
async function doVerifyOtp() {
  const otp = getOtp('otpRow');
  if (otp.length < 6) return aToast('Enter the full 6-digit code', 'err');

  if (AUTH.otpMode === 'verify') {
    // ── Email verification after registration ────────
    const res = await API.verifyEmail({ email: AUTH.pendingEmail, otp });
    if (res.ok) {
      aToast('Email verified! Sign in now.', 'ok');
      setTimeout(() => S('sLogin'), 1200);
    } else {
      aToast(res.data?.message || 'Invalid code', 'err');
    }

  } else if (AUTH.otpMode === '2fa') {
    // ── 2FA verification after login ─────────────────
    // Send every possible field name so the backend accepts it
    const payload = { otp };
    if (AUTH.pending2FAId) {
      payload.userId    = AUTH.pending2FAId;
      payload.tempToken = AUTH.pending2FAId;
      payload.id        = AUTH.pending2FAId;
    }

    console.log('[2FA] verifying with payload:', JSON.stringify(payload));

    const res = await API.verify2FA(payload);

    console.log('[2FA] verify response:', JSON.stringify(res.data));

    if (res.ok && (res.data.token || res.data.accessToken)) {
      finishLogin(res.data.token || res.data.accessToken, res.data.user);
    } else if (res.ok && !res.data.token) {
      // Backend returned ok but no token — log it
      console.warn('[2FA] ok but no token in response:', res.data);
      aToast(res.data?.message || 'Verification ok but no token received', 'err');
    } else {
      aToast(res.data?.message || 'Invalid 2FA code', 'err');
      // Clear boxes so user can retype
      clearOtp('otpRow');
      setTimeout(() => document.querySelector('#otpRow .otp-i')?.focus(), 50);
    }
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
  } else {
    aToast(res.data?.message || 'Failed', 'err');
  }
}

async function doResetPassword() {
  const otp = getOtp('resetOtpRow'), newPassword = gv('rp-p');
  if (otp.length < 6 || !newPassword) return aToast('Fill all fields', 'err');
  const res = await API.resetPassword({ email: AUTH.resetEmail, otp, newPassword });
  if (res.ok) {
    aToast('Password reset! Sign in now.', 'ok');
    setTimeout(() => S('sLogin'), 1200);
  } else {
    aToast(res.data?.message || 'Failed', 'err');
  }
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
  try {
    const t = localStorage.getItem('cba_token');
    if (t) { API.set(t); return true; }
  } catch (e) {}
  return false;
}

function gv(id) { return (document.getElementById(id)?.value || '').trim(); }