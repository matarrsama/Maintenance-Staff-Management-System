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
import pkg from '../package.json';
import { getApp, configured as isCloud } from './firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
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
  profile: { key: 'bansang_profile', fsCollection: 'profiles' },
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

function fireNativeNotif(title, body, tag) {
  if (window.desktop && window.desktop.notify) {
    window.desktop.notify(title, body, tag || 'bansang-' + Date.now());
  } else if (window.Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body: body }); } catch (e) {}
  }
}

// ---------- Email notifications via Google Apps Script ----------

const EMAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhDRPQgZlDwK-LeqojuLLTcLzNy59dp_LjE5Zu20beVSukDs6COqFFDnTZJty9Cm4uvQ/exec';

function sendEmailNotification(title, body, details) {
  var profile = cache.profile || {};
  var email = profile.email || (window.Auth && window.Auth.currentUser && window.Auth.currentUser.email) || '';
  if (!email) return;
  fetch(EMAIL_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ to: email, title: title, body: body, details: details || '' }),
  }).catch(function (e) { console.warn('[store] email notification failed', e); });
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

// Tracks the last-known set of document IDs per collection (as reported by
// onSnapshot) so we can diff on save without reading the collection again.
const lastKnownIds = {};

const BATCH_LIMIT = 500;

async function commitBatchedWrites(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') batch.set(op.ref, op.data);
      else if (op.type === 'delete') batch.delete(op.ref);
    }
    await batch.commit();
  }
}

async function fsPersistList(name, items) {
  const col = collection(db, name);
  const prevIds = lastKnownIds[name] || new Set();
  const wantedIds = new Set(items.map((i) => i.id));
  const now = Date.now();
  const ops = [];

  // Delete IDs that are no longer present
  for (const id of prevIds) {
    if (!wantedIds.has(id)) ops.push({ type: 'delete', ref: doc(col, id) });
  }
  // Set all wanted items (both new and existing)
  for (const item of items) {
    ops.push({ type: 'set', ref: doc(col, item.id), data: { ...item, updatedAt: now } });
  }

  await commitBatchedWrites(ops);
  lastKnownIds[name] = wantedIds;
}

async function fsPersistDoc(name, obj) {
  const col = (DOC_DEFS[name] && DOC_DEFS[name].fsCollection) || name;
  const ref = doc(db, col, docIdFor(name));
  await fsSetDoc(ref, { ...obj, updatedAt: Date.now() }, { merge: true });
}

// ---------- Firestore realtime subscriptions ----------

const docUnsubs = {};
let profileUnsub = null;
let cloudSubscribed = false;

