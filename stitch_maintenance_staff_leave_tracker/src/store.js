// Shared data layer.
//
// - Synchronous reads come from an in-memory cache mirrored to localStorage.
// - When Firebase is configured, every list/document stays in sync with Cloud
//   Firestore through onSnapshot, so all open pages always show the current
//   data. localStorage is only a mirror/offline cache — it never overrides
//   cloud data and never contains seeded/dummy records.
// - In local (demo) mode without a Firebase config, localStorage is the store
//   and subscribe() still fires for same-page changes.
//
// Firestore layout:
//   collections: teams, leaveTypes, leaveEntries, staff, notifications
//   documents:   settings/app, profiles/{uid|local}
import { getApp, configured as isCloud } from './firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc as fsSetDoc,
  writeBatch,
} from 'firebase/firestore';

const LIST_DEFS = {
  teams: { key: 'bansang_teams' },
  leaveTypes: { key: 'bansang_leave_types' },
  leaveEntries: { key: 'bansang_leave_entries' },
  staff: { key: 'bansang_staff' },
  notifications: { key: 'bansang_notifications' },
};

const DOC_DEFS = {
  settings: { key: 'bansang_settings' },
  profile: { key: 'bansang_profile' },
};

const cache = {};
const listeners = new Map();
let db = null;
let currentUserId = null;
let isReady = false;
let readyResolve;
const ready = new Promise((resolve) => { readyResolve = resolve; });
ready.then(() => {
  isReady = true;
  hideSkeletons();
  applyBranding();
});

// Tracks how many first snapshots we still await before onReady resolves.
// The profile document is deliberately excluded: it is fetched once at sign-in
// (see auth.js) and mirrored to localStorage so the navbar identity renders
// instantly on every page without a per-page Firestore fetch.
const expectedKeys = Object.keys(LIST_DEFS).length + 1; // lists + settings doc
const arrivedKeys = new Set();
function markArrived(name) {
  if (arrivedKeys.has(name)) return;
  arrivedKeys.add(name);
  if (arrivedKeys.size >= expectedKeys) readyResolve();
}

function emit(name) {
  const set = listeners.get(name);
  if (set) set.forEach((cb) => { try { cb(cache[name]); } catch (e) { console.error(e); } });
  const all = listeners.get('*');
  if (all) all.forEach((cb) => { try { cb(name, cache[name]); } catch (e) { console.error(e); } });
}

