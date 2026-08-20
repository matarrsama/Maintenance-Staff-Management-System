// Firebase Authentication helper.
//
// When Firebase is configured, uses email/password auth. Otherwise runs in a
// "local demo" mode where any email/password signs in. Exposes `window.Auth`
// and a global `window.signOut()` for the pages' inline onclick handlers.
import { getApp, configured as isCloud } from './firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { DB } from './store.js';

const SESSION_KEY = 'bansang_auth_session';

let auth = null;
let currentUser = null;

function getAuthInstance() {
  if (!isCloud) return null;
  if (!auth) auth = getAuth(getApp());
  return auth;
}

function session() {
  try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; }
}

function setSession(email) {
  try { sessionStorage.setItem(SESSION_KEY, email || ''); } catch (e) {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function headerDisplayName() {
  const p = (window.DB && DB.getDoc('profile')) || {};
  const pname = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  if (pname) return pname;
  if (currentUser) {
    if (currentUser.displayName) return currentUser.displayName;
    if (currentUser.email) return currentUser.email;
  }
  return 'HOD - Maintenance Unit';
}

function headerInitials() {
  const parts = headerDisplayName().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return 'HO';
  return ((parts[0][0] || 'H') + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export function fillHeader() {
  const name = headerDisplayName();
  document.querySelectorAll('[data-user-name]').forEach((el) => {
    el.textContent = name;
  });
  document.querySelectorAll('[data-user-email]').forEach((el) => {
    el.textContent = currentUser && currentUser.email ? currentUser.email : '';
  });
  const initials = headerInitials();
  const profile = (window.DB && DB.getDoc('profile')) || {};
  const avatar = (profile && profile.avatar) || (currentUser && currentUser.photoURL) || '';
  const circleCls = 'w-full h-full flex items-center justify-center rounded-full bg-primary-container text-on-primary font-bold text-xs';
  document.querySelectorAll('[data-user-avatar]').forEach((el) => {
    el.textContent = '';
    if (avatar) {
      const img = document.createElement('img');
      img.className = 'w-full h-full object-cover rounded-full';
      img.alt = 'Profile picture';
      img.src = avatar;
      el.appendChild(img);
    } else {
      const cls = el.getAttribute('data-avatar-class') || circleCls;
      const div = document.createElement('div');
      div.className = cls;
      div.textContent = initials;
      el.appendChild(div);
    }
  });
}

function refreshHeader() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillHeader);
  } else {
    fillHeader();
  }
}

async function fetchAndCacheProfile(uid) {
  if (!uid) return;
  try {
    const fs = getFirestore(getApp());
    const ref = doc(fs, 'profiles', uid);
    const snap = await getDoc(ref);
    let data = snap.exists() ? snap.data() : null;
    if (!data) {
      data = {
        firstName: '',
        lastName: '',
        email: (currentUser && currentUser.email) || '',
        phone: '',
        avatar: '',
        seenWelcome: false,
      };
      await setDoc(ref, { ...data, updatedAt: Date.now() });
    }
    DB.seedDoc('profile', data || {});
  } catch (e) {
    console.warn('[auth] could not cache profile', e);
  }
}

export async function signIn(email, password) {
  if (!isCloud) {
    if (!email || !password) {
      return { ok: false, error: 'Enter your email and password.' };
    }
    setSession(email);
    currentUser = { email, uid: 'local' };
    DB.setCurrentUser(email);
    refreshHeader();
    return { ok: true };
  }
  try {
    const cred = await signInWithEmailAndPassword(getAuthInstance(), email, password);
    setSession(email);
    currentUser = cred.user;
    DB.setCurrentUser(cred.user.uid);
    DB.subscribeProfile();
    await fetchAndCacheProfile(cred.user.uid);
    refreshHeader();
    return { ok: true };
  } catch (e) {
    let error = 'Unable to sign in. Please try again.';
    if (e && (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')) {
      error = 'Invalid email or password.';
    } else if (e && e.code === 'auth/invalid-email') {
      error = 'Enter a valid email address.';
    } else if (e && e.code === 'auth/too-many-requests') {
      error = 'Too many attempts. Please try again later.';
    }
    return { ok: false, error };
  }
}

export async function signOut() {
  if (isCloud && auth) {
    try { await fbSignOut(auth); } catch (e) {}
  }
  clearSession();
  currentUser = null;
  DB.setCurrentUser(null);
  DB.subscribeProfile();
  DB.seedDoc('profile', null);
  refreshHeader();
}

function checkWelcome() {
  const p = (window.DB && DB.getDoc('profile')) || {};
  const hasName = p.firstName || p.lastName;
  const welcomeSeen = p.seenWelcome === true;
  console.log('[welcome] checkWelcome → seenWelcome:', p.seenWelcome, 'firstName:', p.firstName);
  if (!welcomeSeen && !hasName) {
    console.log('[welcome] → new user, showing modal');
    setTimeout(showWelcomeModal, 300);
  } else {
    console.log('[welcome] → skipping');
  }
}

export function guard() {
  if (!isCloud) {
    DB.onReady(checkWelcome);
    return;
  }
  if (!session()) {
    window.location.replace('index.html');
    return;
  }
}

if (isCloud) {
  const a = getAuthInstance();
  if (a) {
    let welcomeChecked = false;
    onAuthStateChanged(a, async (u) => {
      currentUser = u;
      DB.setCurrentUser(u ? u.uid : null);
      DB.subscribeProfile();
      if (u) await fetchAndCacheProfile(u.uid);
      refreshHeader();
      if (u && !welcomeChecked) {
        welcomeChecked = true;
        checkWelcome();
      }
    });
  }
}

DB.subscribe('profile', refreshHeader);

refreshHeader();

// ── Welcome modal for first-time users ──

function showWelcomeModal() {
  console.log('[welcome] showWelcomeModal() called, existing?', !!document.getElementById('welcome-modal'));
  if (document.getElementById('welcome-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'welcome-modal';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  overlay.style.cssText = 'animation:wmFadeIn .3s ease;z-index:9999 !important;position:fixed !important;';

  let avatarDataUrl = '';

  overlay.innerHTML = `
    <style>
      @keyframes wmFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes wmScaleIn{from{opacity:0;transform:scale(.93) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .wm-avatar-ring{width:88px;height:88px;border-radius:50%;border:3px dashed rgba(99,102,241,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s,background .2s;overflow:hidden;position:relative;}
      .wm-avatar-ring:hover{border-color:rgba(99,102,241,0.7);background:rgba(99,102,241,0.05);}
      .wm-avatar-ring img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
      .wm-field input{width:100%;padding:10px 14px;border:1px solid #c5c5d3;border-radius:8px;background:#fafbff;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s,box-shadow .2s;}
      .wm-field input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.12);}
      .wm-field label{display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:5px;letter-spacing:0.3px;}
      .wm-btn{padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;border:none;}
      .wm-btn-primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,0.35);}
      .wm-btn-primary:hover{box-shadow:0 6px 20px rgba(99,102,241,0.45);transform:translateY(-1px);}
      .wm-btn-primary:active{transform:translateY(0);}
      .wm-btn-skip{background:transparent;color:#94a3b8;border:1px solid #e2e8f0;}
      .wm-btn-skip:hover{background:#f8fafc;color:#64748b;}
    </style>
    <div style="animation:wmScaleIn .35s ease" class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);padding:28px 32px 20px;text-align:center;">
        <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
          <span class="material-symbols-outlined" style="color:#fff;font-size:26px;">person_add</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 4px;">Welcome to Bansang Hospital</h2>
        <p style="font-size:13px;color:#64748b;margin:0;">Let's set up your profile to get started</p>
      </div>
      <div style="padding:24px 32px 28px;">
        <div style="display:flex;justify-content:center;margin-bottom:24px;">
          <div class="wm-avatar-ring" id="wm-avatar-ring" title="Click to upload photo">
            <span id="wm-avatar-placeholder" class="material-symbols-outlined" style="font-size:32px;color:#a5b4fc;">add_a_photo</span>
            <img id="wm-avatar-preview" style="display:none;" alt="Avatar"/>
            <input type="file" accept="image/*" id="wm-avatar-input" style="display:none;"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div class="wm-field"><label>FIRST NAME *</label><input id="wm-first" placeholder="e.g. Matarr" autocomplete="given-name"/></div>
          <div class="wm-field"><label>LAST NAME *</label><input id="wm-last" placeholder="e.g. Sama" autocomplete="family-name"/></div>
        </div>
        <div class="wm-field" style="margin-bottom:24px;"><label>PHONE NUMBER</label><input id="wm-phone" type="tel" placeholder="e.g. +220 123 4567" autocomplete="tel"/></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <button class="wm-btn wm-btn-skip" id="wm-skip">Skip for now</button>
          <button class="wm-btn wm-btn-primary" id="wm-save">Get Started →</button>
        </div>
        <p id="wm-error" style="color:#ef4444;font-size:12px;margin-top:12px;text-align:center;display:none;"></p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const ring = document.getElementById('wm-avatar-ring');
  const fileInput = document.getElementById('wm-avatar-input');
  const preview = document.getElementById('wm-avatar-preview');
  const placeholder = document.getElementById('wm-avatar-placeholder');

  ring.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      avatarDataUrl = ev.target.result;
      preview.src = avatarDataUrl;
      preview.style.display = 'block';
      placeholder.style.display = 'none';
      ring.style.borderStyle = 'solid';
      ring.style.borderColor = 'rgba(99,102,241,0.5)';
    };
    reader.readAsDataURL(file);
  });

  async function markWelcomeSeen() {
    try {
      const p = (window.DB && DB.getDoc('profile')) || {};
      p.seenWelcome = true;
      await DB.saveDoc('profile', p);
      console.log('[welcome] marked seenWelcome = true');
    } catch (e) {
      console.warn('[welcome] failed to mark seenWelcome', e);
    }
  }

  document.getElementById('wm-skip').addEventListener('click', async () => {
    await markWelcomeSeen();
    overlay.remove();
  });

  document.getElementById('wm-save').addEventListener('click', async () => {
    const firstName = document.getElementById('wm-first').value.trim();
    const lastName = document.getElementById('wm-last').value.trim();
    const phone = document.getElementById('wm-phone').value.trim();
    const errEl = document.getElementById('wm-error');

    if (!firstName || !lastName) {
      errEl.textContent = 'Please enter your first and last name.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    const saveBtn = document.getElementById('wm-save');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.7';

    try {
      const p = (window.DB && DB.getDoc('profile')) || {};
      p.firstName = firstName;
      p.lastName = lastName;
      p.phone = phone;
      p.seenWelcome = true;
      if (avatarDataUrl) p.avatar = avatarDataUrl;
      const res = await DB.saveDoc('profile', p);
      if (res !== true) {
        errEl.textContent = 'Save failed. Please try again.';
        errEl.style.display = 'block';
        saveBtn.textContent = 'Get Started →';
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        return;
      }
      refreshHeader();
      overlay.remove();
      if (window.Dialogs) {
        window.Dialogs.toast('Welcome, ' + firstName + '! Your profile is all set.', 'success');
      }
    } catch (err) {
      errEl.textContent = 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
      saveBtn.textContent = 'Get Started →';
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    }
  });

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) e.preventDefault();
  });
}

window.Auth = {
  isCloud,
  signIn,
  signOut,
  guard,
  fillHeader,
  get currentUser() { return currentUser; },
};

window.signOut = async function () {
  const confirmed = window.Dialogs
    ? await window.Dialogs.confirm({ title: 'Sign Out', message: 'Are you sure you want to sign out?', confirmText: 'Sign Out', cancelText: 'Cancel', type: 'warning' })
    : confirm('Are you sure you want to sign out?');
  if (!confirmed) return;
  signOut().then(() => { window.location.replace('index.html'); });
};
