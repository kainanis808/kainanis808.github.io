/*
 * a11y.js — MECH 191 site-wide screen-reader & keyboard support
 * ----------------------------------------------------------------
 * Loaded synchronously near the top of <head> on every page so it can see the
 * click handlers that each page's own script attaches later. It does not change
 * how any page looks or behaves for mouse users. What it adds:
 *
 *  1. Keyboard access: any non-button element that gets a click handler
 *     (cards, legend items, table rows, step dots, SVG zones) becomes focusable,
 *     gets role="button", and responds to Enter / Space.
 *  2. Toggle state: buttons in a group that use an "active"/"selected" class
 *     (tabs, process toggles, material pickers) get aria-pressed kept in sync.
 *  3. Announcements: after a user presses a control, text that changes
 *     elsewhere on the page (info panels, readouts) is read out through a
 *     polite live region.
 *  4. Sliders: range inputs get aria-valuetext from the readout next to them.
 *  5. Detail panels that open on click receive focus; focus returns on close.
 *  6. Symbols such as ▶ ◀ ⏸ ↺ ✕ are dropped from button/link names so
 *     "▶ Play" is read as "Play".
 *  8. Canvas diagram labels are drawn in a colour that meets 4.5:1 against
 *     whatever is behind them (hue kept; only failing labels change).
 *  9. Canvas lines and solid shapes reach 3:1 against their surroundings
 *     (line colour nudged, or a 1 px outline added to low-contrast shapes).
 *  7. Fallbacks: a skip link, a main landmark if missing, labels for canvases
 *     created by script, scope on table headers built by script, and
 *     "(PDF)" / "(opens in new tab)" hints on links.
 *
 * Static fixes (alt text for diagrams, table captions, form labels) live in the
 * HTML itself; this file only handles behaviour that has to run in the browser.
 */