function loadLocalList(name) {
  try {
    const raw = localStorage.getItem(LIST_DEFS[name].key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function loadLocalDoc(name) {
  try {
    const raw = localStorage.getItem(DOC_DEFS[name].key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveLocalList(name, items) {
  try { localStorage.setItem(LIST_DEFS[name].key, JSON.stringify(items)); } catch (e) {}
}

function saveLocalDoc(name, obj) {
  try { localStorage.setItem(DOC_DEFS[name].key, JSON.stringify(obj)); } catch (e) {}
}

function docIdFor(name) {
  if (name === 'profile') return currentUserId || 'local';
  return 'app';
}

// ---------- Firestore writes ----------

async function fsPersistList(name, items) {
  const col = collection(db, name);
  const snap = await getDocs(col);
  const existingIds = new Set(snap.docs.map((d) => d.id));
  const wantedIds = new Set(items.map((i) => i.id));
  const batch = writeBatch(db);
  for (const id of existingIds) {
    if (!wantedIds.has(id)) batch.delete(doc(col, id));
  }
  for (const item of items) {
    batch.set(doc(col, item.id), { ...item, updatedAt: Date.now() });
  }
  await batch.commit();
}

async function fsPersistDoc(name, obj) {
  await fsSetDoc(doc(db, name, docIdFor(name)), { ...obj, updatedAt: Date.now() }, { merge: true });
}

// ---------- Firestore realtime subscriptions ----------

const docUnsubs = {};
let cloudSubscribed = false;

function subscribeDoc(name) {
  if (docUnsubs[name]) {
    try { docUnsubs[name](); } catch (e) {}
  }
  docUnsubs[name] = onSnapshot(
    doc(db, name, docIdFor(name)),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      cache[name] = data;
      if (data) saveLocalDoc(name, data);
      markArrived(name);
      emit(name);
    },
    (err) => {
      console.warn('[store] snapshot(doc ' + name + ') failed; using local cache.', err);
      markArrived(name);
    }
  );
}

function subscribeCloud() {
  if (cloudSubscribed) return;
  cloudSubscribed = true;
  for (const name of Object.keys(LIST_DEFS)) {
    onSnapshot(
      collection(db, name),
      (snap) => {
        const items = snap.docs.map((d) => d.data());
        cache[name] = items;
        saveLocalList(name, items);
        markArrived(name);
        emit(name);
      },
      (err) => {
        console.warn('[store] snapshot(' + name + ') failed; using local cache.', err);
        markArrived(name);
      }
    );
  }
  subscribeDoc('settings');
}

// ---------- Public API ----------

function getList(name) {
  if (!(name in cache)) cache[name] = loadLocalList(name);
  return cache[name];
}

// Saves a list. Resolves `true` on success, or the error code/message on
// failure so callers can surface the problem instead of failing silently.
function saveList(name, items) {
  const copy = Array.isArray(items) ? items.slice() : [];
  cache[name] = copy;
  saveLocalList(name, copy);
  let p = Promise.resolve(true);
  if (isCloud && db) {
    p = fsPersistList(name, copy).then(() => true).catch((e) => {
      console.warn('[store] saveList(' + name + ') failed', e);
      return (e && (e.code || e.message)) ? (e.code || e.message) : false;
    });
  }
  emit(name);
  return p;
}

function getDoc(name) {
  if (!(name in cache)) cache[name] = loadLocalDoc(name);
  return cache[name] || null;
}

function saveDoc(name, obj) {
  cache[name] = obj;
  saveLocalDoc(name, obj);
  let p = Promise.resolve(true);
  if (isCloud && db) {
    p = fsPersistDoc(name, obj).then(() => true).catch((e) => {
      console.warn('[store] saveDoc(' + name + ') failed', e);
      return (e && (e.code || e.message)) ? (e.code || e.message) : false;
    });
  }
  emit(name);
  return p;
}

function setCurrentUser(uid) {
  currentUserId = uid || null;
}

// Locally caches a document that was fetched elsewhere (e.g. the profile doc
// read once at sign-in) without writing to Firestore.
function seedDoc(name, obj) {
  cache[name] = obj;
  saveLocalDoc(name, obj);
}

function subscribe(name, cb) {
  if (typeof name === 'function') {
    cb = name;
    name = '*';
  }
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(cb);
  return function unsubscribe() {
    const set = listeners.get(name);
    if (set) set.delete(cb);
  };
}

function onReady(cb) {
  const run = () => {
    try { cb(); } catch (e) { console.error(e); }
  };
  if (isReady) {
    run();
  } else {
    ready.then(run);
  }
}

// Removes skeleton placeholders once the first data arrives.
function hideSkeletons() {
  document.body.classList.add('db-loaded');
  document.querySelectorAll('[data-skeleton]').forEach((el) => el.remove());
}

// Fills app name / slogan ([data-app-name], [data-app-slogan]) from settings.
function applyBranding() {
  const s = cache.settings || {};
  const name = s.hospitalName || 'BANSANG HOSPITAL';
  const slogan = s.slogan || s.department || 'Maintenance Unit';
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = name; });
  document.querySelectorAll('[data-app-slogan]').forEach((el) => { el.textContent = slogan; });
  document.querySelectorAll('[data-app-title]').forEach((el) => {
    el.textContent = el.getAttribute('data-app-title').replace('%APP%', name);
  });
}
subscribe('settings', applyBranding);

function init() {
  for (const name of Object.keys(LIST_DEFS)) cache[name] = loadLocalList(name);
  for (const name of Object.keys(DOC_DEFS)) cache[name] = loadLocalDoc(name);
  if (isCloud) {
    db = getFirestore(getApp());
    const hadLocal = Object.keys(LIST_DEFS).some((name) => {
      const arr = cache[name];
      return Array.isArray(arr) && arr.length > 0;
    });
    subscribeCloud();
    if (hadLocal) readyResolve();
  } else {
    readyResolve();
  }
}

init();

// ---------- Scheduled leave reminder checker ----------
// Checks on load and every hour for month-scheduled leave entries that
// are approaching. Creates a notification 5 days before the scheduled month.

function checkScheduledLeaveReminders() {
  const entries = getList('leaveEntries').filter(function (e) {
    return !e.deleted && e.scheduleMode === 'month' && e.status === 'Scheduled' && !e.reminderSent && e.scheduledMonth;
  });
  if (!entries.length) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifications = getList('notifications');
  let changed = false;

  entries.forEach(function (e) {
    var parts = e.scheduledMonth.split('-');
    var schedYear = parseInt(parts[0], 10);
    var schedMonth = parseInt(parts[1], 10);
    // First day of the scheduled month
    var monthStart = new Date(schedYear, schedMonth - 1, 1);
    // 5 days before the month starts
    var reminderDate = new Date(monthStart);
    reminderDate.setDate(reminderDate.getDate() - 5);

    if (today >= reminderDate) {
      var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var monthName = monthNames[schedMonth - 1];
      var staffName = e.staffName || 'Staff member';
      var notif = {
        id: 'n' + Date.now() + '_' + e.id,
        type: 'reminder',
        title: 'Scheduled Leave Reminder',
        body: staffName + '\'s ' + (e.typeName || 'leave') + ' for ' + monthName + ' ' + schedYear + ' is approaching. Please specify the exact dates and inform the staff.',
        time: 'Just now',
        read: false,
        entryId: e.id
      };
      notifications.push(notif);
      changed = true;

      // Mark the entry so we don't create duplicate reminders
      var allEntries = getList('leaveEntries');
      allEntries.forEach(function (ae) {
        if (ae.id === e.id) ae.reminderSent = true;
      });
      saveList('leaveEntries', allEntries);
    }
  });

  if (changed) {
    saveList('notifications', notifications);
  }
}

// Run on init and every hour
checkScheduledLeaveReminders();
setInterval(checkScheduledLeaveReminders, 60 * 60 * 1000);

export const DB = {
  ready,
  onReady,
  isCloud,
  getList,
  saveList,
  getDoc,
  saveDoc,
  seedDoc,
  setCurrentUser,
  subscribe,
  hideSkeletons,
  applyBranding,
  get currentUserId() { return currentUserId; },
};

window.DB = DB;
