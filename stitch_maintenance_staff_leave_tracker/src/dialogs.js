// Reusable themed dialog components.
//
//   await Dialogs.confirm({ title, message, confirmText, cancelText, danger })
//   Dialogs.alert({ title, message, type, confirmText })
//   Dialogs.toast(message, type)
//
// `type` is one of 'error' | 'warning' | 'success' | 'info'. All markup uses
// Tailwind utilities (with dark-mode variants) so the dialogs match the app
// theme on every page that loads this module.

window.Dialogs = (function () {
  const TYPES = {
    error: { icon: 'error', cls: 'bg-error-container text-on-error-container' },
    warning: { icon: 'warning', cls: 'bg-tertiary-container text-on-tertiary-container' },
    success: { icon: 'check_circle', cls: 'bg-secondary-container text-on-secondary-container' },
    info: { icon: 'info', cls: 'bg-primary-fixed text-on-primary-fixed' },
  };

  let root = null;
  let toastRoot = null;
  let open = false;
  let currentResolve = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'ui-dialog-root';
    root.className = 'fixed inset-0 z-[200] hidden items-center justify-center bg-black/40 p-4';
    root.addEventListener('mousedown', function (ev) {
      if (ev.target === root) close(false);
    });
    document.body.appendChild(root);
    return root;
  }

  function ensureToastRoot() {
    if (toastRoot) return toastRoot;
    toastRoot = document.createElement('div');
    toastRoot.id = 'ui-toast-root';
    toastRoot.className = 'fixed bottom-4 right-4 z-[210] flex flex-col gap-2 items-end';
    document.body.appendChild(toastRoot);
    return toastRoot;
  }

  function close(result) {
    if (!root) return;
    root.classList.add('hidden');
    root.classList.remove('flex');
    root.innerHTML = '';
    open = false;
    if (currentResolve) {
      const resolve = currentResolve;
      currentResolve = null;
      resolve(result);
    }
  }

  document.addEventListener('keydown', function (ev) {
    if (open && ev.key === 'Escape') close(false);
  });

  function render(opts) {
    const t = TYPES[opts.type] || TYPES.info;
    ensureRoot();
    const okCls = (opts.danger ? 'bg-error text-white hover:bg-error/90' : 'bg-primary-container text-on-primary hover:bg-primary') +
      ' px-4 py-2 rounded font-label-md text-label-md shadow-sm active:shadow-inner transition-colors';
    const cancelCls = 'px-4 py-2 border border-outline-variant rounded text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors';
    const footer = opts.cancelText
      ? '<button type="button" class="' + cancelCls + '" data-dialog-cancel>' + escapeHtml(opts.cancelText) + '</button>' +
        '<button type="button" class="' + okCls + '" data-dialog-ok>' + escapeHtml(opts.confirmText || 'OK') + '</button>'
      : '<button type="button" class="' + okCls + '" data-dialog-ok>' + escapeHtml(opts.confirmText || 'OK') + '</button>';
    root.innerHTML =
      '<div class="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md overflow-hidden">' +
      '<div class="px-6 pt-6 pb-2 flex items-start gap-4">' +
      '<div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + t.cls + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + t.icon + '</span></div>' +
      '<div class="min-w-0">' +
      '<h3 class="font-headline-md text-headline-md text-on-surface">' + escapeHtml(opts.title) + '</h3>' +
      (opts.message ? '<p class="font-body-md text-body-md text-on-surface-variant mt-1">' + escapeHtml(opts.message) + '</p>' : '') +
      '</div></div>' +
      '<div class="px-6 py-4 flex justify-end gap-3">' + footer + '</div>' +
      '</div>';
    root.classList.remove('hidden');
    root.classList.add('flex');
    open = true;
    return new Promise(function (resolve) {
      currentResolve = resolve;
      const okBtn = root.querySelector('[data-dialog-ok]');
      if (okBtn) okBtn.focus();
      okBtn.addEventListener('click', function () { close(true); });
      const cancelBtn = root.querySelector('[data-dialog-cancel]');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { close(false); });
    });
  }

  function confirm(opts) {
    return render({
      title: opts.title || 'Please confirm',
      message: opts.message,
      type: opts.type || 'info',
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      danger: opts.danger !== false,
    });
  }

  function alert(opts) {
    return render({
      title: opts.title || '',
      message: opts.message,
      type: opts.type || 'info',
      confirmText: opts.confirmText || 'OK',
      cancelText: '',
    });
  }

  function toast(message, type) {
    const t = TYPES[type] || TYPES.info;
    ensureToastRoot();
    const el = document.createElement('div');
    el.className = 'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border border-outline-variant bg-surface-container-lowest max-w-sm';
    el.innerHTML =
      '<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' + t.cls + '">' +
      '<span class="material-symbols-outlined text-[18px]">' + t.icon + '</span></div>' +
      '<p class="font-body-sm text-body-sm text-on-surface">' + escapeHtml(message) + '</p>';
    toastRoot.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  return { confirm, alert, toast };
})();
