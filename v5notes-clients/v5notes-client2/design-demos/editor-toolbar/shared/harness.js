/* shared/harness.js — 三版共用的交互外壳（纯前端 mock，不接后端） */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var initialMode = params.get('mode');
  var state = {
    mode: (initialMode === 'source' || initialMode === 'preview') ? initialMode : 'edit',
    fmt: params.get('fmt') === 'off' ? 'off' : 'on',
    font: parseInt(params.get('font') || '17', 10),
    focus: params.get('focus') === '1',
    dirty: false
  };

  var docText = '把光标放进正文，随意输入几个字，状态会变成「未保存」。';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- toast ---------- */
  var toastHost = null;
  function toast(message, icon) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      document.body.appendChild(toastHost);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<svg class="ic ic-15" viewBox="0 0 20 20" aria-hidden="true">' + (icon || '<path d="m4.5 10.5 3.4 3.4 7.6-7.6"/>') + '</svg><span></span>';
    el.querySelector('span').textContent = message;
    toastHost.appendChild(el);
    setTimeout(function () { el.style.transition = 'opacity .2s ease, transform .2s ease'; el.style.opacity = '0'; el.style.transform = 'translateY(4px)'; }, 2100);
    setTimeout(function () { el.remove(); }, 2350);
  }

  /* ---------- menus ---------- */
  function closeMenus(except) {
    $$('.menu').forEach(function (m) {
      if (m !== except) m.hidden = true;
    });
    $$('[data-menu-trigger]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
  }
  function toggleMenu(name) {
    var trigger = $('[data-menu-trigger="' + name + '"]');
    var panel = $('[data-menu-panel="' + name + '"]');
    if (!trigger || !panel) return;
    var willOpen = panel.hidden;
    closeMenus(willOpen ? panel : null);
    panel.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-menu-trigger]');
    if (trigger) {
      event.preventDefault();
      toggleMenu(trigger.getAttribute('data-menu-trigger'));
      return;
    }
    if (!event.target.closest('.menu')) closeMenus(null);
  });

  /* ---------- state application ---------- */
  function apply() {
    document.body.dataset.mode = state.mode;
    document.body.dataset.fmt = state.fmt;
    document.body.classList.toggle('is-focus', state.focus);
    var app = $('.app');
    if (app) app.classList.toggle('is-focus', state.focus);
    document.documentElement.style.setProperty('--doc-size', state.font + 'px');

    $$('[data-bind="font-value"]').forEach(function (el) { el.textContent = String(state.font); });
    $$('[data-font-value]').forEach(function (el) {
      el.setAttribute('aria-pressed', Number(el.getAttribute('data-font-value')) === state.font ? 'true' : 'false');
    });
    $$('[data-act="mode"]').forEach(function (el) {
      el.setAttribute('aria-pressed', el.getAttribute('data-value') === state.mode ? 'true' : 'false');
    });
    $$('[data-act="fmt-toggle"]').forEach(function (el) {
      el.setAttribute('aria-pressed', state.fmt === 'on' ? 'true' : 'false');
      el.setAttribute('title', state.fmt === 'on' ? '隐藏编辑器工具条' : '显示编辑器工具条');
    });
    $$('[data-act="focus"]').forEach(function (el) {
      el.setAttribute('aria-pressed', state.focus ? 'true' : 'false');
    });
    $$('[data-bind="fmt-label"]').forEach(function (el) {
      el.textContent = state.fmt === 'on' ? '已显示' : '已隐藏';
    });
    $$('[data-only]').forEach(function (el) {
      var only = el.getAttribute('data-only');
      var ok;
      if (only === 'edit') ok = state.mode === 'edit' || state.mode === 'source';
      else if (only === 'wysiwyg') ok = state.mode === 'edit';
      else if (only === 'preview') ok = state.mode === 'preview';
      else if (only === 'source') ok = state.mode === 'source';
      else if (only === 'not-preview') ok = state.mode !== 'preview';
      else if (only === 'fmt') { el.hidden = !(state.fmt === 'on' && state.mode === 'edit'); return; }
      else ok = true;
      el.hidden = !ok;
    });
    var doc = $('.doc');
    if (doc) {
      doc.setAttribute('contenteditable', state.mode === 'edit' ? 'true' : 'false');
      doc.setAttribute('spellcheck', 'false');
    }
    var src = $('.source');
    if (src) src.setAttribute('contenteditable', state.mode === 'source' ? 'true' : 'false');

    $$('.palette-item').forEach(function (el) { el.hidden = !itemAllowed(el); });
    refreshPaletteGroups();
  }

  function setMode(mode) {
    state.mode = mode;
    apply();
    var label = mode === 'preview' ? '预览模式' : (mode === 'source' ? '源码模式' : '所见即所得');
    toast('已切换到' + label);
  }
  function setFmt(on) {
    state.fmt = on ? 'on' : 'off';
    apply();
    if (window.V5 && window.V5.onFmtChange) window.V5.onFmtChange(on);
    toast(on ? '编辑器工具条已显示' : '编辑器工具条已隐藏 · ⌘/ 可恢复');
  }
  function setFont(value) {
    state.font = Math.max(13, Math.min(26, value));
    apply();
    if (window.V5 && window.V5.onFontChange) window.V5.onFontChange(state.font);
  }
  function setFocus(on) {
    state.focus = on;
    apply();
    if (window.V5 && window.V5.onFocusChange) window.V5.onFocusChange(on);
  }
  function setDirty(dirty) {
    state.dirty = dirty;
    $$('[data-bind="save-state"]').forEach(function (el) {
      el.classList.toggle('is-dirty', dirty);
      el.classList.remove('is-saving');
      el.querySelector('span').textContent = dirty ? '未保存' : '已保存';
    });
    $$('[data-bind="save-button"]').forEach(function (el) {
      if (!el.hasAttribute('data-save-merged')) el.disabled = !dirty;
    });
    $$('.split').forEach(function (el) { el.classList.toggle('is-idle', !dirty); });
    $$('[data-bind="save-label"]').forEach(function (el) { el.textContent = dirty ? '保存' : '已保存'; });
    $$('[data-save-merged]').forEach(function (el) { el.classList.toggle('is-clean', !dirty); });
  }
  function save() {
    var buttons = $$('[data-bind="save-button"]');
    $$('[data-bind="save-state"]').forEach(function (el) {
      el.classList.remove('is-dirty');
      el.classList.add('is-saving');
      el.querySelector('span').textContent = '保存中…';
    });
    $$('[data-bind="save-label"]').forEach(function (el) { el.textContent = '保存中…'; });
    buttons.forEach(function (b) { if (!b.hasAttribute('data-save-merged')) b.disabled = true; });
    setTimeout(function () {
      setDirty(false);
      toast('已保存');
    }, 520);
  }

  /* ---------- history dialog ---------- */
  function openHistory() {
    var dialog = $('[data-dialog="history"]');
    if (dialog) dialog.hidden = false;
  }
  function closeDialog(dialog) { if (dialog) dialog.hidden = true; }

  /* ---------- command palette (variant C) ---------- */
  var paletteFiltered = [];
  var MODE_LABEL = { edit: '所见即所得', source: '源码模式', preview: '预览' };

  function itemAllowed(el) {
    var only = el.getAttribute('data-only');
    if (only) {
      var ok;
      if (only === 'edit') ok = state.mode === 'edit' || state.mode === 'source';
      else if (only === 'wysiwyg') ok = state.mode === 'edit';
      else if (only === 'not-preview') ok = state.mode !== 'preview';
      else if (only === 'preview') ok = state.mode === 'preview';
      else ok = true;
      if (!ok) return false;
    }
    var mi = el.getAttribute('data-mode-item');
    if (mi && mi === state.mode) return false;
    return true;
  }

  function refreshPaletteGroups() {
    var palette = $('[data-dialog="palette"]');
    if (!palette) return;
    var visible = 0;
    $$('.palette-item', palette).forEach(function (item) { if (!item.hidden) visible += 1; });
    $$('.palette-group', palette).forEach(function (group) {
      var next = group.nextElementSibling;
      var any = false;
      while (next && !next.classList.contains('palette-group')) {
        if (next.classList.contains('palette-item') && !next.hidden) any = true;
        next = next.nextElementSibling;
      }
      group.hidden = !any;
    });
    $$('[data-bind="palette-count"]').forEach(function (el) { el.textContent = visible + ' 项可用'; });
    $$('[data-bind="edit-mode-label"]').forEach(function (el) {
      el.textContent = state.mode === 'source' ? '所见即所得' : '回到编辑';
    });
    $$('[data-bind="palette-mode"]').forEach(function (el) {
      el.textContent = MODE_LABEL[state.mode] + (state.mode === 'preview' ? ' · 只读' : '');
    });
  }
  function openPalette() {
    var palette = $('[data-dialog="palette"]');
    if (!palette) return;
    palette.hidden = false;
    var input = $('.palette-input input', palette);
    if (input) input.value = '';
    filterPalette('');
    if (input) input.focus();
    markPaletteActive(0);
  }
  function closePalette() {
    var palette = $('[data-dialog="palette"]');
    if (palette) palette.hidden = true;
  }
  function markPaletteActive(index) {
    var palette = $('[data-dialog="palette"]');
    if (!palette) return;
    paletteFiltered.forEach(function (item) { item.classList.remove('is-active'); });
    var item = paletteFiltered[index];
    if (item) item.classList.add('is-active');
    palette.dataset.index = String(index);
  }
  function filterPalette(query) {
    var palette = $('[data-dialog="palette"]');
    if (!palette) return;
    var q = query.trim().toLowerCase();
    paletteFiltered = [];
    $$('.palette-item', palette).forEach(function (item) {
      var hit = !q || item.textContent.toLowerCase().indexOf(q) >= 0;
      item.hidden = !(hit && itemAllowed(item));
      if (!item.hidden) paletteFiltered.push(item);
    });
    refreshPaletteGroups();
    markPaletteActive(0);
  }

  /* ---------- global actions ---------- */
  document.addEventListener('click', function (event) {
    var actionEl = event.target.closest('[data-act]');
    if (!actionEl) return;
    var act = actionEl.getAttribute('data-act');
    if (act === 'mode') { closeMenus(null); closePalette(); setMode(actionEl.getAttribute('data-value')); }
    else if (act === 'fmt-toggle') { closeMenus(null); closePalette(); setFmt(state.fmt !== 'on'); }
    else if (act === 'focus') { closeMenus(null); setFocus(!state.focus); }
    else if (act === 'save') { closeMenus(null); save(); }
    else if (act === 'history') { closeMenus(null); closePalette(); openHistory(); }
    else if (act === 'font-step') { setFont(state.font + Number(actionEl.getAttribute('data-delta'))); }
    else if (act === 'font-preset') { setFont(Number(actionEl.getAttribute('data-size'))); }
    else if (act === 'export') {
      closeMenus(null);
      var format = actionEl.getAttribute('data-format');
      var names = { html: 'HTML 网页', pdf: 'PDF 文档', md: 'Markdown 源文件', png: 'PNG 长图' };
      toast('已开始导出 ' + (names[format] || format) + '：春分·编辑器的呼吸感');
    }
    else if (act === 'palette') { closePalette(); openPalette(); }
    else if (act === 'close-dialog') { closeDialog(actionEl.closest('.backdrop')); }
  });

  document.addEventListener('input', function (event) {
    if (event.target.closest('.doc') || event.target.closest('.source')) setDirty(true);
  });

  document.addEventListener('keydown', function (event) {
    var mod = event.metaKey || event.ctrlKey;
    if (event.key === 'Escape') {
      var openDialog = $$('.backdrop').filter(function (d) { return !d.hidden; })[0];
      if (openDialog) { closeDialog(openDialog); event.preventDefault(); return; }
      if (!($('.menu:not([hidden])'))) return;
      closeMenus(null);
      return;
    }
    if (!mod) return;
    var key = event.key.toLowerCase();
    if (key === 's') { event.preventDefault(); save(); }
    else if (event.key === '/') { event.preventDefault(); setFmt(state.fmt !== 'on'); }
    else if (key === 'k') { event.preventDefault(); openPalette(); }
  });

  /* palette keyboard */
  document.addEventListener('keydown', function (event) {
    var palette = $('[data-dialog="palette"]');
    if (!palette || palette.hidden) return;
    var index = Number(palette.dataset.index || 0);
    if (event.key === 'ArrowDown') { event.preventDefault(); markPaletteActive(Math.min(paletteFiltered.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); markPaletteActive(Math.max(0, index - 1)); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      var item = paletteFiltered[index];
      if (item) item.click();
    }
  });
  document.addEventListener('input', function (event) {
    if (event.target.closest('.palette')) filterPalette(event.target.value);
  });

  document.addEventListener('input', function (event) {
    var range = event.target.closest('[data-font-range]');
    if (range) setFont(Number(range.value));
  });

  /* ---------- boot ---------- */
  window.V5 = {
    state: state,
    apply: apply,
    setMode: setMode,
    setFmt: setFmt,
    setFont: setFont,
    setFocus: setFocus,
    setDirty: setDirty,
    toast: toast,
    save: save,
    openMenu: toggleMenu,
    openPalette: openPalette,
    closePalette: closePalette,
    openHistory: openHistory
  };

  function boot() {
    apply();
    setDirty(false);
    var panel = params.get('panel');
    if (panel === 'export') toggleMenu('export');
    if (panel === 'font') toggleMenu('font');
    if (panel === 'note') toggleMenu('note');
    if (panel === 'history') openHistory();
    if (panel === 'palette') openPalette();
    if (params.get('dirty') === '1') setDirty(true);
    if (params.get('hint') === '1') {
      setTimeout(function () { toast(docText, '<path d="M10 3.5v7M6.8 7.2 10 10.4l3.2-3.2M4 14v2.5h12V14"/>'); }, 500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