function subscribeDoc(name) {
  if (docUnsubs[name]) {
    try { docUnsubs[name](); } catch (e) {}
  }
  docUnsubs[name] = onSnapshot(
    doc(db, (DOC_DEFS[name] && DOC_DEFS[name].fsCollection) || name, docIdFor(name)),
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
        // Track IDs for diff-based writes
        lastKnownIds[name] = new Set(snap.docs.map((d) => d.id));
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
  if (!Array.isArray(items)) {
    console.warn('[store] saveList(' + name + ') called with non-array, ignoring');
    return Promise.resolve(false);
  }
  const copy = items.slice();
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

function subscribeProfile() {
  if (profileUnsub) { try { profileUnsub(); } catch (e) {} profileUnsub = null; }
  if (!isCloud || !db || !currentUserId) return;
  profileUnsub = onSnapshot(
    doc(db, 'profiles', currentUserId),
    (snap) => {
      const data = snap.exists() ? snap.data() : null;
      cache['profile'] = data;
      if (data) saveLocalDoc('profile', data);
      emit('profile');
    },
    (err) => {
      console.warn('[store] snapshot(profile) failed; using local cache.', err);
    }
  );
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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtShort(d) {
  return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}

function checkScheduledLeaveReminders() {
  const entries = getList('leaveEntries').filter(function (e) {
    return !e.deleted && e.scheduleMode === 'month' && e.status === 'Scheduled' && !e.reminderSent && e.scheduledMonth;
  });
  if (!entries.length) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifications = getList('notifications');
  const allEntries = getList('leaveEntries');
  let changed = false;
  let entriesChanged = false;

  entries.forEach(function (e) {
    var parts = e.scheduledMonth.split('-');
    var schedYear = parseInt(parts[0], 10);
    var schedMonth = parseInt(parts[1], 10);
    var monthStart = new Date(schedYear, schedMonth - 1, 1);
    var reminderDate = new Date(monthStart);
    reminderDate.setDate(reminderDate.getDate() - 5);

    if (today >= reminderDate) {
      var monthName = MONTH_NAMES[schedMonth - 1];
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
      fireNativeNotif(notif.title, notif.body);
      sendEmailNotification(notif.title, notif.body, 'Staff: ' + staffName + '\nType: ' + (e.typeName || 'leave') + '\nMonth: ' + monthName + ' ' + schedYear);

      allEntries.forEach(function (ae) {
        if (ae.id === e.id) ae.reminderSent = true;
      });
      entriesChanged = true;
    }
  });

  if (entriesChanged) {
    saveList('leaveEntries', allEntries);
  }
  if (changed) {
    saveList('notifications', notifications);
  }
}

// Run on init and every hour
checkScheduledLeaveReminders();
setInterval(checkScheduledLeaveReminders, 60 * 60 * 1000);

// ---------- Leave start/end today email reminders ----------

function checkLeaveStartEnd() {
  const allEntries = getList('leaveEntries');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifications = getList('notifications');
  let notifChanged = false;
  let entriesChanged = false;

  allEntries.forEach(function (e) {
    if (e.deleted || !e.startDate) return;

    const start = new Date(e.startDate + 'T00:00:00');
    const end = e.endDate ? new Date(e.endDate + 'T00:00:00') : start;
    const staffName = e.staffName || 'Staff member';
    const typeName = e.typeName || 'leave';

    // Leave starts today
    if (+start === +today && !e.startNotified) {
      var n1 = {
        id: 'ns_' + Date.now() + '_' + e.id,
        type: 'reminder',
        title: 'Leave Starts Today',
        body: staffName + '\'s ' + typeName + ' starts today (' + fmtShort(start) + ').',
        time: 'Just now',
        read: false,
        entryId: e.id,
      };
      notifications.push(n1);
      notifChanged = true;
      fireNativeNotif(n1.title, n1.body);
      sendEmailNotification(n1.title, n1.body, 'Staff: ' + staffName + '\nType: ' + typeName + '\nStart: ' + fmtShort(start));
      e.startNotified = true;
      entriesChanged = true;
    }

    // Leave ends today
    if (+end === +today && !e.endNotified) {
      var n2 = {
        id: 'ne_' + Date.now() + '_' + e.id,
        type: 'reminder',
        title: 'Leave Ends Today',
        body: staffName + '\'s ' + typeName + ' ends today. They should return tomorrow.',
        time: 'Just now',
        read: false,
        entryId: e.id,
      };
      notifications.push(n2);
      notifChanged = true;
      fireNativeNotif(n2.title, n2.body);
      sendEmailNotification(n2.title, n2.body, 'Staff: ' + staffName + '\nType: ' + typeName + '\nEnd: ' + fmtShort(end));
      e.endNotified = true;
      entriesChanged = true;
    }
  });

  if (entriesChanged) saveList('leaveEntries', allEntries);
  if (notifChanged) saveList('notifications', notifications);
}

checkLeaveStartEnd();
setInterval(checkLeaveStartEnd, 60 * 60 * 1000);

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
  subscribeProfile,
  subscribe,
  hideSkeletons,
  applyBranding,
  fireNativeNotif,
  sendEmailNotification,
  get currentUserId() { return currentUserId; },
};

window.DB = DB;
window.APP_VERSION = pkg.version;
