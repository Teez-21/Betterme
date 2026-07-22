// ============================================
// BetterME — Utilities
// ============================================

const Utils = {
  todayISO() {
    return Utils.dateToISO(new Date());
  },
  dateToISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  isoToDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  isFuture(iso) {
    return iso > Utils.todayISO();
  },
  addDays(iso, n) {
    const d = Utils.isoToDate(iso);
    d.setDate(d.getDate() + n);
    return Utils.dateToISO(d);
  },
  startOfWeek(iso) {
    const d = Utils.isoToDate(iso);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return Utils.dateToISO(d);
  },
  formatDateLong(iso) {
    const d = Utils.isoToDate(iso);
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  },
  formatDateShort(iso) {
    const d = Utils.isoToDate(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  },
  monthName(monthIdx) {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][monthIdx];
  },
  weekdayShort() { return ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']; },

  capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); },

  money(n) {
    const v = Math.round(n || 0);
    return '$' + v.toLocaleString('es-CO');
  },

  clampPct(n) { return Math.max(0, Math.min(100, n)); },

  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  },

  toast(msg, ms = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(Utils._toastTimer);
    Utils._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  },

  el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },

  escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  // Simple sheet (bottom modal) controller
  openSheet(contentEl) {
    const scrim = document.getElementById('sheet-scrim');
    const container = document.getElementById('sheet-container');
    container.innerHTML = '';
    container.appendChild(contentEl);
    scrim.classList.add('show');
  },
  closeSheet() {
    document.getElementById('sheet-scrim').classList.remove('show');
  },

  async confirmDialog(message, confirmLabel = 'Confirmar') {
    return new Promise(resolve => {
      const wrap = Utils.el(`
        <div>
          <div class="sheet-handle"></div>
          <div class="sheet-title">${Utils.escapeHtml(message)}</div>
          <div class="sheet-actions">
            <button class="btn btn-ghost" id="cf-cancel">Cancelar</button>
            <button class="btn btn-danger" id="cf-ok">${Utils.escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      `);
      wrap.querySelector('#cf-cancel').onclick = () => { Utils.closeSheet(); resolve(false); };
      wrap.querySelector('#cf-ok').onclick = () => { Utils.closeSheet(); resolve(true); };
      Utils.openSheet(wrap);
    });
  },

  hexToRgb(hex) {
    const m = hex.replace('#','').match(/.{1,2}/g);
    return m.map(x => parseInt(x, 16));
  },

  // Builds an inline SVG ring. pct: 0-100. r default fits a 34px box with stroke-width 3.5.
  ringSVG(pct, r = 13.5, size = 34) {
    const c = 2 * Math.PI * r;
    const offset = c - (Utils.clampPct(pct) / 100) * c;
    const center = size / 2;
    return `
      <svg viewBox="0 0 ${size} ${size}">
        <circle class="ring-track" cx="${center}" cy="${center}" r="${r}"></circle>
        <circle class="ring-fill" cx="${center}" cy="${center}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
      </svg>
    `;
  }
};

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'sheet-scrim') Utils.closeSheet();
});

// ---------- Drag-to-dismiss for sheets ----------
// Dragging down from the top area of a sheet (handle + header) closes it,
// so people aren't forced to tap outside to dismiss.
(function initSheetDrag() {
  const sheet = document.getElementById('sheet-container');
  if (!sheet) return;
  let dragging = false, startY = 0, currentY = 0;

  const withinDragZone = (e) => {
    const rect = sheet.getBoundingClientRect();
    return (e.clientY - rect.top) <= 64;
  };

  sheet.addEventListener('pointerdown', (e) => {
    if (!withinDragZone(e)) return;
    dragging = true;
    startY = e.clientY;
    sheet.style.transition = 'none';
    try { sheet.setPointerCapture(e.pointerId); } catch (err) {}
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    currentY = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${currentY}px)`;
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (currentY > 110) Utils.closeSheet();
    currentY = 0;
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
})();
