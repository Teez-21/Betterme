// ============================================
// BetterME — Módulo de Hábitos
// ============================================

const HABIT_COLORS = ['#4F46E5','#14B8A6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#22C55E','#0EA5E9'];

const Habits = {
  list: [],
  logs: [], // { id, habitId, date, value/done }
  challenges: [],
  showCompleted: false,

  async init() {
    this.list = await DB.getAll('habits');
    this.logs = await DB.getAll('habitLogs');
    this.challenges = await DB.getAll('challenges');
    this.render();
  },

  activeHabits() {
    return this.list.filter(h => !h.archivado).sort((a,b) => a.posicion - b.posicion);
  },

  logsFor(habitId) {
    return this.logs.filter(l => l.habitId === habitId);
  },

  logFor(habitId, date) {
    return this.logs.find(l => l.habitId === habitId && l.date === date);
  },

  isDueOnDate(habit, iso) {
    if (habit.archivado) return false;
    if (habit.frecuencia === 'diario') return true;
    if (habit.frecuencia === 'semanal') {
      // due if not yet completed this week (simplified: shown every day of week, tracked weekly)
      return true;
    }
    if (habit.frecuencia === 'mensual') return true;
    return true;
  },

  isCompletedOnDate(habit, iso) {
    const log = this.logFor(habit.id, iso);
    if (!log) return false;
    if (habit.tipo === 'sino') return !!log.done;
    if (habit.tipo === 'contador') return habit.objetivo ? log.value >= habit.objetivo : log.value > 0;
    if (habit.tipo === 'tiempo') return habit.objetivo ? log.value >= habit.objetivo : log.value > 0;
    if (habit.tipo === 'numerico') return log.value != null;
    return false;
  },

  // ---------- Streak calculation (2 rest days system) ----------
  computeStreak(habit) {
    const logs = this.logsFor(habit.id).filter(l => this.isCompletedOnDate(habit, l.date));
    const doneDates = new Set(logs.map(l => l.date));
    if (doneDates.size === 0) return { current: 0, best: 0, restDays: 2 };

    const sorted = [...doneDates].sort();
    let best = 0, current = 0, restDays = 2, curRest = 2;
    let prevDate = null;
    let running = 0;

    // Walk chronologically from first completion to today, day by day
    let cursor = sorted[0];
    const today = Utils.todayISO();
    let streak = 0, rest = 2, bestStreak = 0;

    while (cursor <= today) {
      if (habit.pausado && habit.pausadoFechas && habit.pausadoFechas.includes(cursor)) {
        cursor = Utils.addDays(cursor, 1);
        continue;
      }
      if (doneDates.has(cursor)) {
        streak += 1;
        if (streak === 1) rest = 2; // fresh streak start recovers rest days conceptually
      } else if (cursor < today) {
        // missed a required day
        if (rest > 0) {
          rest -= 1;
        } else {
          streak = 0;
          rest = 2;
        }
      }
      bestStreak = Math.max(bestStreak, streak);
      cursor = Utils.addDays(cursor, 1);
    }
    return { current: streak, best: bestStreak, restDays: rest };
  },

  pctToday() {
    const iso = Utils.todayISO();
    const due = this.activeHabits().filter(h => !this.isPausedOn(h, iso));
    if (due.length === 0) return { pct: 0, done: 0, total: 0 };
    const done = due.filter(h => this.isCompletedOnDate(h, iso)).length;
    return { pct: Math.round((done / due.length) * 100), done, total: due.length };
  },

  isPausedOn(habit, iso) {
    return !!habit.pausado;
  },

  // ---------- Rendering ----------
  render() {
    const iso = Utils.todayISO();
    document.getElementById('habits-date').textContent = Utils.capitalize(Utils.formatDateLong(iso));
    document.getElementById('habits-greeting').textContent = `${Utils.greeting()}, Sergio`;

    const { pct, done, total } = this.pctToday();
    document.getElementById('habits-progress-fill').style.width = pct + '%';
    document.getElementById('habits-progress-label').textContent = `${done} / ${total} hábitos`;
    document.getElementById('habits-progress-pct').textContent = pct + '%';

    const due = this.activeHabits();
    const pending = due.filter(h => !this.isCompletedOnDate(h, iso));
    const completed = due.filter(h => this.isCompletedOnDate(h, iso));

    const pendingWrap = document.getElementById('habits-pending-list');
    const completedWrap = document.getElementById('habits-completed-list');
    const completedCountEl = document.getElementById('habits-completed-count');

    pendingWrap.innerHTML = '';
    completedWrap.innerHTML = '';
    completedCountEl.textContent = completed.length;

    if (due.length === 0) {
      pendingWrap.innerHTML = `<div class="empty-state"><div class="icon">🌱</div><div class="title">Aún no tienes hábitos</div><div>Toca el botón + para crear el primero.</div></div>`;
    }

    pending.forEach(h => pendingWrap.appendChild(this.renderHabitItem(h, iso)));
    completed.forEach(h => completedWrap.appendChild(this.renderHabitItem(h, iso)));

    document.getElementById('habits-completed-section').classList.toggle('hidden', due.length === 0 || completed.length === 0);
    completedWrap.classList.toggle('hidden', !this.showCompleted);
  },

  renderHabitItem(habit, iso) {
    const done = this.isCompletedOnDate(habit, iso);
    const streak = this.computeStreak(habit);
    const item = Utils.el(`
      <div class="habit-item ${done ? 'completed' : ''}" style="--habit-color:${habit.color}">
        <div class="habit-check ${done && habit.tipo === 'sino' ? 'checked' : ''}" data-role="check">
          ${done ? '✓' : ''}
        </div>
        <div class="habit-name-wrap" data-role="open">
          <div class="habit-name ${done ? 'done' : ''}">${Utils.escapeHtml(habit.nombre)}</div>
          <div class="habit-meta">
            <span>${this.typeLabel(habit)}</span>
            ${streak.current > 0 ? `<span class="habit-streak">🔥 ${streak.current}</span>` : ''}
          </div>
        </div>
        <div class="habit-right"></div>
      </div>
    `);

    const rightEl = item.querySelector('.habit-right');

    if (habit.tipo === 'sino') {
      item.querySelector('[data-role="check"]').onclick = (e) => {
        e.stopPropagation();
        this.toggleSiNo(habit, iso);
      };
    } else if (habit.tipo === 'contador') {
      const log = this.logFor(habit.id, iso);
      const val = log ? log.value : 0;
      item.querySelector('[data-role="check"]').style.visibility = 'hidden';
      rightEl.innerHTML = `
        <div class="habit-counter-controls">
          <button data-act="dec">−</button>
          <span class="habit-counter-val">${val}${habit.objetivo ? '/' + habit.objetivo : ''}</span>
          <button data-act="inc">+</button>
        </div>`;
      rightEl.querySelector('[data-act="inc"]').onclick = (e) => { e.stopPropagation(); this.incValue(habit, iso, (habit.unidad === 'minutos' ? 1 : 1)); };
      rightEl.querySelector('[data-act="dec"]').onclick = (e) => { e.stopPropagation(); this.incValue(habit, iso, -1); };
    } else if (habit.tipo === 'tiempo') {
      const log = this.logFor(habit.id, iso);
      const val = log ? log.value : 0;
      item.querySelector('[data-role="check"]').style.visibility = 'hidden';
      rightEl.innerHTML = `<div class="habit-counter-val" data-act="open-time" style="cursor:pointer;color:var(--indigo);font-weight:700;">${val} min</div>`;
      rightEl.querySelector('[data-act="open-time"]').onclick = (e) => { e.stopPropagation(); this.promptTimeValue(habit, iso); };
    } else if (habit.tipo === 'numerico') {
      const log = this.logFor(habit.id, iso);
      const val = log ? log.value : null;
      item.querySelector('[data-role="check"]').style.visibility = 'hidden';
      rightEl.innerHTML = `<div class="habit-counter-val" data-act="open-num" style="cursor:pointer;color:var(--indigo);font-weight:700;">${val != null ? val + ' ' + (habit.unidad||'') : 'Registrar'}</div>`;
      rightEl.querySelector('[data-act="open-num"]').onclick = (e) => { e.stopPropagation(); this.promptNumericValue(habit, iso); };
    }

    item.querySelector('[data-role="open"]').onclick = () => this.openHabitDetail(habit);
    return item;
  },

  typeLabel(habit) {
    const freq = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' }[habit.frecuencia];
    return freq;
  },

  async toggleSiNo(habit, iso) {
    if (Utils.isFuture(iso)) { Utils.toast('No puedes registrar fechas futuras'); return; }
    let log = this.logFor(habit.id, iso);
    if (log) {
      log.done = !log.done;
      await DB.put('habitLogs', log);
    } else {
      log = { id: DB.uuid(), habitId: habit.id, date: iso, done: true };
      this.logs.push(log);
      await DB.put('habitLogs', log);
    }
    this.render();
    if (log.done) this.maybeOfferExpense(habit, iso);
  },

  async incValue(habit, iso, delta) {
    if (Utils.isFuture(iso)) { Utils.toast('No puedes registrar fechas futuras'); return; }
    let log = this.logFor(habit.id, iso);
    if (!log) { log = { id: DB.uuid(), habitId: habit.id, date: iso, value: 0 }; this.logs.push(log); }
    log.value = Math.max(0, (log.value || 0) + delta);
    await DB.put('habitLogs', log);
    this.render();
    if (habit.objetivo && log.value >= habit.objetivo) this.maybeOfferExpense(habit, iso);
  },

  async promptTimeValue(habit, iso) {
    const val = prompt(`Minutos de "${habit.nombre}":`, '0');
    if (val === null) return;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    let log = this.logFor(habit.id, iso);
    if (!log) { log = { id: DB.uuid(), habitId: habit.id, date: iso }; this.logs.push(log); }
    log.value = n;
    await DB.put('habitLogs', log);
    this.render();
  },

  async promptNumericValue(habit, iso) {
    const val = prompt(`${habit.nombre} (${habit.unidad || 'valor'}):`, '');
    if (val === null) return;
    const n = parseFloat(val);
    if (isNaN(n)) return;
    let log = this.logFor(habit.id, iso);
    if (!log) { log = { id: DB.uuid(), habitId: habit.id, date: iso }; this.logs.push(log); }
    log.value = n;
    await DB.put('habitLogs', log);
    this.render();
  },

  maybeOfferExpense(habit, iso) {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">¡Hábito completado! 🎉</div>
        <p style="color:var(--gray);font-size:14px;margin-top:-8px;">¿Quieres registrar un gasto relacionado con "${Utils.escapeHtml(habit.nombre)}"?</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="skip-exp">Ahora no</button>
          <button class="btn btn-primary" id="go-exp">Registrar gasto</button>
        </div>
      </div>
    `);
    wrap.querySelector('#skip-exp').onclick = () => Utils.closeSheet();
    wrap.querySelector('#go-exp').onclick = () => {
      Utils.closeSheet();
      App.goTo('finance');
      setTimeout(() => Finance.openMovementForm('gasto', { descripcion: habit.nombre, fecha: iso }), 150);
    };
    Utils.openSheet(wrap);
  },

  toggleCompletedSection() {
    this.showCompleted = !this.showCompleted;
    document.getElementById('habits-completed-list').classList.toggle('hidden', !this.showCompleted);
    document.getElementById('habits-collapse-header').classList.toggle('open', this.showCompleted);
  },

  // ---------- Create / Edit ----------
  openCreateForm(existing = null) {
    const h = existing || { id: DB.uuid(), nombre: '', color: HABIT_COLORS[0], tipo: 'sino', unidad: '', objetivo: null, frecuencia: 'diario', activo: true, archivado: false, posicion: this.list.length, fechaCreacion: new Date().toISOString(), pausado: false };
    const isEdit = !!existing;

    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar hábito' : 'Nuevo hábito'}</div>
        <div class="field">
          <label>Nombre</label>
          <input type="text" id="hf-nombre" maxlength="40" placeholder="Ej. Leer, Gimnasio, Agua...">
        </div>
        <div class="field">
          <label>Tipo</label>
          <div class="chip-group" id="hf-tipo">
            <div class="chip" data-v="sino">Sí / No</div>
            <div class="chip" data-v="contador">Contador</div>
            <div class="chip" data-v="tiempo">Tiempo</div>
            <div class="chip" data-v="numerico">Valor numérico</div>
          </div>
        </div>
        <div class="field" id="hf-unidad-field">
          <label>Unidad (opcional)</label>
          <input type="text" id="hf-unidad" placeholder="Ej. páginas, km, kg">
        </div>
        <div class="field">
          <label>Objetivo (opcional)</label>
          <input type="number" id="hf-objetivo" min="0" placeholder="Ej. 30">
        </div>
        <div class="field">
          <label>Frecuencia</label>
          <div class="chip-group" id="hf-frecuencia">
            <div class="chip" data-v="diario">Diario</div>
            <div class="chip" data-v="semanal">Semanal</div>
            <div class="chip" data-v="mensual">Mensual</div>
          </div>
        </div>
        <div class="field">
          <label>Color</label>
          <div class="color-swatch-group" id="hf-color"></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="hf-cancel">Cancelar</button>
          <button class="btn btn-primary" id="hf-save">Guardar</button>
        </div>
      </div>
    `);

    wrap.querySelector('#hf-nombre').value = h.nombre;
    wrap.querySelector('#hf-unidad').value = h.unidad || '';
    wrap.querySelector('#hf-objetivo').value = h.objetivo || '';

    const tipoGroup = wrap.querySelector('#hf-tipo');
    [...tipoGroup.children].forEach(c => {
      c.classList.toggle('active', c.dataset.v === h.tipo);
      c.onclick = () => { [...tipoGroup.children].forEach(x => x.classList.remove('active')); c.classList.add('active');
        wrap.querySelector('#hf-unidad-field').style.display = (c.dataset.v === 'sino') ? 'none' : 'block';
      };
    });
    wrap.querySelector('#hf-unidad-field').style.display = (h.tipo === 'sino') ? 'none' : 'block';

    const freqGroup = wrap.querySelector('#hf-frecuencia');
    [...freqGroup.children].forEach(c => {
      c.classList.toggle('active', c.dataset.v === h.frecuencia);
      c.onclick = () => { [...freqGroup.children].forEach(x => x.classList.remove('active')); c.classList.add('active'); };
    });

    const colorGroup = wrap.querySelector('#hf-color');
    HABIT_COLORS.forEach(c => {
      const sw = Utils.el(`<div class="color-swatch ${c === h.color ? 'active' : ''}" style="background:${c}"></div>`);
      sw.onclick = () => { [...colorGroup.children].forEach(x => x.classList.remove('active')); sw.classList.add('active'); };
      colorGroup.appendChild(sw);
    });

    wrap.querySelector('#hf-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#hf-save').onclick = async () => {
      const nombre = wrap.querySelector('#hf-nombre').value.trim();
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      const tipo = tipoGroup.querySelector('.active')?.dataset.v || 'sino';
      const frecuencia = freqGroup.querySelector('.active')?.dataset.v || 'diario';
      const objetivoRaw = wrap.querySelector('#hf-objetivo').value;
      const objetivo = objetivoRaw ? Math.max(0, parseFloat(objetivoRaw)) : null;
      const color = colorGroup.querySelector('.active')?.style.background || HABIT_COLORS[0];
      const unidad = wrap.querySelector('#hf-unidad').value.trim();

      const rgbToHex = (rgbStr) => {
        const m = rgbStr.match(/\d+/g);
        if (!m) return HABIT_COLORS[0];
        return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
      };

      Object.assign(h, { nombre, tipo, frecuencia, objetivo, unidad, color: color.startsWith('rgb') ? rgbToHex(color) : color });
      await DB.put('habits', h);
      if (!isEdit) this.list.push(h);
      Utils.closeSheet();
      Utils.toast(isEdit ? 'Hábito actualizado' : 'Hábito creado');
      this.render();
    };

    Utils.openSheet(wrap);
  },

  async openHabitDetail(habit) {
    const streak = this.computeStreak(habit);
    const logs = this.logsFor(habit.id).filter(l => this.isCompletedOnDate(habit, l.date));
    const totalDays = logs.length;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="flex-between" style="margin-bottom:14px;">
          <div class="sheet-title" style="margin-bottom:0;">${Utils.escapeHtml(habit.nombre)}</div>
          <div style="width:14px;height:14px;border-radius:50%;background:${habit.color}"></div>
        </div>
        <div class="stat-grid">
          <div class="stat-box"><div class="val">🔥 ${streak.current}</div><div class="lbl">Racha actual</div></div>
          <div class="stat-box"><div class="val">${streak.best}</div><div class="lbl">Mejor racha</div></div>
          <div class="stat-box"><div class="val">${totalDays}</div><div class="lbl">Días cumplidos</div></div>
          <div class="stat-box"><div class="val">${streak.restDays}</div><div class="lbl">Descansos disp.</div></div>
        </div>
        <div class="section-title" style="margin-top:18px;">Calendario</div>
        <div class="gh-calendar" id="hd-gh"></div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="hd-edit">Editar</button>
          <button class="btn ${habit.pausado ? 'btn-primary' : 'btn-secondary'}" id="hd-pause">${habit.pausado ? 'Reanudar' : 'Pausar'}</button>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-danger" id="hd-archive">Archivar hábito</button>
        </div>
      </div>
    `);

    const ghWrap = wrap.querySelector('#hd-gh');
    const days = 84; // ~12 weeks
    for (let i = days; i >= 0; i--) {
      const iso = Utils.addDays(Utils.todayISO(), -i);
      let level = 0;
      const log = this.logFor(habit.id, iso);
      if (log) {
        if (this.isCompletedOnDate(habit, iso)) level = habit.objetivo ? 4 : 3;
        else if (log.value > 0) level = 2;
        else level = 1;
      }
      const cell = Utils.el(`<div class="gh-cell" data-level="${level}" title="${iso}"></div>`);
      ghWrap.appendChild(cell);
    }

    wrap.querySelector('#hd-edit').onclick = () => { Utils.closeSheet(); setTimeout(() => this.openCreateForm(habit), 200); };
    wrap.querySelector('#hd-pause').onclick = async () => {
      habit.pausado = !habit.pausado;
      await DB.put('habits', habit);
      Utils.closeSheet();
      Utils.toast(habit.pausado ? 'Hábito pausado' : 'Hábito reanudado');
      this.render();
    };
    wrap.querySelector('#hd-archive').onclick = async () => {
      const ok = await Utils.confirmDialog(`¿Archivar "${habit.nombre}"? Se conservará su historial.`, 'Archivar');
      if (ok) {
        habit.archivado = true;
        await DB.put('habits', habit);
        Utils.toast('Hábito archivado');
        this.render();
      }
    };

    Utils.openSheet(wrap);
  }
};
