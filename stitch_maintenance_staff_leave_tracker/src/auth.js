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
import { getFirestore, doc, getDoc } from 'firebase/firestore';
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

// Fills the header identity placeholders ([data-user-name], [data-user-avatar],
// [data-user-email]) with the signed-in user. The profile document is fetched
// ONCE at sign-in and mirrored to localStorage by store.js, so this reads from
// the local cache synchronously on every page load — no per-page refetch.
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
    if (avatar) {
      el.innerHTML = '<img class="w-full h-full object-cover rounded-full" alt="Profile picture" src="' + avatar + '">';
    } else {
      const cls = el.getAttribute('data-avatar-class') || circleCls;
      el.innerHTML = '<div class="' + cls + '">' + initials + '</div>';
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

// Fetches the user's profile document once and mirrors it to localStorage via
// store.js. Called only on sign-in so subsequent page loads read the cached
// identity instead of refetching it.
async function fetchAndCacheProfile(uid) {
  try {
    const snap = await getDoc(doc(getFirestore(getApp()), 'profiles', uid));
    const data = snap.exists() ? snap.data() : {};
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
  DB.seedDoc('profile', null);
  refreshHeader();
}

export function guard() {
  if (!isCloud) return;
  if (!session()) {
    window.location.replace('index.html');
    return;
  }
  const a = getAuthInstance();
  if (a) {
    onAuthStateChanged(a, (u) => {
      currentUser = u;
      if (!u) window.location.replace('index.html');
      refreshHeader();
    });
  }
}

if (isCloud) {
  const a = getAuthInstance();
  if (a) {
    onAuthStateChanged(a, (u) => {
      currentUser = u;
      DB.setCurrentUser(u ? u.uid : null);
      refreshHeader();
    });
  }
}

// Re-fill identity whenever the user's profile document changes (e.g. after a
// photo upload) so the avatar updates live across pages.
DB.subscribe('profile', refreshHeader);

refreshHeader();

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
