const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FREE_COUNT = 100;
const FREE_TPLS = 3;
const STORE_BILLING = 'https://store.microsoft.com/billing';
const PRO_SKU = 'ticketpress_pro';
const PRO_IDS = [PRO_SKU];
let STORE_URL = 'https://apps.microsoft.com/detail/9PDLS6TMKHHQ';
let proAvailable = false; // Pro limits apply only when the Store actually sells the add-on
let proSku = PRO_SKU;
let isPro = false;
try { isPro = localStorage.getItem('ticketpress-pro') === '1'; } catch (_) {}
const unlocked = () => isPro || !proAvailable;

async function billing() {
  if (!('getDigitalGoodsService' in window)) return null;
  try { return await window.getDigitalGoodsService(STORE_BILLING); } catch (_) { return null; }
}
function setPro(v) {
  isPro = v;
  try { localStorage.setItem('ticketpress-pro', v ? '1' : '0'); } catch (_) {}
  const b = $('proBtn');
  b.textContent = v ? '★ Pro' : '★ Get Pro';
  b.classList.toggle('is-pro', v);
  b.hidden = !proAvailable && !v;
  document.body.classList.toggle('unlocked', unlocked());
  if (typeof renderAll === 'function') renderAll();
}
async function checkPro() {
  const svc = await billing();
  if (!svc) return false;
  try {
    const details = await svc.getDetails(PRO_IDS).catch(() => []);
    proAvailable = details.length > 0;
    if (details[0]) { proSku = details[0].itemId; if (!PRO_IDS.includes(proSku)) PRO_IDS.push(proSku); }
    const list = await svc.listPurchases();
    const owned = list.some((p) => PRO_IDS.includes(p.itemId));
    setPro(owned);
    return owned;
  } catch (_) { return isPro; }
}
function proMessage(text) { const m = $('proMsg'); m.hidden = !text; m.textContent = text || ''; }
async function openPro(reason) {
  proMessage(reason || '');
  const svc = await billing();
  if (!svc) {
    $('buyBtn').textContent = 'Get TicketPress on Microsoft Store';
    $('restoreBtn').hidden = true;
  } else {
    $('restoreBtn').hidden = false;
    try {
      const [d] = await svc.getDetails([proSku]);
      const price = d && d.price ? new Intl.NumberFormat(undefined, { style: 'currency', currency: d.price.currency }).format(Number(d.price.value)) : '';
      $('buyBtn').textContent = price ? `Unlock Pro – ${price}` : 'Unlock Pro';
    } catch (_) { $('buyBtn').textContent = 'Unlock Pro'; }
  }
  if (!$('proDialog').open) $('proDialog').showModal();
}
async function buyPro() {
  const svc = await billing();
  if (!svc) { window.open(STORE_URL, '_blank'); return; }
  const methods = [{ supportedMethods: STORE_BILLING, data: { sku: proSku } }];
  try {
    let req;
    try { req = new PaymentRequest(methods); }
    catch (_) { req = new PaymentRequest(methods, { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }); }
    const res = await req.show();
    await res.complete('success');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    proMessage('Purchase could not be completed: ' + (e.message || e));
    return;
  }
  if (await checkPro()) { proMessage('Thank you! Pro is unlocked. ★'); setTimeout(() => $('proDialog').close(), 1500); }
}
function needsPro(reason) {
  if (unlocked()) return false;
  openPro(reason);
  return true;
}


// ---------- options ----------
const PAPERS = { letter: { name: 'US Letter (8.5 × 11 in)', w: 215.9, h: 279.4 }, a4: { name: 'A4 (210 × 297 mm)', w: 210, h: 297 } };
const LAYOUTS = { 8: { cols: 2, rows: 4, name: '8 large tickets' }, 10: { cols: 2, rows: 5, name: '10 tickets' }, 16: { cols: 2, rows: 8, name: '16 small tickets' } };
const TPLS = [{ id: 'classic', name: 'Classic' }, { id: 'band', name: 'Colour band' }, { id: 'bold', name: 'Bold' }, { id: 'confetti', name: 'Confetti' }, { id: 'elegant', name: 'Elegant' }, { id: 'stripes', name: 'Stripes' }, { id: 'stars', name: 'Stars' }, { id: 'simple', name: 'Simple' }];
const COLORS = ['#b91c1c', '#1e3a8a', '#14532d', '#6b21a8', '#9a6a00', '#0f766e', '#be185d', '#1f2937'];
const FONTS = { modern: '"Segoe UI", Arial, sans-serif', classic: 'Georgia, "Times New Roman", serif' };
const tplIndex = (id) => Math.max(0, TPLS.findIndex((t) => t.id === id));
const tplLocked = (id) => !unlocked() && tplIndex(id) >= FREE_TPLS;