(function () {
  'use strict';

  var NATIVE_TAGS = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|OPTION|LABEL|DETAILS|AUDIO|VIDEO|IFRAME)$/;
  var NEVER_BUTTON = /^(HTML|BODY|MAIN|HEADER|FOOTER|NAV|SECTION|ARTICLE|FORM|TABLE|THEAD|TBODY|TFOOT|UL|OL|DL|CANVAS|SVG|svg|IMG|SCRIPT|STYLE)$/;
  var ACTIVE_CLASS = /(^|[\s_-])(active|selected|current|on)($|[\s_-])/;
  var GLYPHS = /[▶▸►◀◂◄⏵⏸⏹⏮⏭⏯■↺↻⟲⟳←→✕✖×]️?/g;
  var GLYPH_NAMES = {
    '▶': 'Play', '▸': 'Play', '►': 'Play', '⏵': 'Play',
    '⏸': 'Pause', '⏹': 'Stop', '■': 'Stop',
    '◀': 'Previous', '◂': 'Previous', '◄': 'Previous', '⏮': 'Previous',
    '⏭': 'Next', '→': 'Next', '←': 'Back',
    '↺': 'Reset', '↻': 'Reset', '⟲': 'Reset', '⟳': 'Reset',
    '✕': 'Close', '✖': 'Close', '×': 'Close'
  };

  var origAdd = EventTarget.prototype.addEventListener;

  /* ---------- 1. Keyboard access for click-only elements ---------- */
  var pending = [];
  var flushScheduled = false;
  var operable = [];

  function queueOperable(el) {
    if (!el || el.nodeType !== 1) return;
    pending.push(el);
    if (!flushScheduled) { flushScheduled = true; setTimeout(flushOperable, 0); }
  }
  function flushOperable() {
    flushScheduled = false;
    var list = pending; pending = [];
    for (var i = 0; i < list.length; i++) makeOperable(list[i]);
  }

  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'click' && this && this.nodeType === 1) queueOperable(this);
    return origAdd.call(this, type, fn, opts);
  };
  [window.HTMLElement, window.SVGElement].forEach(function (Ctor) {
    if (!Ctor) return;
    var d = Object.getOwnPropertyDescriptor(Ctor.prototype, 'onclick');
    if (!d || !d.set) return;
    Object.defineProperty(Ctor.prototype, 'onclick', {
      configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (v) { d.set.call(this, v); if (v) queueOperable(this); }
    });
  });

  function hasInteractiveDescendant(el) {
    return !!el.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]');
  }
  function textOf(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function hasName(el) {
    return el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
      textOf(el).replace(GLYPHS, '').trim();
  }

  function makeOperable(el) {
    if (el.__a11yOp || !el.isConnected && document.readyState === 'complete') return;
    var tag = el.tagName;
    if (NATIVE_TAGS.test(tag) || NEVER_BUTTON.test(tag)) return;
    if (el.closest && el.closest('button, a[href], [role="button"]') && el.closest('button, a[href], [role="button"]') !== el) return;
    var role = el.getAttribute('role');
    if (role && role !== 'button' && role !== 'img' && role !== 'presentation') return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    if (hasInteractiveDescendant(el)) return;           // a delegating container, not a control
    el.__a11yOp = true;
    el.__a11yAdded = { tabindex: !el.hasAttribute('tabindex'), role: !role || role === 'img' || role === 'presentation' };
    if (el.__a11yAdded.tabindex) el.setAttribute('tabindex', '0');
    if (tag !== 'TR' && el.__a11yAdded.role) el.setAttribute('role', 'button');
    if (!hasName(el)) {
      var t = el.getAttribute('title') || el.getAttribute('data-label') || el.getAttribute('data-name');
      if (!t) {
        var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.className === el.className; }) : [el];
        t = 'Step ' + (sibs.indexOf(el) + 1) + ' of ' + sibs.length;
      }
      el.setAttribute('aria-label', t);
    }
    origAdd.call(el, 'keydown', function (e) {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });
    operable.push(el);
  }

  // Undo for elements that turned out to be containers once their children were added.
  function recheckOperable() {
    operable = operable.filter(function (el) {
      if (!el.__a11yOp) return false;
      var kids = el.querySelector('a[href], button, input, select, textarea, [role="button"]');
      if (kids) {
        if (el.__a11yAdded.tabindex) el.removeAttribute('tabindex');
        if (el.__a11yAdded.role && el.getAttribute('role') === 'button') el.removeAttribute('role');
        el.__a11yOp = false;
        return false;
      }
      return true;
    });
  }

  function scanOnclickAttributes(root) {
    var els = (root || document).querySelectorAll('[onclick]');
    for (var i = 0; i < els.length; i++) makeOperable(els[i]);
  }

  /* ---------- 2. aria-pressed for toggle groups ---------- */
  function isButtonish(el) {
    return el && el.nodeType === 1 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  }
  function cls(el) { return el.getAttribute('class') || ''; }
  function syncGroup(parent) {
    if (!parent) return;
    var group = Array.prototype.filter.call(parent.children, isButtonish);
    if (group.length < 2) return;
    var anyActive = group.some(function (b) { return ACTIVE_CLASS.test(cls(b)); });
    var tracked = group.some(function (b) { return b.hasAttribute('aria-pressed'); });
    if (!anyActive && !tracked) return;
    group.forEach(function (b) {
      if (b.__a11yNoPress) return;
      b.setAttribute('aria-pressed', ACTIVE_CLASS.test(cls(b)) ? 'true' : 'false');
    });
  }
  function syncAllGroups() {
    var seen = new Set();
    document.querySelectorAll('button, [role="button"]').forEach(function (b) {
      if (b.parentElement && !seen.has(b.parentElement)) { seen.add(b.parentElement); syncGroup(b.parentElement); }
    });
  }

  /* ---------- 6. Remove decorative symbols from accessible names ---------- */
  function relabel(el) {
    if (el.hasAttribute('aria-label') && el.getAttribute('data-a11y-label') !== 'auto') return;
    if (el.hasAttribute('aria-labelledby')) return;
    var raw = textOf(el);
    if (!GLYPHS.test(raw)) { GLYPHS.lastIndex = 0; if (el.getAttribute('data-a11y-label') === 'auto') { el.removeAttribute('aria-label'); el.removeAttribute('data-a11y-label'); } return; }
    GLYPHS.lastIndex = 0;
    var name = raw.replace(GLYPHS, ' ').replace(/\s+/g, ' ').replace(/^[\s\/|·-]+|[\s\/|·-]+$/g, '').trim();
    if (!name) {
      var m = raw.match(GLYPHS); GLYPHS.lastIndex = 0;
      name = m ? m.map(function (g) { return GLYPH_NAMES[g.charAt(0)] || ''; }).join(' / ').trim() : '';
    }
    if (name) { el.setAttribute('aria-label', name); el.setAttribute('data-a11y-label', 'auto'); }
  }
  function relabelAll(root) {
    (root || document).querySelectorAll('button, a[href], [role="button"]').forEach(relabel);
  }

  /* ---------- 3. Live announcements ---------- */
  var live, armedUntil = 0, armSource = null, changed = [], announceTimer = null;
  var valueSources = new WeakSet();
  function ensureLive() {
    if (live) return live;
    live = document.createElement('div');
    live.id = 'a11y-live';
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
    return live;
  }
  function announce(msg) {
    ensureLive();
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 60);
  }
  function arm(src) { armedUntil = Date.now() + 700; armSource = src || null; }

  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    if (!el.getClientRects().length) return false;
    var s = getComputedStyle(el);
    return s.visibility !== 'hidden';
  }
  function excluded(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('script, style, canvas, svg, #a11y-live, [aria-live], [role="status"], [role="alert"], [aria-hidden="true"]')) return true;
    if (armSource && (armSource === el || armSource.contains(el))) return true;
    if (valueSources.has(el)) return true;
    var c = el.closest('button, [role="button"]');
    if (c) return true;
    return false;
  }
  function onMutations(records) {
    var now = Date.now();
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'CANVAS') labelCanvas(n);
          if (n.querySelectorAll) {
            n.querySelectorAll('canvas').forEach(labelCanvas);
            n.querySelectorAll('[onclick]').forEach(makeOperable);
            n.querySelectorAll('th:not([scope])').forEach(scopeTh);
            relabelAll(n);
            if (isButtonish(n)) relabel(n);
          }
          if (n.tagName === 'TH') scopeTh(n);
        }
        if (isButtonish(r.target)) relabel(r.target);
      } else if (r.type === 'characterData') {
        var p = r.target.parentElement;
        var b = p && p.closest('button, [role="button"]');
        if (b) relabel(b);
      } else if (r.type === 'attributes') {
        var t = r.target;
        if (r.attributeName === 'class' && isButtonish(t)) syncGroup(t.parentElement);
        if (t.__a11yPanel) panelChanged(t);
        continue;
      }
      if (now > armedUntil) continue;
      var target = r.type === 'characterData' ? r.target.parentElement : r.target;
      if (!excluded(target)) changed.push(target);
    }
    if (changed.length) {
      clearTimeout(announceTimer);
      announceTimer = setTimeout(flushAnnouncement, 450);
    }
  }
  function flushAnnouncement() {
    var list = changed; changed = [];
    var tops = list.filter(function (el, i) {
      if (list.indexOf(el) !== i) return false;
      if (!el.isConnected || !isVisible(el)) return false;
      return !list.some(function (o) { return o !== el && o.contains(el); });
    });
    var parts = [];
    tops.forEach(function (el) {
      var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      // A bare value such as "221 MPa" is read with its nearby label ("Tensile Strength 221 MPa").
      if (t.length < 30) {
        var up = el.parentElement;
        for (var k = 0; up && k < 2; k++, up = up.parentElement) {
          var ut = (up.textContent || '').replace(/\s+/g, ' ').trim();
          if (ut.length > t.length && ut.length <= 160) { t = ut; break; }
        }
      }
      if (t.length > 450) {
        var h = el.querySelector('h1,h2,h3,h4,h5,[class*="title"],strong');
        t = (h ? textOf(h) + '. ' : '') + t.slice(0, 300).replace(/\s\S*$/, '') + '…';
      }
      if (parts.indexOf(t) === -1) parts.push(t);
    });
    if (parts.length) announce(parts.join('. ').slice(0, 900));
  }

  /* ---------- 4. Range inputs read their visible readout ---------- */
  function findReadout(input) {
    var id = input.id;
    var cands = [];
    if (id) ['Val', '-val', '_val', 'Value', '-value', '_value', '-display', 'Display', '-out', 'Out', '-label'].forEach(function (s) {
      var e = document.getElementById(id + s) || document.getElementById(id.replace(/-?slider$/i, '') + s);
      if (e) cands.push(e);
    });
    var sib = input.nextElementSibling;
    if (sib && (sib.tagName === 'OUTPUT' || /val|value|display|readout|out/i.test(cls(sib) + ' ' + (sib.id || '')))) cands.push(sib);
    var prev = input.previousElementSibling;
    if (prev && prev.querySelector) { var v = prev.querySelector('[class*="val"], [id*="val" i], output'); if (v) cands.push(v); }
    return cands[0] || null;
  }
  function syncRange(input) {
    var out = input.__a11yReadout;
    if (out === undefined) { out = input.__a11yReadout = findReadout(input); if (out) valueSources.add(out); }
    if (out) { var t = textOf(out); if (t) input.setAttribute('aria-valuetext', t); }
  }

  /* ---------- 5. Focus management for detail panels ---------- */
  var lastOpener = null;
  function panelShown(el) { return isVisible(el); }
  function panelChanged(panel) {
    var shown = panelShown(panel);
    if (shown === panel.__a11yShown) return;
    panel.__a11yShown = shown;
    if (shown && Date.now() <= armedUntil) {
      lastOpener = armSource;
      var h = panel.querySelector('h1,h2,h3,h4') || panel;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      setTimeout(function () { try { h.focus({ preventScroll: false }); } catch (e) { h.focus(); } }, 50);
    } else if (!shown && lastOpener && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
      try { lastOpener.focus(); } catch (e) {}
      lastOpener = null;
    }
  }
  function registerPanels() {
    document.querySelectorAll('#detailPanel, .detail-panel, [role="dialog"], .modal').forEach(function (p) {
      p.__a11yPanel = true; p.__a11yShown = panelShown(p);
      if (!p.hasAttribute('role')) p.setAttribute('role', 'region');
      if (!p.hasAttribute('aria-label') && !p.hasAttribute('aria-labelledby')) {
        var h = p.querySelector('h1,h2,h3,h4');
        if (h) { if (!h.id) h.id = 'a11y-panel-h-' + Math.random().toString(36).slice(2, 8); p.setAttribute('aria-labelledby', h.id); }
        else p.setAttribute('aria-label', 'Details');
      }
    });
  }

  /* ---------- 7. Fallbacks ---------- */
  function nearestHeadingText(el) {
    var node = el;
    for (var depth = 0; node && depth < 6; depth++, node = node.parentElement) {
      var h = node.querySelector && node.querySelector('h1,h2,h3,h4,h5,.card-title,[class*="title"],[class*="hdr"],[class*="header"]');
      if (h && h !== el && textOf(h)) return textOf(h);
    }
    return '';
  }
  function labelCanvas(c) {
    if (c.hasAttribute('role') || c.hasAttribute('aria-label') || c.hasAttribute('aria-labelledby') || c.hasAttribute('aria-hidden')) return;
    c.setAttribute('role', 'img');
    var h = nearestHeadingText(c);
    c.setAttribute('aria-label', (h ? h + ' — ' : '') + 'illustrative diagram. The surrounding text describes what it shows.');
  }
  function scopeTh(th) {
    if (th.hasAttribute('scope')) return;
    var row = th.parentElement;
    if (!row) return;
    var inHead = th.closest('thead');
    var rowHasTd = row.querySelector('td');
    if (inHead || !rowHasTd) th.setAttribute('scope', 'col');
    else if (row.firstElementChild === th) th.setAttribute('scope', 'row');
    else th.setAttribute('scope', 'col');
  }
  function linkHints() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (a.__a11yHint) return; a.__a11yHint = true;
      var href = (a.getAttribute('href') || '').toLowerCase().split(/[?#]/)[0];
      var m = href.match(/\.(pdf|docx?|pptx?|xlsx?|odt|zip)$/);
      var hint = '';
      var txt = textOf(a).toLowerCase();
      if (m && txt.indexOf(m[1].replace(/x$/, '')) === -1) {
        var names = { pdf: 'PDF', doc: 'Word document', docx: 'Word document', ppt: 'PowerPoint', pptx: 'PowerPoint', xls: 'Excel', xlsx: 'Excel', odt: 'OpenDocument text', zip: 'ZIP file' };
        hint += ' (' + names[m[1]] + ')';
      }
      if (a.target === '_blank' && txt.indexOf('new tab') === -1) hint += ' (opens in new tab)';
      if (hint && !a.hasAttribute('aria-label')) {
        var s = document.createElement('span'); s.className = 'sr-only'; s.textContent = hint; a.appendChild(s);
      }
    });
  }
  function ensureMainAndSkip() {
    var main = document.querySelector('main, [role="main"]');
    if (!main) {
      var h1 = document.querySelector('h1');
      main = h1 ? (h1.closest('header') ? h1.closest('header').nextElementSibling : h1.parentElement) : document.body.firstElementChild;
      if (main && main !== document.body) main.setAttribute('role', 'main');
    }
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    if (!document.querySelector('.a11y-skip')) {
      var a = document.createElement('a');
      a.className = 'a11y-skip'; a.href = '#' + main.id; a.textContent = 'Skip to main content';
      document.body.insertBefore(a, document.body.firstChild);
    }
  }


  /* ---------- 8. Readable canvas labels (WCAG 1.4.3 contrast) ----------
   * Diagrams drawn on <canvas> often put grey or coloured labels on top of
   * shapes whose colour changes as the animation runs. Before each label is
   * drawn, this samples the pixels behind it and, only if the label would fall
   * below 4.5:1 (3:1 for large text), shifts the label colour lighter or darker
   * while keeping its hue. Labels that already pass are drawn exactly as authored.
   */
  (function () {
    var C2D = window.CanvasRenderingContext2D;
    if (!C2D || !C2D.prototype.fillText) return;
    // Pixel reads are much cheaper on a CPU-backed 2D canvas.
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, opts) {
      if (type === '2d') { opts = Object.assign({ willReadFrequently: true }, opts || {}); }
      return origGetContext.call(this, type, opts);
    };
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
    function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    function rgb2hsl(c) {
      var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
      if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
      return [h, s, l];
    }
    function hsl2rgb(h, s, l) {
      function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
      if (!s) return [l * 255, l * 255, l * 255];
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
    }
    function parse(s) {
      var m = /^#([0-9a-f]{6})$/i.exec(s);
      if (m) { var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
      m = /rgba?\(([^)]+)\)/.exec(s);
      if (m) { var p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      return null;
    }
    var bgCache = new WeakMap();
    function cssBg(el) {
      if (bgCache.has(el)) return bgCache.get(el);
      var e = el, c = [255, 255, 255];
      while (e && e.nodeType === 1) {
        var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor);
        if (m) { var p = m[1].split(',').map(Number); if (p.length < 4 || p[3] > 0.5) { c = p.slice(0, 3); break; } }
        e = e.parentElement;
      }
      bgCache.set(el, c); return c;
    }
    var fixCache = new Map();
    // Find the smallest lightness shift (same hue) that gives `need` contrast against every colour in `bgs`.
    function search(fg, alpha, bgs, need) {
      var hsl = rgb2hsl(fg), a = alpha < 0.85 ? 1 : alpha;
      var mix = function (c, bg) { return [c[0] * a + bg[0] * (1 - a), c[1] * a + bg[1] * (1 - a), c[2] * a + bg[2] * (1 - a)]; };
      for (var step = 1; step <= 100; step++) {
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var l = hsl[2] + sgn * step / 100;
          if (l < 0 || l > 1) continue;
          var c = hsl2rgb(hsl[0], hsl[1], l);
          if (bgs.every(function (bg) { return ratio(mix(c, bg), bg) >= need + 0.3; })) return 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';
        }
      }
      return null;
    }
    function fixColor(fg, alpha, bgs, need) {
      var key = fg.join() + '|' + alpha + '|' + bgs.map(function (b) { return b.join(); }).join(';') + '|' + need;
      if (fixCache.has(key)) return fixCache.get(key);
      var ok = bgs.every(function (bg) {
        var e = [fg[0] * alpha + bg[0] * (1 - alpha), fg[1] * alpha + bg[1] * (1 - alpha), fg[2] * alpha + bg[2] * (1 - alpha)];
        return ratio(e, bg) >= need;
      });
      var result = null;
      if (!ok) {
        result = search(fg, alpha, bgs, need) || search(fg, alpha, bgs.slice(0, 1), need) ||
          (lum(bgs[0]) < 0.18 ? '#ffffff' : '#000000');
      }
      if (fixCache.size > 2000) fixCache.clear();
      fixCache.set(key, result);
      return result;
    }
    var origFill = C2D.prototype.fillText;
    C2D.prototype.fillText = function (text, x, y, maxWidth) {
      var swapped = false, saved;
      try {
        var fs = this.fillStyle, fg = typeof fs === 'string' ? parse(fs) : null, t = String(text);
        if (fg && t.trim()) {
          var m = this.measureText(t), tr = this.getTransform(), cv = this.canvas;
          var L = m.actualBoundingBoxLeft || 0, R = m.actualBoundingBoxRight || m.width, A = m.actualBoundingBoxAscent || 8, D = m.actualBoundingBoxDescent || 2;
          var x0 = x - L - 1, y0 = y - A - 1;
          var px = Math.max(0, Math.floor(tr.a * x0 + tr.c * y0 + tr.e)), py = Math.max(0, Math.floor(tr.b * x0 + tr.d * y0 + tr.f));
          var pw = Math.min(Math.ceil(Math.abs((L + R + 2) * tr.a)), cv.width - px), ph = Math.min(Math.ceil(Math.abs((A + D + 2) * tr.d)), cv.height - py);
          if (pw > 0 && ph > 0) {
            var d = this.getImageData(px, py, pw, ph).data, page = cssBg(cv), hist = {}, total = 0;
            var stride = Math.max(1, Math.floor(d.length / 4 / 1500)) * 4;
            for (var i = 0; i < d.length; i += stride) {
              var al = d[i + 3] / 255, r = d[i] * al + page[0] * (1 - al), g = d[i + 1] * al + page[1] * (1 - al), b = d[i + 2] * al + page[2] * (1 - al);
              var k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
              hist[k] = (hist[k] || 0) + 1; total++;
            }
            // Background = the most common colour behind the label, plus a second one if it covers a quarter of the area.
            var keys = Object.keys(hist).sort(function (p, q) { return hist[q] - hist[p]; });
            var toRgb = function (k) { k = +k; return [((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2]; };
            var bgs = [toRgb(keys[0])];
            if (keys[1] && hist[keys[1]] / total >= 0.25) bgs.push(toRgb(keys[1]));
            var fpx = parseFloat((/([\d.]+)px/.exec(this.font) || [0, 12])[1]);
            var scale = (cv.clientWidth || cv.width) / (cv.width || 1);
            var cssPx = fpx * Math.abs(tr.a) * scale, bold = /bold|[6-9]00/.test(this.font);
            var need = (cssPx >= 24 || (cssPx >= 18.66 && bold)) ? 3 : 4.5;
            var fixed = fixColor(fg.slice(0, 3), fg[3] * this.globalAlpha, bgs, need);
            if (fixed) {
              saved = [fs, this.globalAlpha]; swapped = true;
              this.fillStyle = fixed;
              if (this.globalAlpha < 0.85) this.globalAlpha = 1;
            }
          }
        }
      } catch (e) { /* never break a page's drawing */ }
      var out = origFill.apply(this, arguments);
      if (swapped) { this.fillStyle = saved[0]; this.globalAlpha = saved[1]; }
      return out;
    };

    /* ---------- 9. Visible lines and shapes in canvas diagrams (WCAG 1.4.11) ----------
     * Lines (1.5 px and wider) and solid shapes need 3:1 contrast against what is
     * next to them. Before each line is stroked, the pixels under it are sampled; if
     * the line would fall below 3:1 its colour is shifted lighter or darker (same hue).
     * When a solid shape's fill is below 3:1 against its surroundings, a 1 px outline
     * in a contrasting shade of the same hue is drawn around it. Thin grid lines,
     * translucent overlays, tiny texture specks and canvases marked
     * data-a11y-essential (simulated micrographs, whose look is the content) are left alone.
     */
    var P2 = C2D.prototype;
    var pathPts = new WeakMap();
    function devPt(ctx, x, y) { var t = ctx.getTransform(); return [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f]; }
    function addPt(ctx, x, y) { var a = pathPts.get(ctx); if (!a) { a = []; pathPts.set(ctx, a); } if (a.length < 240) a.push(devPt(ctx, x, y)); }
    function hook(name, fn) {
      var orig = P2[name]; if (!orig) return;
      P2[name] = function () { try { fn(this, arguments); } catch (e) {} return orig.apply(this, arguments); };
    }
    hook('beginPath', function (c) { pathPts.set(c, []); });
    hook('moveTo', function (c, a) { addPt(c, a[0], a[1]); });
    hook('lineTo', function (c, a) { addPt(c, a[0], a[1]); });
    hook('quadraticCurveTo', function (c, a) { addPt(c, a[2], a[3]); });
    hook('bezierCurveTo', function (c, a) { addPt(c, a[4], a[5]); });
    hook('arc', function (c, a) { for (var k = 0; k < 8; k++) { var t = a[3] + (a[4] - a[3]) * k / 7; addPt(c, a[0] + a[2] * Math.cos(t), a[1] + a[2] * Math.sin(t)); } });
    hook('ellipse', function (c, a) { for (var k = 0; k < 8; k++) { var t = k * Math.PI / 4; addPt(c, a[0] + a[2] * Math.cos(t), a[1] + a[3] * Math.sin(t)); } });
    hook('rect', function (c, a) { addPt(c, a[0], a[1]); addPt(c, a[0] + a[2], a[1]); addPt(c, a[0] + a[2], a[1] + a[3]); addPt(c, a[0], a[1] + a[3]); addPt(c, a[0], a[1]); });
    hook('roundRect', function (c, a) { addPt(c, a[0], a[1]); addPt(c, a[0] + a[2], a[1]); addPt(c, a[0] + a[2], a[1] + a[3]); addPt(c, a[0], a[1] + a[3]); addPt(c, a[0], a[1]); });

    function essential(cv) { return !!(cv.closest && cv.closest('[data-a11y-essential]')) || cv.hasAttribute('data-a11y-essential'); }
    function pixelMode(ctx, pts) {
      var cv = ctx.canvas, page = cssBg(cv), hist = {}, best = 0, bk = null, n = 0;
      var step = Math.max(1, Math.floor(pts.length / 10));
      for (var i = 0; i < pts.length; i += step) {
        var x = Math.round(pts[i][0]), y = Math.round(pts[i][1]);
        if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) continue;
        var d = ctx.getImageData(x, y, 1, 1).data, al = d[3] / 255;
        var r = d[0] * al + page[0] * (1 - al), g = d[1] * al + page[1] * (1 - al), b = d[2] * al + page[2] * (1 - al);
        var k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        hist[k] = (hist[k] || 0) + 1; n++;
        if (hist[k] > best) { best = hist[k]; bk = k; }
      }
      return n ? [((bk >> 10) & 31) * 8 + 4, ((bk >> 5) & 31) * 8 + 4, (bk & 31) * 8 + 4] : null;
    }
    var shapeCache = new Map();
    function shapeColor(fg, alpha, bg) {
      var key = fg.join() + '|' + alpha + '|' + bg.join();
      if (shapeCache.has(key)) return shapeCache.get(key);
      var mix = [fg[0] * alpha + bg[0] * (1 - alpha), fg[1] * alpha + bg[1] * (1 - alpha), fg[2] * alpha + bg[2] * (1 - alpha)];
      var res = null;
      if (ratio(mix, bg) < 3) res = search(fg, 1, [bg], 2.75) || (lum(bg) < 0.18 ? '#ffffff' : '#000000');  // search adds 0.3 → ≥ 3.05
      if (shapeCache.size > 2000) shapeCache.clear();
      shapeCache.set(key, res);
      return res;
    }
    function scaleOf(ctx) { var cv = ctx.canvas; return Math.abs(ctx.getTransform().a) * ((cv.clientWidth || cv.width) / (cv.width || 1)); }

    // Colour of the pixel at (x, y), with transparent areas showing the page behind the canvas.
    function pixelAt(ctx, x, y, page) {
      var cv = ctx.canvas; x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return null;
      var d = ctx.getImageData(x, y, 1, 1).data, al = d[3] / 255;
      return [d[0] * al + page[0] * (1 - al), d[1] * al + page[1] * (1 - al), d[2] * al + page[2] * (1 - al)];
    }
    var lineCache = new Map();
    // Fraction of sample points where the line reaches 3:1 against at least one of its two sides.
    function lineScore(col, a, sides) {
      var good = 0;
      sides.forEach(function (sd) {
        var best = 0;
        sd.forEach(function (bg) { if (!bg) return; var m = [col[0] * a + bg[0] * (1 - a), col[1] * a + bg[1] * (1 - a), col[2] * a + bg[2] * (1 - a)]; best = Math.max(best, ratio(m, bg)); });
        if (best >= 3.05) good++;
      });
      return good / sides.length;
    }
    function lineSides(ctx, pts) {
      var page = cssBg(ctx.canvas), off = ctx.lineWidth * Math.abs(ctx.getTransform().a) / 2 + 2, out = [];
      var step = Math.max(1, Math.floor((pts.length - 1) / 8));
      for (var i = 0; i + 1 < pts.length; i += step) {
        var p0 = pts[i], p1 = pts[i + 1], dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.5) continue;
        var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, nx = -dy / len * off, ny = dx / len * off;
        var s1 = pixelAt(ctx, mx + nx, my + ny, page), s2 = pixelAt(ctx, mx - nx, my - ny, page);
        if (s1 || s2) out.push([s1, s2]);
      }
      return out;
    }
    function lineFix(col, a, sides) {
      var key = col.join() + '|' + a + '|' + sides.map(function (sd) { return sd.map(function (b) { return b ? b.map(function (v) { return v >> 3; }).join('.') : '-'; }).join('/'); }).join(';');
      if (lineCache.has(key)) return lineCache.get(key);
      var res = null;
      if (lineScore(col, a, sides) < 0.5) {
        var hsl = rgb2hsl(col), best = 0, bestC = null;
        for (var step = 1; step <= 100 && best < 0.8; step++) {
          for (var sg = -1; sg <= 1; sg += 2) {
            var l = hsl[2] + sg * step / 100; if (l < 0 || l > 1) continue;
            var c = hsl2rgb(hsl[0], hsl[1], l), sc = lineScore(c, 1, sides);
            if (sc > best) { best = sc; bestC = c; }
            if (sc >= 0.8) break;
          }
        }
        if (bestC && best >= 0.5) res = 'rgb(' + bestC.map(Math.round).join(',') + ')';
      }
      if (lineCache.size > 2000) lineCache.clear();
      lineCache.set(key, res);
      return res;
    }
    var origStroke = P2.stroke;
    P2.stroke = function () {
      var swapped = null;
      try {
        var cv = this.canvas, ss = this.strokeStyle, c = typeof ss === 'string' ? parse(ss) : null, pts = pathPts.get(this);
        if (c && pts && pts.length > 1 && !essential(cv) && arguments.length === 0) {
          var a = c[3] * this.globalAlpha, w = this.lineWidth * scaleOf(this);
          if (w >= 1.5 && a >= 0.5) {
            // Both sides of the line are checked; an outline only needs to stand out from one side.
            var sides = lineSides(this, pts);
            var fix = sides.length && lineFix(c.slice(0, 3), a, sides);
            if (fix) { swapped = [ss, this.globalAlpha]; this.strokeStyle = fix; this.globalAlpha = 1; }
          }
        }
      } catch (e) {}
      var out = origStroke.apply(this, arguments);
      if (swapped) { this.strokeStyle = swapped[0]; this.globalAlpha = swapped[1]; }
      return out;
    };
    var origStrokeRect = P2.strokeRect;
    P2.strokeRect = function (x, y, w, h) {
      var swapped = null;
      try {
        var cv = this.canvas, ss = this.strokeStyle, c = typeof ss === 'string' ? parse(ss) : null;
        if (c && !essential(cv)) {
          var a = c[3] * this.globalAlpha, lw = this.lineWidth * scaleOf(this);
          if (lw >= 1.5 && a >= 0.5) {
            var pts = [devPt(this, x, y), devPt(this, x + w, y), devPt(this, x + w, y + h), devPt(this, x, y + h), devPt(this, x, y)];
            var sides = lineSides(this, pts), fix = sides.length && lineFix(c.slice(0, 3), a, sides);
            if (fix) { swapped = [ss, this.globalAlpha]; this.strokeStyle = fix; this.globalAlpha = 1; }
          }
        }
      } catch (e) {}
      var out = origStrokeRect.apply(this, arguments);
      if (swapped) { this.strokeStyle = swapped[0]; this.globalAlpha = swapped[1]; }
      return out;
    };
    function outlineIfNeeded(ctx, box, drawOutline) {
      var cv = ctx.canvas; if (essential(cv)) return;
      var fs = ctx.fillStyle, c = typeof fs === 'string' ? parse(fs) : null; if (!c) return;
      var a = c[3] * ctx.globalAlpha; if (a < 0.6) return;
      var w = box[2] - box[0], h = box[3] - box[1];
      if (w * h < 150 || w * h > 0.5 * cv.width * cv.height || w < 4 || h < 4) return;
      var o = 2, pts = [[box[0] - o, (box[1] + box[3]) / 2], [box[2] + o, (box[1] + box[3]) / 2], [(box[0] + box[2]) / 2, box[1] - o], [(box[0] + box[2]) / 2, box[3] + o],
        [box[0] - o, box[1] - o], [box[2] + o, box[1] - o], [box[0] - o, box[3] + o], [box[2] + o, box[3] + o]];
      var bg = pixelMode(ctx, pts); if (!bg) return;
      var fix = shapeColor(c.slice(0, 3), a, bg);
      if (fix) drawOutline(fix);
    }
    var origShapeFill = P2.fill;
    P2.fill = function () {
      var pts = pathPts.get(this), box = null, self = this;
      try {
        if (pts && pts.length > 2 && arguments.length === 0) {
          box = [1e9, 1e9, -1e9, -1e9];
          pts.forEach(function (p) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); });
        }
      } catch (e) {}
      var pre = null;
      if (box) { try { outlineIfNeeded(this, box, function (col) { pre = col; }); } catch (e) {} }
      var out = origShapeFill.apply(this, arguments);
      if (pre) {
        try { self.save(); self.strokeStyle = pre; self.globalAlpha = 1; self.setLineDash([]);
          self.lineWidth = 1 / (scaleOf(self) || 1); origStroke.call(self); self.restore(); } catch (e) {}
      }
      return out;
    };
    var origFillRect = P2.fillRect;
    P2.fillRect = function (x, y, w, h) {
      var pre = null, self = this, p1, p2;
      try {
        p1 = devPt(this, x, y); p2 = devPt(this, x + w, y + h);
        outlineIfNeeded(this, [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])], function (col) { pre = col; });
      } catch (e) {}
      var out = origFillRect.apply(this, arguments);
      if (pre) {
        try { self.save(); self.strokeStyle = pre; self.globalAlpha = 1; self.setLineDash([]); self.lineWidth = 1 / (scaleOf(self) || 1);
          origStrokeRect.call(self, x, y, w, h); self.restore(); } catch (e) {}
      }
      return out;
    };

    /* Form controls: an author-styled border must reach 3:1 against the page so the
       control's edge is visible (WCAG 1.4.11). Only failing borders are changed. */
    function fixControlBorders() {
      document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea').forEach(function (e) {
        var cs = getComputedStyle(e);
        if (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) return;
        var b = parse(cs.borderTopColor), bg = cssBg(e.parentElement), own = parse(cs.backgroundColor);
        if (!b) return;
        if (own && own[3] > 0.5 && ratio(own.slice(0, 3), bg) >= 3) return;
        var mix = [b[0] * b[3] + bg[0] * (1 - b[3]), b[1] * b[3] + bg[1] * (1 - b[3]), b[2] * b[3] + bg[2] * (1 - b[3])];
        if (ratio(mix, bg) >= 3) return;
        var fix = search(b.slice(0, 3), 1, [bg], 2.75);
        if (fix) e.style.borderColor = fix;
      });
    }
    if (document.readyState === 'loading') origAdd.call(document, 'DOMContentLoaded', fixControlBorders); else fixControlBorders();
  })();

  /* ---------- wiring ---------- */
  origAdd.call(document, 'click', function (e) { arm(e.target.closest ? (e.target.closest('button, a, [role="button"], tr[tabindex], input, select') || e.target) : null); }, true);
  origAdd.call(document, 'change', function (e) { arm(e.target); if (e.target.type === 'range') syncRange(e.target); }, true);
  origAdd.call(document, 'input', function (e) {
    if (e.target.type === 'range') { arm(e.target); setTimeout(function () { syncRange(e.target); }, 0); }
    else if (e.target.matches && e.target.matches('input, textarea')) arm(e.target);
  }, true);

  function init() {
    ensureMainAndSkip();
    scanOnclickAttributes();
    flushOperable();
    document.querySelectorAll('canvas').forEach(labelCanvas);
    document.querySelectorAll('th:not([scope])').forEach(scopeTh);
    document.querySelectorAll('input[type="range"]').forEach(syncRange);
    relabelAll();
    syncAllGroups();
    registerPanels();
    linkHints();
    ensureLive();
    new MutationObserver(onMutations).observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden']
    });
    setTimeout(function () { recheckOperable(); syncAllGroups(); relabelAll(); }, 600);
  }
  if (document.readyState === 'loading') origAdd.call(document, 'DOMContentLoaded', init);
  else init();
  origAdd.call(window, 'load', function () { recheckOperable(); syncAllGroups(); document.querySelectorAll('input[type="range"]').forEach(syncRange); });
})();
