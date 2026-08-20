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

  // Tracks dynamically injected scripts/styles for cleanup on navigation
  var injectedScripts = [];
  var injectedStyles = [];
  var pageUnsubs = []; // store unsubscribe functions from DB.subscribe calls

  function cleanupPageArtifacts() {
    // Unsubscribe all page-level listeners first
    pageUnsubs.forEach(function (fn) { try { fn(); } catch (e) {} });
    pageUnsubs = [];
    injectedScripts.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    injectedScripts = [];
    injectedStyles.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    injectedStyles = [];
  }

  var pageCache = {};
  var navSeq = 0;
  var loadedScripts = new Set();
  var appMain = document.getElementById('app-main');

  // Invalidate page cache on new sessions to avoid stale content after deployments
  try {
    var cacheVersion = sessionStorage.getItem('bansang_nav_cache_v');
    var currentVersion = String(Math.floor(Date.now() / (60 * 60 * 1000))); // hourly
    if (cacheVersion !== currentVersion) {
      sessionStorage.setItem('bansang_nav_cache_v', currentVersion);
      pageCache = {};
    }
  } catch (e) {}

  if (!appMain) return;

  function fillVersionFooter() {
    var el = document.getElementById('app-version');
    if (el && window.APP_VERSION) el.textContent = 'v' + window.APP_VERSION;
    var yr = document.getElementById('app-year');
    if (yr) yr.textContent = new Date().getFullYear();
  }

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
      injectedStyles.push(el);
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
          injectedScripts.push(el);
        } catch (e) {
          console.error('[nav] page script error', e);
        }
      });
      fetchedDoc.querySelectorAll('script[type="module"][src]').forEach(function (m) {
        var src = m.getAttribute('src');
        if (src) modules.push(new URL(src, document.baseURI).href);
      });
      fetchedDoc.querySelectorAll('script:not([type="module"])[src]').forEach(function (s) {
        var src = s.getAttribute('src');
        if (src) {
          var abs = new URL(src, document.baseURI).href;
          if (!loadedScripts.has(abs)) {
            loadedScripts.add(abs);
            var el = document.createElement('script');
            el.src = abs;
            document.body.appendChild(el);
          }
        }
      });
    } finally {
      document.addEventListener = origAdd;
    }

    // Intercept DB.subscribe to capture unsubscribe functions for cleanup
    var origSubscribe = window.DB && window.DB.subscribe;
    if (origSubscribe) {
      window.DB.subscribe = function (name, cb) {
        var unsub = origSubscribe.call(window.DB, name, cb);
        if (typeof unsub === 'function') pageUnsubs.push(unsub);
        return unsub;
      };
    }

    Promise.all(modules.map(function (src) {
      return import(/* @vite-ignore */ src).catch(function (e) {
        console.warn('[nav] could not load module ' + src, e);
      });
    })).then(function () {
      captured.forEach(function (fn) {
        try { fn.call(document); } catch (e) { console.error('[nav] page init error', e); }
      });
      fillVersionFooter();
      // Restore original DB.subscribe
      if (origSubscribe) window.DB.subscribe = origSubscribe;
      done();
    });
  }

  async function navigate(url, push) {
    var seq = ++navSeq;
    try {
      var doc = parsePage(await fetchPage(url));
      if (seq !== navSeq) return;

      cleanupPageArtifacts();

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
  var _escapeDiv = document.createElement('div');
  function escapeHtml(str) {
    _escapeDiv.textContent = str == null ? '' : String(str);
    return _escapeDiv.innerHTML;
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var self = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function buildStaffMap(staff) {
    var map = {};
    for (var i = 0; i < staff.length; i++) map[staff[i].id] = staff[i];
    return map;
  }

  function initGlobalSearch() {
    var input = document.querySelector('header input[type="text"]');
    if (!input || input.dataset.globalSearch) return;
    input.dataset.globalSearch = '1';

    var wrapper = input.parentElement;
    wrapper.style.position = 'relative';

    var panel = document.createElement('div');
    panel.className = 'absolute left-0 right-0 top-full mt-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-xl z-[60] hidden max-h-[70vh] overflow-y-auto';
    wrapper.appendChild(panel);

    var runSearch = debounce(function () {
      var q = input.value.toLowerCase().trim();
      if (q.length < 2) { panel.classList.add('hidden'); return; }
      if (!window.DB) { panel.classList.add('hidden'); return; }

      var staff = window.DB.getList('staff') || [];
      var staffMap = buildStaffMap(staff);
      var entries = (window.DB.getList('leaveEntries') || []).filter(function (e) { return !e.deleted; });
      var teams = window.DB.getList('teams') || [];
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

      // Leave entry matches (O(n) with Map lookup)
      var entryMatches = entries.filter(function (e) {
        var s = staffMap[e.staffId];
        var sName = s ? s.name : '';
        return sName.toLowerCase().indexOf(q) !== -1 ||
               (e.typeName || '').toLowerCase().indexOf(q) !== -1 ||
               (e.startDate || '').indexOf(q) !== -1 ||
               (e.endDate || '').indexOf(q) !== -1;
      });
      if (entryMatches.length) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider border-t border-outline-variant mt-1">Leave Entries (' + entryMatches.length + ')</div>';
        entryMatches.slice(0, 6).forEach(function (e) {
          var s = staffMap[e.staffId];
          var sName = s ? s.name : 'Unknown';
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

      // Team matches (O(n) member count with Map)
      var teamMatches = teams.filter(function (t) {
        return (t.name || '').toLowerCase().indexOf(q) !== -1;
      });
      if (teamMatches.length) {
        html += '<div class="px-3 pt-3 pb-1 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider border-t border-outline-variant mt-1">Teams (' + teamMatches.length + ')</div>';
        teamMatches.slice(0, 4).forEach(function (t) {
          total++;
          var count = 0;
          for (var i = 0; i < staff.length; i++) { if (staff[i].team === t.id) count++; }
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
      if (unreadCount && (q.indexOf('notif') !== -1 || q.indexOf('unread') !== -1 || q.indexOf('alert') !== -1)) {
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
    }, 150);

    input.addEventListener('input', runSearch);

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
    initMobileMenu();
    fillVersionFooter();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      initGlobalSearch();
      initMobileMenu();
      fillVersionFooter();
    });
  }

  // ---------- Mobile Hamburger Menu ----------
  function initMobileMenu() {
    var menuBtn = document.querySelector('header button.md\\:hidden');
    if (!menuBtn || menuBtn.dataset.mobileMenuInit) return;
    menuBtn.dataset.mobileMenuInit = '1';
    var sidebar = document.querySelector('nav.hidden.md\\:flex');
    if (!sidebar) return;

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 z-40 hidden md:hidden';
    overlay.id = 'mobile-menu-overlay';
    document.body.appendChild(overlay);

    menuBtn.addEventListener('click', function () {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('flex');
      sidebar.style.position = 'fixed';
      sidebar.style.left = '0';
      sidebar.style.top = '0';
      sidebar.style.zIndex = '60';
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });

    overlay.addEventListener('click', function () {
      closeMobileMenu();
    });

    function closeMobileMenu() {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('flex');
      sidebar.style.position = '';
      sidebar.style.left = '';
      sidebar.style.top = '';
      sidebar.style.zIndex = '';
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }

    // Close on nav link click
    sidebar.querySelectorAll('a[href]').forEach(function (a) {
      a.addEventListener('click', closeMobileMenu);
    });
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

  // ---------- Internet Quality Indicator ----------

  (function () {
    var dot = null;
    var currentStatus = null;

    function ensureIndicator() {
      if (dot) return true;
      var link = document.querySelector('header a[href="profile.html"]');
      if (!link) return false;
      link.classList.remove('border-l', 'border-outline-variant');
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:8px;flex-shrink:0;cursor:default;';
      dot = document.createElement('span');
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#94a3b8;transition:background .4s,box-shadow .4s;flex-shrink:0;';
      dot.title = 'Checking connection...';
      var label = document.createElement('span');
      label.style.cssText = 'font-size:11px;font-weight:500;letter-spacing:0.3px;white-space:nowrap;color:#64748b;transition:color .4s;';
      label.textContent = 'Checking...';
      wrap.appendChild(dot);
      wrap.appendChild(label);
      link.parentNode.insertBefore(wrap, link);
      dot._label = label;
      return true;
    }

    function setQuality(q) {
      if (!ensureIndicator()) return;
      if (q === currentStatus) return;
      currentStatus = q;
      var color, label, title, shadow;
      if (q === 'offline') {
        color = '#ef4444'; label = 'Offline'; title = 'No internet connection';
        shadow = '0 0 0 3px rgba(239,68,68,0.25)';
      } else if (q === 'weak') {
        color = '#f59e0b'; label = 'Weak'; title = 'Weak connection';
        shadow = '0 0 0 3px rgba(245,158,11,0.2)';
      } else {
        color = '#22c55e'; label = 'Online'; title = 'Good connection';
        shadow = '0 0 0 3px rgba(34,197,94,0.2)';
      }
      dot.style.background = color;
      dot.style.boxShadow = shadow;
      dot.title = title;
      if (dot._label) {
        dot._label.textContent = label;
        dot._label.style.color = color;
      }
    }

    function classifyByNetworkInfo() {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return null;
      var t = conn.effectiveType || '';
      if (t === 'slow-2g' || t === '2g') return 'weak';
      if (conn.rtt != null && conn.rtt > 300) return 'weak';
      if (conn.downlink != null && conn.downlink < 0.5) return 'weak';
      if (t === '3g') return 'weak';
      return 'good';
    }

    function verify() {
      if (!navigator.onLine) { setQuality('offline'); return; }
      var start = Date.now();
      fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(function () {
          var ms = Date.now() - start;
          if (ms > 2000) { setQuality('weak'); return; }
          var netQ = classifyByNetworkInfo();
          setQuality(ms > 600 ? 'weak' : (netQ || 'good'));
        })
        .catch(function () {
          if (!navigator.onLine) setQuality('offline');
          else setQuality('weak');
        });
    }

    function init() {
      ensureIndicator();
      var netQ = classifyByNetworkInfo();
      if (!navigator.onLine) setQuality('offline');
      else if (netQ) setQuality(netQ);
      else setQuality('good');
      verify();

      window.addEventListener('online', function () { setTimeout(verify, 300); });
      window.addEventListener('offline', function () { setQuality('offline'); });

      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && conn.addEventListener) {
        conn.addEventListener('change', function () { setTimeout(verify, 200); });
      }
      setInterval(verify, 12000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  })();

  // ---------- Auto-Update UI (Electron only) ----------

  if (window.desktop && window.desktop.onUpdateEvent) {
    var updateBar = null;
    var updateBarInner = null;
    var updateBarText = null;
    var updatePercent = null;

    function ensureUpdateBar() {
      if (updateBar) return;
      updateBar = document.createElement('div');
      updateBar.id = 'electron-update-bar';
      updateBar.className = 'fixed bottom-0 left-0 right-0 z-[150] hidden';
      updateBar.style.cssText = 'backdrop-filter:blur(12px);background:rgba(15,23,42,0.88);border-top:1px solid rgba(255,255,255,0.08);transition:transform .3s ease,opacity .3s ease;';
      updateBar.innerHTML =
        '<div class="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">' +
          '<span class="material-symbols-outlined text-primary text-[18px]">system_update</span>' +
          '<span id="electron-update-text" class="font-body-sm text-body-sm text-white/80 flex-1">Downloading update...</span>' +
          '<span id="electron-update-pct" class="font-label-md text-label-md text-white/60 tabular-nums min-w-[36px] text-right">0%</span>' +
          '<div class="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">' +
            '<div id="electron-update-fill" class="h-full bg-primary rounded-full transition-all duration-300" style="width:0%"></div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(updateBar);
      updateBarText = document.getElementById('electron-update-text');
      updatePercent = document.getElementById('electron-update-pct');
      updateBarInner = document.getElementById('electron-update-fill');
    }

    function showUpdateBar(text, pct) {
      ensureUpdateBar();
      if (updateBarText) updateBarText.textContent = text || 'Downloading update...';
      if (updatePercent) updatePercent.textContent = pct != null ? pct + '%' : '';
      if (updateBarInner) updateBarInner.style.width = (pct || 0) + '%';
      updateBar.classList.remove('hidden');
      updateBar.style.transform = 'translateY(0)';
      updateBar.style.opacity = '1';
    }

    function hideUpdateBar() {
      if (!updateBar) return;
      updateBar.style.transform = 'translateY(100%)';
      updateBar.style.opacity = '0';
      setTimeout(function () { if (updateBar) updateBar.classList.add('hidden'); }, 350);
    }

    function showUpdateModal(version) {
      var overlay = document.createElement('div');
      overlay.id = 'electron-update-modal';
      overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4';
      overlay.style.cssText = 'animation:fadeIn .2s ease;';
      overlay.innerHTML =
        '<style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}</style>' +
        '<div class="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md overflow-hidden" style="animation:scaleIn .25s ease">' +
          '<div class="px-6 pt-6 pb-2 flex items-start gap-4">' +
            '<div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center shrink-0">' +
              '<span class="material-symbols-outlined text-on-secondary-container text-[20px]">download_done</span>' +
            '</div>' +
            '<div class="min-w-0">' +
              '<h3 class="font-headline-md text-headline-md text-on-surface">Update Ready</h3>' +
              '<p class="font-body-md text-body-md text-on-surface-variant mt-1">Version ' + escapeHtmlModal(version) + ' has been downloaded. Restart now to apply the update.</p>' +
            '</div>' +
          '</div>' +
          '<div class="px-6 py-4 flex justify-end gap-3">' +
            '<button type="button" class="px-4 py-2 border border-outline-variant rounded text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors" id="electron-update-later">Later</button>' +
            '<button type="button" class="bg-primary-container text-on-primary-container hover:bg-primary transition-colors px-4 py-2 rounded font-label-md text-label-md shadow-sm active:shadow-inner" id="electron-update-restart">Restart Now</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      overlay.addEventListener('mousedown', function (ev) {
        if (ev.target === overlay) overlay.remove();
      });
      document.getElementById('electron-update-later').addEventListener('click', function () { overlay.remove(); });
      document.getElementById('electron-update-restart').addEventListener('click', function () {
        window.desktop.installUpdate();
      });
    }

    function escapeHtmlModal(str) {
      var div = document.createElement('div');
      div.textContent = str == null ? '' : String(str);
      return div.innerHTML;
    }

    window.desktop.onUpdateEvent(function (data) {
      if (data.type === 'available') {
        showUpdateBar('v' + data.version + ' available — downloading...', null);
      } else if (data.type === 'progress') {
        showUpdateBar('Downloading update...', data.percent);
      } else if (data.type === 'downloaded') {
        hideUpdateBar();
        setTimeout(function () { showUpdateModal(data.version); }, 400);
      } else if (data.type === 'error') {
        hideUpdateBar();
      }
    });
  }
})();