// ---------- state ----------
let st = { kind: 'raffle', paper: 'letter', per: 10, tpl: 'classic', color: COLORS[0], font: 'modern', title: 'Spring Raffle', org: 'Maple Street School PTA', date: 'Saturday, May 16, 2026', time: '2:00 PM', place: 'School Gym, 128 Maple Street', price: '$2', extra: 'Grand prize: a weekend getaway for two', start: 1, count: 50, prefix: 'No.', stubLines: 'Name\nPhone', logo: '' };
try { Object.assign(st, JSON.parse(localStorage.getItem('ticketpress') || '{}')); } catch (_) {}
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('ticketpress', JSON.stringify(st)); } catch (_) { toast('Could not save – the logo picture may be too large'); } }, 250); }
const int = (v, lo, hi, d) => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return isFinite(n) && n >= lo && n <= hi ? n : d; };
const startNo = () => int(st.start, 0, 999999, 1);
const countNo = () => int(st.count, 1, 5000, 1);
function numText(n) { const last = startNo() + countNo() - 1, d = Math.max(3, String(last).length); return `${String(st.prefix || '').trim()} ${String(n).padStart(d, '0')}`.trim(); }

// ---------- text measuring ----------
let mctx = null;
function textW(s, fs, family, weight) {
  if (typeof document !== 'undefined') { try { if (!mctx) mctx = document.createElement('canvas').getContext('2d'); mctx.font = `${weight || 400} 100px ${family}`; return mctx.measureText(s).width * fs / 100; } catch (_) {} }
  return String(s).length * fs * (weight >= 700 ? 0.6 : 0.52);
}
const fit = (s, fs, maxW, fam, wt) => { const w = textW(s, fs, fam, wt); return w > maxW ? fs * maxW / w : fs; };

