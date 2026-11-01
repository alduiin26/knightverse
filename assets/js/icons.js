/*!
 * KnightVerse icon set: the Lucide icons this site uses (lucide v1.66.0, https://lucide.dev).
 * Lucide is ISC licensed: Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022
 * as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors.
 *
 * Works like the Lucide browser build: <i data-lucide="flame" class="w-4 h-4"></i> becomes an
 * inline SVG when lucide.createIcons() runs. Served from this site, so no outside script runs on
 * our pages. To add an icon, copy its nodes from lucide.dev into ICONS (key = PascalCase name).
 */
(function () {
  'use strict';
  var ICONS = {
    ArrowLeft: [['path', { d: 'm12 19-7-7 7-7' }], ['path', { d: 'M19 12H5' }]],
    BadgeCheck: [['path', { d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z' }], ['path', { d: 'm16 9-5.5 5.5L8 12' }]],
    BatteryCharging: [['path', { d: 'm11 7-3 5h4l-3 5' }], ['path', { d: 'M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935' }], ['path', { d: 'M22 14v-4' }], ['path', { d: 'M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936' }]],
    Box: [['path', { d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z' }], ['path', { d: 'm3.3 7 8.7 5 8.7-5' }], ['path', { d: 'M12 22V12' }]],
    ChevronLeft: [['path', { d: 'm15 18-6-6 6-6' }]],
    ChevronRight: [['path', { d: 'm9 18 6-6-6-6' }]],
    Clock: [['circle', { cx: '12', cy: '12', r: '10' }], ['path', { d: 'M12 6v6l4 2' }]],
    Cpu: [['path', { d: 'M12 20v2' }], ['path', { d: 'M12 2v2' }], ['path', { d: 'M17 20v2' }], ['path', { d: 'M17 2v2' }], ['path', { d: 'M2 12h2' }], ['path', { d: 'M2 17h2' }], ['path', { d: 'M2 7h2' }], ['path', { d: 'M20 12h2' }], ['path', { d: 'M20 17h2' }], ['path', { d: 'M20 7h2' }], ['path', { d: 'M7 20v2' }], ['path', { d: 'M7 2v2' }], ['rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }], ['rect', { x: '8', y: '8', width: '8', height: '8', rx: '1' }]],
    CreditCard: [['rect', { width: '20', height: '14', x: '2', y: '5', rx: '2' }], ['line', { x1: '2', x2: '22', y1: '10', y2: '10' }], ['path', { d: 'M6 14h2' }]],
    Film: [['rect', { width: '18', height: '18', x: '3', y: '3', rx: '2' }], ['path', { d: 'M7 3v18' }], ['path', { d: 'M3 7.5h4' }], ['path', { d: 'M3 12h18' }], ['path', { d: 'M3 16.5h4' }], ['path', { d: 'M17 3v18' }], ['path', { d: 'M17 7.5h4' }], ['path', { d: 'M17 16.5h4' }]],
    Flame: [['path', { d: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4' }]],
    Gamepad2: [['line', { x1: '6', x2: '10', y1: '11', y2: '11' }], ['line', { x1: '8', x2: '8', y1: '9', y2: '13' }], ['line', { x1: '15', x2: '15.01', y1: '12', y2: '12' }], ['line', { x1: '18', x2: '18.01', y1: '10', y2: '10' }], ['path', { d: 'M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z' }]],
    Layers: [['path', { d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z' }], ['path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' }], ['path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' }]],
    Lock: [['rect', { width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
    PenTool: [['path', { d: 'm18 13-.654-4.736a4 4 0 00-2.756-3.266l-9.163-2.9a2 2 0 00-2.017.493l-.82.819a2 2 0 00-.492 2.017l2.9 9.163a4 4 0 003.266 2.756L13 18' }], ['path', { d: 'M18.648 12.352a1.205 1.205 0 011.704 0l1.296 1.296a1.205 1.205 0 010 1.704l-6.296 6.296a1.205 1.205 0 01-1.704 0l-1.296-1.296a1.205 1.205 0 010-1.704z' }], ['path', { d: 'm3 3 6.586 6.586' }], ['circle', { cx: '11', cy: '11', r: '2' }]],
    Play: [['path', { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }]],
    RefreshCw: [['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }], ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }], ['path', { d: 'M8 16H3v5' }]],
    Repeat: [['path', { d: 'm17 2 4 4-4 4' }], ['path', { d: 'M3 11v-1a4 4 0 0 1 4-4h14' }], ['path', { d: 'm7 22-4-4 4-4' }], ['path', { d: 'M21 13v1a4 4 0 0 1-4 4H3' }]],
    ScrollText: [['path', { d: 'M15 12h-5' }], ['path', { d: 'M15 8h-5' }], ['path', { d: 'M19 17V5a2 2 0 0 0-2-2H4' }], ['path', { d: 'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3' }]],
    Shield: [['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }]],
    ShieldAlert: [['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }], ['path', { d: 'M12 8v4' }], ['path', { d: 'M12 16h.01' }]],
    ShieldCheck: [['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }], ['path', { d: 'm9 12 2 2 4-4' }]],
    Smartphone: [['rect', { width: '14', height: '20', x: '5', y: '2', rx: '2', ry: '2' }], ['path', { d: 'M12 18h.01' }]],
    Sparkles: [['path', { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' }], ['path', { d: 'M20 2v4' }], ['path', { d: 'M22 4h-4' }], ['circle', { cx: '4', cy: '20', r: '2' }]],
    TrendingUp: [['path', { d: 'M16 7h6v6' }], ['path', { d: 'm22 7-8.5 8.5-5-5L2 17' }]],
    Trophy: [['path', { d: 'M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2' }], ['path', { d: 'M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2' }], ['path', { d: 'M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3' }], ['path', { d: 'M4 22h16' }], ['path', { d: 'M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z' }], ['path', { d: 'M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3' }]],
    Volume2: [['path', { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' }], ['path', { d: 'M16 9a5 5 0 0 1 0 6' }], ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }]],
    VolumeX: [['path', { d: 'M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z' }], ['path', { d: 'm16.5 14.5 5-5' }], ['path', { d: 'm16.5 9.5 5 5' }]],
    Wallet: [['path', { d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1' }], ['path', { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' }]],
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEFAULTS = { xmlns: SVG_NS, width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

  // "gamepad-2" -> "Gamepad2", "arrow-left" -> "ArrowLeft"
  function pascal(name) {
    var out = '', up = true;
    for (var i = 0; i < name.length; i++) {
      var ch = name[i];
      if (ch === '-' || ch === '_' || ch <= ' ') { up = out.length > 0; continue; }
      out += up ? ch.toUpperCase() : ch; up = false;
    }
    return out;
  }

  function build(tag, attrs, children) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) el.setAttribute(k, String(attrs[k]));
    (children || []).forEach(function (c) { el.appendChild(build(c[0], c[1])); });
    return el;
  }

  function replace(el, nameAttr) {
    var name = el.getAttribute(nameAttr);
    if (name == null) return;
    var nodes = ICONS[pascal(name)];
    if (!nodes) { console.warn('[icons] "' + name + '" is not in assets/js/icons.js'); return; }
    var own = {}, labelled = false;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i]; own[a.name] = a.value;
      if (a.name.indexOf('aria-') === 0 || a.name === 'role' || a.name === 'title') labelled = true;
    }
    var attrs = {}, k;
    for (k in DEFAULTS) attrs[k] = DEFAULTS[k];
    attrs['data-lucide'] = name;
    if (!labelled) attrs['aria-hidden'] = 'true';
    for (k in own) attrs[k] = own[k];
    var classes = ['lucide', 'lucide-' + name].concat((own['class'] || '').split(' '));
    attrs['class'] = classes.filter(function (c, i, all) { return c && c.trim() !== '' && all.indexOf(c) === i; }).join(' ');
    if (el.parentNode) el.parentNode.replaceChild(build('svg', attrs, nodes), el);
  }

  function createIcons(opts) {
    opts = opts || {};
    var nameAttr = opts.nameAttr || 'data-lucide';
    var root = opts.root || document;
    Array.prototype.slice.call(root.querySelectorAll('[' + nameAttr + ']')).forEach(function (el) { replace(el, nameAttr); });
  }

  window.lucide = { createIcons: createIcons, icons: ICONS };
})();
