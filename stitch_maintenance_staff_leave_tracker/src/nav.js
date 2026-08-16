// Soft navigation for the shared-shell pages.
//
// Intercepts clicks on internal links and swaps only the <main> element, so the
// navbar/sidebar are never reloaded and the Firestore data layer (store.js) is
// not re-subscribed on every page change. Pages still work standalone when a
// link is opened directly or in a new tab (progressive enhancement).
(function () {
  var SHELL_PAGES = [
    'dashboard.html',
    'staff-directory.html',
    'leave-roster.html',
    'request-manager.html',
    'reports.html',
    'settings.html',
    'notifications.html',
    'profile.html'
  ];

  var pageCache = {};
  var navSeq = 0;
  var appMain = document.getElementById('app-main');

  if (!appMain) return;

  function basename(url) {
    return (url.split('?')[0] || '').split('#')[0].split('/').pop();
  }

  function isShellUrl(url) {
    return SHELL_PAGES.indexOf(basename(url)) !== -1;
  }

  async function fetchPage(url) {
    if (pageCache[url]) return pageCache[url];
    var res = await fetch(url, { headers: { 'X-Requested-With': 'nav-soft' } });
    if (!res.ok) throw new Error('Failed to load ' + url);
    var html = await res.text();
    pageCache[url] = html;
    return html;
  }

  function parsePage(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // Copies the active/inactive styling of the sidebar + topbar links from the
  // fetched page so the correct tab stays highlighted after navigation.
  function copyShellClasses(fetchedDoc) {
    ['nav', 'header'].forEach(function (selector) {
      var cur = document.querySelector(selector);
      var fut = fetchedDoc.querySelector(selector);
      if (!cur || !fut) return;
      fut.querySelectorAll('a[href]').forEach(function (fa) {
        if (fa.parentElement === fut) return;
        var href = fa.getAttribute('href');
        if (!href) return;
        cur.querySelectorAll('a[href]').forEach(function (ca) {
          if (ca.parentElement === cur) return;
          if (ca.getAttribute('href') === href) ca.className = fa.className;
        });
      });
    });
  }

  // Adds any <style> blocks from the fetched page's <head> that the current
  // document does not already have (e.g. the roster's timeline-grid CSS).
  function copyStyles(fetchedDoc) {
    fetchedDoc.querySelectorAll('style').forEach(function (s) {
      var text = s.textContent || '';
      var exists = Array.prototype.some.call(document.querySelectorAll('style'), function (cur) {
        return cur.textContent === text;
      });
      if (exists) return;
      var el = document.createElement('style');
      el.textContent = text;
      document.head.appendChild(el);
    });
  }

  // Executes the fetched page's inline scripts in the current document, and
  // captures any DOMContentLoaded listeners they register so we can run them
  // after the async module imports resolve (readyState is already 'complete').
  function runPageScripts(fetchedDoc, done) {
    var captured = [];
    var scripts = fetchedDoc.querySelectorAll('script:not([src])');
    var modules = [];
    var origAdd = document.addEventListener;
    document.addEventListener = function (type, fn, capture) {
      if (type === 'DOMContentLoaded') captured.push(fn);
      return origAdd.call(document, type, fn, capture);
    };
    try {
      scripts.forEach(function (s) {
        if ((s.getAttribute('type') || '').toLowerCase() === 'module') return;
        try {
          var el = document.createElement('script');
          el.textContent = s.textContent;
          document.body.appendChild(el);
        } catch (e) {
          console.error('[nav] page script error', e);
        }
      });
      fetchedDoc.querySelectorAll('script[type="module"][src]').forEach(function (m) {
        var src = m.getAttribute('src');
        if (src) modules.push(src);
      });
    } finally {
      document.addEventListener = origAdd;
    }
    Promise.all(modules.map(function (src) {
      return import(src).catch(function (e) {
        console.warn('[nav] could not load module ' + src, e);
      });
    })).then(function () {
      captured.forEach(function (fn) {
        try { fn.call(document); } catch (e) { console.error('[nav] page init error', e); }
      });
      done();
    });
  }

  async function navigate(url, push) {
    var seq = ++navSeq;
    try {
      var doc = parsePage(await fetchPage(url));
      if (seq !== navSeq) return;

      var nextMain = doc.querySelector('#app-main');
      if (!nextMain) {
        window.location.href = url;
        return;
      }

      var fetchedBody = doc.querySelector('body');
      if (fetchedBody) document.body.className = fetchedBody.className;
      appMain.replaceWith(nextMain);
      appMain = document.getElementById('app-main') || nextMain;
      appMain.querySelectorAll('[data-skeleton]').forEach(function (el) { el.remove(); });
      copyShellClasses(doc);
      copyStyles(doc);

      document.title = doc.title || document.title;

      runPageScripts(doc, function () {
        if (seq !== navSeq) return;
        if (appMain) appMain.scrollTop = 0;
      });

      if (push) history.pushState({ nav: true, url: url }, '', url);
    } catch (e) {
      if (seq !== navSeq) return;
      console.warn('[nav] soft navigation failed, doing full reload', e);
      window.location.href = url;
    }
  }

  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target && a.target.toLowerCase() === '_blank') return;
    var url = a.href;
    if (!url) return;
    var resolved = new URL(url, window.location.href);
    if (resolved.origin !== window.location.origin) return;
    if (!/\.html$/.test(resolved.pathname)) return;
    if (!isShellUrl(resolved.href)) return;
    ev.preventDefault();
    if (resolved.href === window.location.href) return;
    navigate(resolved.href, true);
  });

  window.addEventListener('popstate', function () {
    var url = window.location.pathname + window.location.search;
    if (!isShellUrl(url)) {
      window.location.reload();
      return;
    }
    navigate(url, false);
  });

  // ---------- Global Search ----------
  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function initGlobalSearch() {
    var input = document.querySelector('header input[type="text"]');
    if (!input || input.dataset.globalSearch) return;
    input.dataset.globalSearch = '1';

    var wrapper = input.parentElement;
    wrapper.style.position = 'relative';

    var panel = document.createElement('div');
    panel.className = 'absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-50 hidden max-h-[70vh] overflow-y-auto';
    wrapper.appendChild(panel);

    input.addEventListener('input', function () {
      var q = input.value.toLowerCase().trim();
      if (q.length < 2) { panel.classList.add('hidden'); return; }
      if (!window.DB) { panel.classList.add('hidden'); return; }

      var staff = window.DB.getList('staff') || [];
      var entries = (window.DB.getList('leaveEntries') || []).filter(function (e) { return !e.deleted; });
      var teams = window.DB.getList('teams') || [];
      var types = window.DB.getList('leaveTypes') || [];
      var notifs = window.DB.getList('notifications') || [];

      var html = '';
      var total = 0;

      // Staff matches
      var staffMatches = staff.filter(function (s) {
        return (s.name || '').toLowerCase().indexOf(q) !== -1 ||
               (s.role || '').toLowerCase().indexOf(q) !== -1 ||
               (s.empId || '').toLowerCase().indexOf(q) !== -1 ||
               (s.teamLabel || '').toLowerCase().indexOf(q) !== -1 ||
               (s.phone || '').toLowerCase().indexOf(q) !== -1;
      });
      if (staffMatches.length) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Staff (' + staffMatches.length + ')</div>';
        staffMatches.slice(0, 8).forEach(function (s) {
          total++;
          html += '<a href="staff-directory.html" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors cursor-pointer" data-nav-search-result>' +
            '<div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-xs shrink-0">' + escapeHtml(s.initials || '') + '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-body-sm font-medium text-on-surface truncate">' + escapeHtml(s.name) + '</p>' +
              '<p class="text-[11px] text-on-surface-variant truncate">' + escapeHtml(s.role || '') + ' &middot; ' + escapeHtml(s.empId || '') + ' &middot; ' + escapeHtml(s.teamLabel || '') + '</p>' +
            '</div>' +
            '<span class="material-symbols-outlined text-[16px] text-outline">person</span>' +
          '</a>';
        });
      }

      // Leave entry matches
      var entryMatches = entries.filter(function (e) {
        var sName = '';
        staff.forEach(function (st) { if (st.id === e.staffId) sName = st.name; });
        return sName.toLowerCase().indexOf(q) !== -1 ||
               (e.typeName || '').toLowerCase().indexOf(q) !== -1 ||
               (e.startDate || '').indexOf(q) !== -1 ||
               (e.endDate || '').indexOf(q) !== -1;
      });
      if (entryMatches.length) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider border-t border-outline-variant mt-1">Leave Entries (' + entryMatches.length + ')</div>';
        entryMatches.slice(0, 6).forEach(function (e) {
          var sName = 'Unknown';
          staff.forEach(function (st) { if (st.id === e.staffId) sName = st.name; });
          total++;
          html += '<a href="request-manager.html" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors cursor-pointer" data-nav-search-result>' +
            '<div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">' +
              '<span class="material-symbols-outlined text-[16px]">event</span>' +
            '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-body-sm font-medium text-on-surface truncate">' + escapeHtml(sName) + ' &mdash; ' + escapeHtml(e.typeName || 'Leave') + '</p>' +
              '<p class="text-[11px] text-on-surface-variant truncate">' + escapeHtml(e.startDate || '') + (e.startDate !== e.endDate ? ' to ' + escapeHtml(e.endDate || '') : '') + '</p>' +
            '</div>' +
            '<span class="material-symbols-outlined text-[16px] text-outline">event</span>' +
          '</a>';
        });
      }

      // Team matches
      var teamMatches = teams.filter(function (t) {
        return (t.name || '').toLowerCase().indexOf(q) !== -1;
      });
      if (teamMatches.length) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider border-t border-outline-variant mt-1">Teams (' + teamMatches.length + ')</div>';
        teamMatches.slice(0, 4).forEach(function (t) {
          total++;
          var count = staff.filter(function (s) { return s.team === t.id; }).length;
          html += '<a href="staff-directory.html" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors cursor-pointer" data-nav-search-result>' +
            '<div class="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container shrink-0">' +
              '<span class="material-symbols-outlined text-[16px]">group</span>' +
            '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-body-sm font-medium text-on-surface truncate">' + escapeHtml(t.name) + '</p>' +
              '<p class="text-[11px] text-on-surface-variant">' + count + ' member' + (count !== 1 ? 's' : '') + '</p>' +
            '</div>' +
            '<span class="material-symbols-outlined text-[16px] text-outline">group</span>' +
          '</a>';
        });
      }

      // Unread notifications match
      var unreadCount = notifs.filter(function (n) { return !n.read; }).length;
      if (unreadCount && ('notification'.indexOf(q) !== -1 || 'unread'.indexOf(q) !== -1 || 'alert'.indexOf(q) !== -1)) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider border-t border-outline-variant mt-1">Notifications</div>';
        total++;
        html += '<a href="notifications.html" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container transition-colors cursor-pointer" data-nav-search-result>' +
          '<div class="w-8 h-8 rounded-full bg-error-container flex items-center justify-center text-on-error-container shrink-0">' +
            '<span class="material-symbols-outlined text-[16px]">notifications</span>' +
          '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="font-body-sm font-medium text-on-surface">' + unreadCount + ' unread notification' + (unreadCount !== 1 ? 's' : '') + '</p>' +
          '</div>' +
          '<span class="material-symbols-outlined text-[16px] text-outline">arrow_forward</span>' +
        '</a>';
      }

      if (!total) {
        html = '<div class="px-4 py-8 text-center">' +
          '<span class="material-symbols-outlined text-[32px] text-on-surface-variant opacity-40">search_off</span>' +
          '<p class="font-body-sm text-body-sm text-on-surface-variant mt-2">No results for "' + escapeHtml(q) + '"</p>' +
        '</div>';
      }

      panel.innerHTML = html;
      panel.classList.remove('hidden');
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        panel.classList.add('hidden');
        input.blur();
      }
    });

    document.addEventListener('click', function (ev) {
      var result = ev.target.closest ? ev.target.closest('[data-nav-search-result]') : null;
      if (result) {
        panel.classList.add('hidden');
        input.value = '';
        return;
      }
      if (!panel.contains(ev.target) && ev.target !== input) {
        panel.classList.add('hidden');
      }
    });
  }

  // Run on initial load and after every soft navigation
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initGlobalSearch();
  } else {
    document.addEventListener('DOMContentLoaded', initGlobalSearch);
  }

  // Also re-init after soft nav (header persists, but search might need refresh)
  var origNavigate = navigate;
  // The navigate function is local, so we hook via MutationObserver on header
  var headerEl = document.querySelector('header');
  if (headerEl) {
    new MutationObserver(function () { initGlobalSearch(); }).observe(headerEl, { childList: true, subtree: true });
  }

  // ---------- Idle Timeout (1 hour) ----------
  var IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour in ms
  var idleTimer = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (window.Dialogs) {
        window.Dialogs.alert({
          title: 'Session Expired',
          message: 'You have been idle for 1 hour. For security, you have been signed out.',
          type: 'warning',
          confirmText: 'OK'
        }).then(function () {
          window.location.replace('index.html');
        });
      } else {
        alert('You have been idle for 1 hour. For security, you have been signed out.');
        window.location.replace('index.html');
      }
    }, IDLE_TIMEOUT);
  }

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
})();