// ---------- one ticket ----------
const f2 = (n) => n.toFixed(2);
function decor(tpl, x, y, w, h, c) { // decoration of the main part; returns svg and whether text is white
  const gold = '#c9992e';
  if (tpl === 'band') return { s: `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h * 0.46)}" fill="${c}"/><rect x="${f2(x)}" y="${f2(y + h * 0.46)}" width="${f2(w)}" height="${f2(h * 0.025)}" fill="${gold}"/>`, band: h * 0.46 };
  if (tpl === 'bold') return { s: `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="${c}"/><rect x="${f2(x + 2)}" y="${f2(y + 2)}" width="${f2(w - 4)}" height="${f2(h - 4)}" fill="none" stroke="#fff" stroke-width=".35" opacity=".7"/>`, white: true };
  if (tpl === 'confetti') { let s = '', k = 0; const cols = [c, '#f59e0b', '#10b981', '#3b82f6', '#ef4444']; for (let i = 0; i < 26; i++) { const px = x + ((i * 37) % 100) / 100 * w, py = y + ((i * 61 + 13) % 100) / 100 * h; if (px > x + w * 0.12 && px < x + w * 0.88 && py > y + h * 0.18 && py < y + h * 0.82) continue; s += `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(0.7 + (i % 3) * 0.35)}" fill="${cols[k++ % 5]}"/>`; } return { s: s + `<rect x="${f2(x + 1)}" y="${f2(y + 1)}" width="${f2(w - 2)}" height="${f2(h - 2)}" fill="none" stroke="${c}" stroke-width=".6" rx="2"/>` }; }
  if (tpl === 'elegant') { let s = `<rect x="${f2(x + 1.5)}" y="${f2(y + 1.5)}" width="${f2(w - 3)}" height="${f2(h - 3)}" fill="none" stroke="${c}" stroke-width=".8"/><rect x="${f2(x + 3)}" y="${f2(y + 3)}" width="${f2(w - 6)}" height="${f2(h - 6)}" fill="none" stroke="${gold}" stroke-width=".3"/>`; [[x + 1.5, y + 1.5], [x + w - 1.5, y + 1.5], [x + 1.5, y + h - 1.5], [x + w - 1.5, y + h - 1.5]].forEach(([a, b]) => { s += `<circle cx="${f2(a)}" cy="${f2(b)}" r="1.3" fill="${gold}"/>`; }); return { s }; }
  if (tpl === 'stripes') { let s = `<clipPath id="cp${Math.round(x * 10)}_${Math.round(y * 10)}"><rect x="${f2(x + w * 0.78)}" y="${f2(y)}" width="${f2(w * 0.22)}" height="${f2(h)}"/></clipPath><g clip-path="url(#cp${Math.round(x * 10)}_${Math.round(y * 10)})" opacity=".18">`; for (let i = -h; i < w * 0.3; i += 4) s += `<rect x="${f2(x + w * 0.78 + i)}" y="${f2(y - 5)}" width="1.8" height="${f2(h * 2)}" fill="${c}" transform="rotate(30 ${f2(x + w * 0.78 + i)} ${f2(y)})"/>`; return { s: s + `</g><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="none" stroke="${c}" stroke-width=".6"/>` }; }
  if (tpl === 'stars') { let s = ''; const star = (cx, cy, r) => { let p = ''; for (let k = 0; k < 10; k++) { const a = Math.PI * k / 5 - Math.PI / 2, rr = k % 2 ? r * 0.42 : r; p += `${k ? 'L' : 'M'}${f2(cx + rr * Math.cos(a))},${f2(cy + rr * Math.sin(a))}`; } return `<path d="${p}Z" fill="${gold}"/>`; }; s += star(x + 4, y + 4, 2) + star(x + w - 4, y + h - 4, 2) + star(x + w - 4, y + 4, 1.4) + star(x + 4, y + h - 4, 1.4); return { s: s + `<rect x="${f2(x + 1)}" y="${f2(y + 1)}" width="${f2(w - 2)}" height="${f2(h - 2)}" fill="none" stroke="${c}" stroke-width=".9" stroke-dasharray="2 1"/>` }; }
  if (tpl === 'simple') return { s: `<rect x="${f2(x + 3)}" y="${f2(y + h - 3)}" width="${f2(w - 6)}" height=".6" fill="${c}"/>` };
  return { s: `<rect x="${f2(x + 1.2)}" y="${f2(y + 1.2)}" width="${f2(w - 2.4)}" height="${f2(h - 2.4)}" fill="none" stroke="${c}" stroke-width="1"/><rect x="${f2(x + 2.6)}" y="${f2(y + 2.6)}" width="${f2(w - 5.2)}" height="${f2(h - 5.2)}" fill="none" stroke="${c}" stroke-width=".25"/>` };
}
function ticket(x, y, w, h, n) {
  const F = FONTS[st.font] || FONTS.modern, c = st.color || COLORS[0], k = Math.max(0.75, Math.min(1.15, h / 52));
  const sw = w * 0.29, mx = x + sw, mw = w - sw, pad = 4 * Math.max(0.8, k);
  const T = (t, tx, ty, fs, extra, anchor) => t ? `<text x="${f2(tx)}" y="${f2(ty)}" font-size="${f2(fs)}" text-anchor="${anchor || 'start'}"${extra || ''}>${esc(t)}</text>` : '';
  let s = `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="#fff" stroke="#9aa0a6" stroke-width=".2" stroke-dasharray="1.2 1"/>`;
  // stub
  const num = numText(n), nfs = fit(num, 4.4 * k, sw - 5, F, 700);
  s += T(num, x + sw / 2, y + 7.5 * k, nfs, ` font-weight="700" fill="${c}"`, 'middle');
  if (st.kind === 'raffle') {
    const lines = String(st.stubLines || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 4), room = h - 12 * k, step = Math.min(10 * k, room / Math.max(1, lines.length));
    lines.forEach((l, i) => { const ly = y + 12 * k + step * (i + 1) - 1.5; s += `<rect x="${f2(x + 2.5)}" y="${f2(ly)}" width="${f2(sw - 5)}" height=".25" fill="#555"/>` + T(l, x + 2.5, ly - 1, Math.min(2.6 * k, 2.6), ' fill="#666"'); });
  } else {
    s += T('ADMIT ONE', x + sw / 2, y + h * 0.48, fit('ADMIT ONE', 3.6 * k, sw - 5, F, 700), ' font-weight="700"', 'middle');
    s += T(st.title, x + sw / 2, y + h * 0.66, fit(st.title || '', 2.6 * k, sw - 5, F), ' fill="#444"', 'middle');
    s += T(st.date, x + sw / 2, y + h * 0.78, fit(st.date || '', 2.4 * k, sw - 5, F), ' fill="#666"', 'middle');
  }
  s += `<line x1="${f2(mx)}" y1="${f2(y)}" x2="${f2(mx)}" y2="${f2(y + h)}" stroke="#666" stroke-width=".3" stroke-dasharray="1.2 1"/>`;
  // main part
  const d = decor(st.tpl, mx, y, mw, h, c), white = d.white, ink = white ? '#fff' : '#111', head = white ? '#fff' : c;
  s += d.s;
  const lx = mx + pad, rw = mw - 2 * pad;
  let tx0 = lx, tw = rw;
  if (st.logo) { const ls = Math.min(h * 0.32, 16); s += `<image href="${st.logo}" x="${f2(mx + mw - pad - ls)}" y="${f2(y + h - pad - ls - (st.price ? 7 * k : 0))}" width="${f2(ls)}" height="${f2(ls)}" preserveAspectRatio="xMidYMid meet"/>`; }
  const bandInk = d.band ? '#fff' : head, bandSub = d.band ? '#fff' : (white ? '#fff' : '#555');
  s += T(st.org, tx0, y + 6.5 * k, fit(st.org || '', 2.8 * k, tw * 0.62, F), ` fill="${bandSub}"`);
  s += T(num, mx + mw - pad, y + 6.5 * k, fit(num, 3.4 * k, tw * 0.36, F, 700), ` font-weight="700" fill="${bandInk}"`, 'end');
  const tfs = fit(st.title || '', 7.5 * k, tw, F, 700);
  s += T(st.title, tx0, y + (d.band ? h * 0.36 : h * 0.36), tfs, ` font-weight="700" fill="${bandInk}"`);
  const when = [st.date, st.time].filter((v) => String(v || '').trim()).join('  •  ');
  s += T(when, tx0, y + h * 0.6, fit(when, 3.6 * k, tw, F, 600), ` font-weight="600" fill="${ink}"`);
  s += T(st.place, tx0, y + h * 0.72, fit(st.place || '', 3.1 * k, tw, F), ` fill="${ink}"`);
  const pw = st.price ? textW(st.price, 5.4 * k, F, 700) + 3 : 0;
  s += T(st.extra, tx0, y + h * 0.86, fit(st.extra || '', 2.9 * k, tw - pw, F), ` font-style="italic" fill="${ink}"`);
  s += T(st.price, mx + mw - pad, y + h - pad * 0.8, fit(st.price || '', 5.4 * k, tw * 0.4, F, 700), ` font-weight="700" fill="${head}"`, 'end');
  return s;
}

