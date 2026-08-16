// Shared button loading/busy-state helper.
//
// Usage:
//   window.UI.busy(btn, true/false)         -> toggle a spinner on one button
//   window.UI.busyGroup(selector, true)     -> toggle on every matching button
//   await window.UI.run(btn, label, fn)     -> show spinner, run fn, restore
//
// The button's original content is stashed in a data attribute and restored
// afterwards, so the label/icons come back exactly as they were. A `data-busy`
// attribute carries the text shown while busy (defaults to "Saving...").

window.UI = (function () {
  if (!document.getElementById('ui-spin-style')) {
    const style = document.createElement('style');
    style.id = 'ui-spin-style';
    style.textContent = '@keyframes ui-spin{to{transform:rotate(360deg)}}.ui-spinner{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ui-spin .7s linear infinite;vertical-align:-2px;margin-right:6px}';
    (document.head || document.documentElement).appendChild(style);
  }

  function busy(btn, on) {
    if (!btn) return;
    if (on) {
      if (btn.dataset.uiBusy) return;
      btn.dataset.uiBusy = '1';
      btn.dataset.uiLabel = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('opacity-60', 'cursor-not-allowed');
      btn.innerHTML = '<span class="ui-spinner"></span>' + (btn.getAttribute('data-busy') || 'Saving...');
    } else {
      if (!btn.dataset.uiBusy) return;
      delete btn.dataset.uiBusy;
      btn.disabled = false;
      btn.classList.remove('opacity-60', 'cursor-not-allowed');
      btn.innerHTML = btn.dataset.uiLabel || '';
      delete btn.dataset.uiLabel;
    }
  }

  function busyGroup(selector, on) {
    document.querySelectorAll(selector).forEach((b) => busy(b, on));
  }

  async function run(btn, label, fn) {
    const prev = btn && btn.getAttribute('data-busy');
    if (label) btn && btn.setAttribute('data-busy', label);
    busy(btn, true);
    try {
      return await fn();
    } finally {
      if (label) btn && (label ? btn.setAttribute('data-busy', prev || 'Saving...') : btn.removeAttribute('data-busy'));
      busy(btn, false);
    }
  }

  return { busy, busyGroup, run };
})();