// ---------- pages ----------
function pages(screen) {
  const P = PAPERS[st.paper] || PAPERS.letter, L = LAYOUTS[st.per] || LAYOUTS[10], m = 8;
  const tw = (P.w - 2 * m) / L.cols, th = (P.h - 2 * m) / L.rows, per = L.cols * L.rows;
  const n0 = startNo(), total = screen ? Math.min(countNo(), per * 60) : countNo(), out = [];
  for (let p = 0; p * per < total; p++) {
    let s = '';
    for (let i = 0; i < per && p * per + i < total; i++) s += ticket(m + (i % L.cols) * tw, m + Math.floor(i / L.cols) * th, tw, th, n0 + p * per + i);
    out.push({ w: P.w, h: P.h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.w} ${P.h}" width="${P.w}mm" height="${P.h}mm" font-family='${FONTS[st.font] || FONTS.modern}' fill="#111"><rect width="${P.w}" height="${P.h}" fill="#fff"/>${s}</svg>` });
  }
  return out;
}
function limitReason() {
  if (unlocked()) return '';
  if (tplLocked(st.tpl)) return `The "${TPLS[tplIndex(st.tpl)].name}" design is part of Pro. The first ${FREE_TPLS} designs are free.`;
  if (st.logo) return 'Adding your own logo is part of Pro. Remove the logo to print with the free version.';
  if (countNo() > FREE_COUNT) return `The free version prints up to ${FREE_COUNT} numbered tickets at a time. You can print as many times as you like – start the next batch at number ${startNo() + FREE_COUNT}.`;
  return '';
}
if (typeof module !== 'undefined') module.exports = { pages, ticket, numText, limitReason, TPLS, LAYOUTS, PAPERS, getSt: () => st, setSt: (o) => { Object.assign(st, o); }, setProState: (a, p) => { proAvailable = a; isPro = p; } };

if (typeof document !== 'undefined') (function () {
  let pgs = [], pageNo = 0, toastTimer;
  window.toast = function (msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000); };
  function renderPage() {
    const p = pgs[pageNo];
    $('page').innerHTML = p.svg.replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ` style="aspect-ratio:${p.w}/${p.h};width:min(100%, calc((100vh - 170px) * ${p.w / p.h}))"`);
    const total = Math.ceil(countNo() / ((LAYOUTS[st.per] || LAYOUTS[10]).cols * (LAYOUTS[st.per] || LAYOUTS[10]).rows));
    $('pager').textContent = `Sheet ${pageNo + 1} of ${total}` + (total > pgs.length ? ` (preview shows the first ${pgs.length})` : '');
    $('prev').disabled = pageNo === 0; $('next').disabled = pageNo >= pgs.length - 1;
  }
  function renderTpls() {
    $('tpls').innerHTML = TPLS.map((t) => { const d = decor(t.id, 0, 0, 120, 60, st.color); return `<button data-t="${t.id}" class="${t.id === st.tpl ? 'on' : ''}" title="${t.name}" aria-label="${t.name} design"><svg viewBox="0 0 120 60"><rect width="120" height="60" fill="#fff"/>${d.s}</svg>${tplLocked(t.id) ? '<span class="badge">PRO</span>' : ''}</button>`; }).join('');
    $('colors').innerHTML = COLORS.map((c) => `<button data-c="${c}" class="${c === st.color ? 'on' : ''}" style="background:${c}" aria-label="Colour"></button>`).join('');
  }
  window.renderAll = function () {
    ['paper', 'per', 'font', 'title', 'org', 'date', 'time', 'place', 'price', 'extra', 'start', 'count', 'prefix', 'stubLines'].forEach((k) => { if (document.activeElement !== $(k)) $(k).value = st[k]; });
    document.querySelectorAll('#kinds button').forEach((b) => b.classList.toggle('on', b.dataset.k === st.kind));
    $('stubF').hidden = st.kind !== 'raffle';
    $('logoDel').hidden = !st.logo; $('logoBtn').textContent = st.logo ? 'Change logo…' : 'Add a logo picture…';
    renderTpls();
    pgs = pages(true); pageNo = Math.min(pageNo, pgs.length - 1);
    const n = countNo(), L = LAYOUTS[st.per] || LAYOUTS[10], sheets = Math.ceil(n / (L.cols * L.rows));
    $('hint').textContent = `${n} ticket${n === 1 ? '' : 's'}, numbered ${numText(startNo())} to ${numText(startNo() + n - 1)}, on ${sheets} sheet${sheets === 1 ? '' : 's'} of paper.`;
    renderPage();
  };
  const change = () => { save(); renderAll(); };
  function printNow() {
    const r = limitReason(); if (r) { openPro(r); return; }
    const list = pages(false), p = list[0];
    if (list.length > 40 && !confirm(`This will print ${list.length} sheets of paper. Continue?`)) return;
    $('pageRule').textContent = `@page { size: ${p.w}mm ${p.h}mm; margin: 0; } @media print { #printArea svg { width: ${p.w}mm !important; height: ${p.h}mm !important; } }`;
    $('printArea').innerHTML = list.map((x) => x.svg).join('');
    window.print();
  }
  function pickLogo() {
    if (needsPro('Adding your own logo is part of Pro.')) return;
    const i = $('fileIn'); i.value = '';
    i.onchange = () => { const f = i.files[0]; if (!f) return; const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => { const m = 400 / Math.max(img.width, img.height, 400), cv = document.createElement('canvas'); cv.width = Math.round(img.width * m); cv.height = Math.round(img.height * m); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); st.logo = cv.toDataURL('image/png'); URL.revokeObjectURL(url); change(); };
      img.onerror = () => { URL.revokeObjectURL(url); toast('This file is not a picture that can be used.'); };
      img.src = url; };
    i.click();
  }
  Object.keys(PAPERS).forEach((k) => $('paper').add(new Option(PAPERS[k].name, k)));
  Object.keys(LAYOUTS).forEach((k) => $('per').add(new Option(LAYOUTS[k].name + ' per sheet', k)));
  document.querySelectorAll('#kinds button').forEach((b) => { b.onclick = () => { st.kind = b.dataset.k; change(); }; });
  ['paper', 'font'].forEach((k) => { $(k).onchange = () => { st[k] = $(k).value; pageNo = 0; change(); }; });
  $('per').onchange = () => { st.per = Number($('per').value); pageNo = 0; change(); };
  ['title', 'org', 'date', 'time', 'place', 'price', 'extra', 'prefix', 'stubLines', 'start', 'count'].forEach((k) => { $(k).oninput = () => { st[k] = $(k).value; change(); }; });
  $('nextBatch').onclick = () => { st.start = startNo() + countNo(); change(); toast(`The next tickets start at ${numText(startNo())}.`); };
  $('tpls').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.tpl = b.dataset.t; change(); if (tplLocked(st.tpl)) toast('This design is part of Pro. You can preview it here.'); } });
  $('colors').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { st.color = b.dataset.c; change(); } });
  $('logoBtn').onclick = pickLogo; $('logoDel').onclick = () => { st.logo = ''; change(); };
  $('prev').onclick = () => { if (pageNo > 0) { pageNo--; renderPage(); } };
  $('next').onclick = () => { if (pageNo < pgs.length - 1) { pageNo++; renderPage(); } };
  $('printBtn').onclick = printNow;
  $('moreBtn').onclick = (e) => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
  document.addEventListener('click', () => { $('menu').hidden = true; });
  $('eventBtn').onclick = () => { Object.assign(st, { kind: 'event', title: 'Autumn Concert', org: 'Riverside Community Choir', date: 'Friday, October 23, 2026', time: '7:30 PM', place: 'St. Mark\'s Hall, 40 River Road', price: '$10', extra: 'Doors open at 7:00 PM' }); pageNo = 0; change(); };
  $('raffleBtn').onclick = () => { Object.assign(st, { kind: 'raffle', title: 'Spring Raffle', org: 'Maple Street School PTA', date: 'Saturday, May 16, 2026', time: '2:00 PM', place: 'School Gym, 128 Maple Street', price: '$2', extra: 'Grand prize: a weekend getaway for two', stubLines: 'Name\nPhone' }); pageNo = 0; change(); };
  $('resetBtn').onclick = () => { if (confirm('Clear all texts and start again?')) { try { localStorage.removeItem('ticketpress'); } catch (_) {} location.reload(); } };
  $('proBtn').onclick = () => { if (!isPro) openPro(''); };
  $('buyBtn').onclick = buyPro;
  $('restoreBtn').onclick = async () => { proMessage((await checkPro()) ? 'Pro is unlocked. ★' : 'No purchase was found on this Microsoft account.'); };
  $('closePro').onclick = () => $('proDialog').close();
  window.addEventListener('resize', () => renderPage());
  setPro(isPro);
  checkPro();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
