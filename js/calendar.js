// ============================================
// BetterME — Módulo de Calendario
// ============================================

const CAL_TYPE_META = {
  evento: { color: 'var(--pastel-event)', ink: 'var(--pastel-event-ink)', dot: '#7FA6F5', label: 'Evento' },
  cumpleanos: { color: 'var(--pastel-birthday)', ink: 'var(--pastel-birthday-ink)', dot: '#B48CF0', label: 'Cumpleaños' },
  proyecto: { color: 'var(--pastel-project)', ink: 'var(--pastel-project-ink)', dot: '#5FCB8E', label: 'Proyecto' },
  otro: { color: 'var(--pastel-other)', ink: 'var(--pastel-other-ink)', dot: '#E3C244', label: 'Otro' },
};

const Calendar = {
  items: [],
  viewDate: new Date(),
  selectedDate: Utils.todayISO(),
  filters: { evento: true, cumpleanos: true, proyecto: true, habitos: true },

  async init() {
    this.items = await DB.getAll('calendarItems');
    const savedFilters = await DB.getSetting('calendarFilters');
    if (savedFilters) this.filters = savedFilters;
    this.render();
  },

  async saveFilters() { await DB.setSetting('calendarFilters', this.filters); },

  itemsOnDate(iso) {
    const result = [];
    this.items.forEach(it => {
      if (it.tipo === 'proyecto') return; // projects shown separately, not as daily items unless within range
      // Birthdays always recur every year, regardless of what's stored in "repeticion"
      // (defensive: covers any item saved before this rule was enforced).
      if (it.tipo === 'cumpleanos') {
        const d = Utils.isoToDate(it.fecha);
        const target = Utils.isoToDate(iso);
        if (d.getMonth() === target.getMonth() && d.getDate() === target.getDate()) result.push(it);
      } else if (it.repeticion === 'anual') {
        const d = Utils.isoToDate(it.fecha);
        const target = Utils.isoToDate(iso);
        if (d.getMonth() === target.getMonth() && d.getDate() === target.getDate()) result.push(it);
      } else if (it.repeticion === 'mensual') {
        const d = Utils.isoToDate(it.fecha);
        const target = Utils.isoToDate(iso);
        if (d.getDate() === target.getDate() && iso >= it.fecha) result.push(it);
      } else if (it.repeticion === 'semanal') {
        const d = Utils.isoToDate(it.fecha);
        const target = Utils.isoToDate(iso);
        if (d.getDay() === target.getDay() && iso >= it.fecha) result.push(it);
      } else if (it.repeticion === 'diario') {
        if (iso >= it.fecha) result.push(it);
      } else {
        if (it.fecha === iso) result.push(it);
      }
    });
    return result;
  },

  projectsOnDate(iso) {
    return this.items.filter(it => it.tipo === 'proyecto' && iso >= it.fechaInicio && iso <= it.fechaFinal);
  },

  render() {
    this.renderMonthGrid();
    this.renderDayDetail();
    this.renderFilters();
  },

  renderFilters() {
    const wrap = document.getElementById('calendar-filters');
    wrap.innerHTML = '';
    const defs = [
      ['evento', 'Eventos'], ['cumpleanos', 'Cumpleaños'], ['proyecto', 'Proyectos'], ['habitos', 'Hábitos']
    ];
    defs.forEach(([key, label]) => {
      const chip = Utils.el(`<div class="chip ${this.filters[key] ? 'active' : ''}">${label}</div>`);
      chip.onclick = () => { this.filters[key] = !this.filters[key]; this.saveFilters(); this.render(); };
      wrap.appendChild(chip);
    });
  },

  changeMonth(delta) {
    this.viewDate.setMonth(this.viewDate.getMonth() + delta);
    this.renderMonthGrid();
  },

  goToday() {
    this.viewDate = new Date();
    this.selectedDate = Utils.todayISO();
    this.render();
  },

  renderMonthGrid() {
    const y = this.viewDate.getFullYear(), m = this.viewDate.getMonth();
    document.getElementById('calendar-month-label').textContent = `${Utils.monthName(m)} ${y}`;

    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    const grid = document.getElementById('calendar-month-grid');
    grid.innerHTML = '';
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const weeks = [];
    let currentWeek = [];

    for (let i = 0; i < totalCells; i++) {
      let dayNum, iso, otherMonth = false;
      if (i < startOffset) {
        dayNum = prevMonthDays - startOffset + i + 1;
        iso = Utils.dateToISO(new Date(y, m - 1, dayNum));
        otherMonth = true;
      } else if (i >= startOffset + daysInMonth) {
        dayNum = i - startOffset - daysInMonth + 1;
        iso = Utils.dateToISO(new Date(y, m + 1, dayNum));
        otherMonth = true;
      } else {
        dayNum = i - startOffset + 1;
        iso = Utils.dateToISO(new Date(y, m, dayNum));
      }

      currentWeek.push(iso);
      if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }

      const isToday = iso === Utils.todayISO();
      const isSelected = iso === this.selectedDate;
      const cell = Utils.el(`<button class="day-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}">${dayNum}</button>`);

      const dots = [];
      if (this.filters.evento || this.filters.cumpleanos) {
        this.itemsOnDate(iso).forEach(it => {
          if (it.tipo === 'cumpleanos' && this.filters.cumpleanos) dots.push(CAL_TYPE_META.cumpleanos.dot);
          else if (it.tipo === 'evento' && this.filters.evento) dots.push(CAL_TYPE_META.evento.dot);
          else if (it.tipo === 'otro' && this.filters.evento) dots.push(CAL_TYPE_META.otro.dot);
        });
      }
      // Project phases are rendered as Gantt-style bars (see renderProjectBars), not dots.
      if (this.filters.habitos && !otherMonth) dots.push('#4F46E5');

      if (dots.length) {
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'day-dots';
        dots.slice(0,3).forEach(c => {
          const d = document.createElement('div');
          d.className = 'day-dot';
          d.style.background = c;
          dotsWrap.appendChild(d);
        });
        cell.appendChild(dotsWrap);
      }

      cell.onclick = () => { this.selectedDate = iso; this.render(); };
      grid.appendChild(cell);
    }

    this.renderProjectBars(weeks);
  },

  // Renders project phases as horizontal bars that span across days (Gantt-style),
  // overlaid on top of the month grid instead of a small dot.
  renderProjectBars(weeks) {
    const overlay = document.getElementById('calendar-bars-overlay');
    overlay.innerHTML = '';
    overlay.style.gridTemplateRows = `repeat(${weeks.length}, 1fr)`;
    if (!this.filters.proyecto) return;

    const projects = this.items.filter(it => it.tipo === 'proyecto');
    const segments = [];
    projects.forEach(p => {
      if (p.fases && p.fases.length) {
        p.fases.forEach(f => {
          const color = f.estado === 'completada' ? '#22C55E' : (f.estado === 'en_progreso' ? CAL_TYPE_META.proyecto.dot : '#B7C3CE');
          segments.push({ start: f.fechaInicio, end: f.fechaFin, color, project: p, phase: f });
        });
      } else {
        segments.push({ start: p.fechaInicio, end: p.fechaFinal, color: CAL_TYPE_META.proyecto.dot, project: p, phase: null });
      }
    });
    if (!segments.length) return;

    weeks.forEach((week, rowIdx) => {
      const weekStart = week[0], weekEnd = week[6];
      const rowSegs = segments
        .filter(s => s.end >= weekStart && s.start <= weekEnd)
        .map(s => {
          const clipStart = s.start < weekStart ? weekStart : s.start;
          const clipEnd = s.end > weekEnd ? weekEnd : s.end;
          return { ...s, colStart: week.indexOf(clipStart) + 1, colEnd: week.indexOf(clipEnd) + 1 };
        })
        .sort((a, b) => a.colStart - b.colStart);

      // Lane assignment so overlapping phases stack instead of collide (interval scheduling).
      const laneEnds = [];
      rowSegs.forEach(seg => {
        let lane = laneEnds.findIndex(end => end < seg.colStart);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(seg.colEnd); }
        else laneEnds[lane] = seg.colEnd;
        seg.lane = lane;
      });

      rowSegs.slice(0, 30).forEach(seg => {
        if (seg.lane > 1) return; // keep at most 2 stacked bars per week row to avoid overflow
        const label = seg.phase ? `${seg.project.nombre} · ${seg.phase.nombre}` : seg.project.nombre;
        const bar = Utils.el(`<div class="gantt-bar-cell" title="${Utils.escapeHtml(label)}"></div>`);
        bar.style.gridColumn = `${seg.colStart} / ${seg.colEnd + 1}`;
        bar.style.gridRow = `${rowIdx + 1} / ${rowIdx + 2}`;
        bar.style.background = seg.color;
        bar.style.setProperty('--lane', seg.lane);
        const roundLeft = seg.start >= weekStart;
        const roundRight = seg.end <= weekEnd;
        bar.style.borderRadius = `${roundLeft ? '3px' : '0'} ${roundRight ? '3px' : '0'} ${roundRight ? '3px' : '0'} ${roundLeft ? '3px' : '0'}`;
        bar.onclick = (e) => { e.stopPropagation(); this.openProjectDetail(seg.project); };
        overlay.appendChild(bar);
      });
    });
  },

  renderDayDetail() {
    const iso = this.selectedDate;
    document.getElementById('calendar-day-title').textContent = Utils.capitalize(Utils.formatDateLong(iso));
    const wrap = document.getElementById('calendar-day-items');
    wrap.innerHTML = '';

    const dayItems = this.itemsOnDate(iso).filter(it => this.filters[it.tipo === 'cumpleanos' ? 'cumpleanos' : (it.tipo === 'otro' ? 'evento' : it.tipo)]);
    const projects = this.filters.proyecto ? this.projectsOnDate(iso) : [];
    const habitsToday = this.filters.habitos ? Habits.activeHabits().filter(h => !h.pausado) : [];

    let any = false;

    dayItems.sort((a,b) => (a.horaInicio||'').localeCompare(b.horaInicio||'')).forEach(it => {
      any = true;
      const meta = CAL_TYPE_META[it.tipo];
      const row = Utils.el(`
        <div class="daily-item">
          <div class="time">${it.horaInicio || ''}</div>
          <div class="tag-dot" style="background:${meta.dot}"></div>
          <div class="content">
            <div class="name">${Utils.escapeHtml(it.nombre)}</div>
            ${it.anotacion ? `<div class="note">${Utils.escapeHtml(it.anotacion)}</div>` : ''}
          </div>
        </div>
      `);
      row.onclick = () => this.openItemForm(it.tipo, it);
      wrap.appendChild(row);
    });

    if (habitsToday.length) {
      any = true;
      const box = Utils.el(`<div class="daily-item" style="flex-direction:column;align-items:stretch;"><div class="content"><div class="name" style="margin-bottom:8px;">Hábitos</div></div></div>`);
      habitsToday.forEach(h => {
        const done = Habits.isCompletedOnDate(h, iso);
        const r = Utils.el(`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:14px;">
          <span>${done ? '☑' : '☐'}</span><span style="${done ? 'text-decoration:line-through;color:var(--gray);' : ''}">${Utils.escapeHtml(h.nombre)}</span>
        </div>`);
        box.querySelector('.content').appendChild(r);
      });
      wrap.appendChild(box);
    }

    projects.forEach(p => {
      any = true;
      const row = Utils.el(`
        <div class="daily-item">
          <div class="tag-dot" style="background:${CAL_TYPE_META.proyecto.dot}"></div>
          <div class="content">
            <div class="name">Proyecto: ${Utils.escapeHtml(p.nombre)}</div>
            <div class="note">${this.currentPhaseLabel(p, iso)}</div>
          </div>
        </div>
      `);
      row.onclick = () => this.openProjectDetail(p);
      wrap.appendChild(row);
    });

    if (!any) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">🗓️</div><div class="title">Nada para este día</div><div>Toca + para agregar un elemento.</div></div>`;
    }
  },

  currentPhaseLabel(project, iso) {
    const phase = (project.fases || []).find(f => iso >= f.fechaInicio && iso <= f.fechaFin);
    return phase ? `Fase: ${phase.nombre}` : '';
  },

  // ---------- Create forms ----------
  // ---------- Recordatorios reales vía Calendario nativo (.ics) ----------
  // Un push real necesitaría un servidor; exportar a la app de Calendario del
  // teléfono deja que el sistema operativo dispare el aviso aunque BetterME
  // lleve días cerrada.
  icsEscape(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  },

  icsUtcStamp(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  },

  buildVEvent(it) {
    const pad = n => String(n).padStart(2, '0');
    const fmtLocal = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const lines = ['BEGIN:VEVENT'];
    lines.push(`UID:${it.id}@betterme.app`);
    lines.push(`DTSTAMP:${this.icsUtcStamp(new Date())}`);

    const isAllDay = it.tipo === 'cumpleanos' || !it.horaInicio;
    if (isAllDay) {
      const dateDigits = it.fecha.replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${dateDigits}`);
      lines.push(`DTEND;VALUE=DATE:${Utils.addDays(it.fecha, 1).replace(/-/g, '')}`);
    } else {
      const start = new Date(`${it.fecha}T${it.horaInicio}:00`);
      const end = it.horaFinal ? new Date(`${it.fecha}T${it.horaFinal}:00`) : new Date(start.getTime() + 30 * 60000);
      lines.push(`DTSTART:${fmtLocal(start)}`);
      lines.push(`DTEND:${fmtLocal(end)}`);
    }

    lines.push(`SUMMARY:${this.icsEscape(it.nombre)}${it.tipo === 'cumpleanos' ? ' 🎂' : ''}`);
    if (it.anotacion) lines.push(`DESCRIPTION:${this.icsEscape(it.anotacion)}`);

    const rrule = { diario: 'FREQ=DAILY', semanal: 'FREQ=WEEKLY', mensual: 'FREQ=MONTHLY', anual: 'FREQ=YEARLY' }[it.repeticion];
    if (rrule) lines.push(`RRULE:${rrule}`);

    if (it.tipo === 'cumpleanos') {
      // Per spec: one reminder the day before, one the same day.
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:-P1D', 'END:VALARM');
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:PT9H', 'END:VALARM');
    } else if (!isAllDay) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:-PT30M', 'END:VALARM');
    } else {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:PT9H', 'END:VALARM');
    }

    lines.push('END:VEVENT');
    return lines.join('\r\n');
  },

  downloadICS(filename, vevents) {
    const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//BetterME//ES\r\nCALSCALE:GREGORIAN\r\n${vevents}\r\nEND:VCALENDAR`;
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  exportItemToCalendar(it) {
    this.downloadICS(`${it.nombre.replace(/[^a-z0-9]/gi, '_') || 'evento'}.ics`, this.buildVEvent(it));
    Utils.toast('Abre el archivo y elige "Agregar a Calendario"');
  },

  exportAllToCalendar() {
    const items = this.items.filter(i => i.tipo !== 'proyecto');
    if (!items.length) { Utils.toast('Aún no tienes eventos, cumpleaños u otros para exportar'); return; }
    this.downloadICS('betterme-calendario.ics', items.map(it => this.buildVEvent(it)).join('\r\n'));
    Utils.toast('Abre el archivo y elige "Agregar a Calendario"');
  },

  openTypeMenu() {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Crear</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-secondary btn-block" data-t="evento"><span class="icon-inline" style="width:16px;height:16px;">${Icon.calendar()}</span> Evento</button>
          <button class="btn btn-secondary btn-block" data-t="cumpleanos"><span class="icon-inline" style="width:16px;height:16px;">${Icon.cake()}</span> Cumpleaños</button>
          <button class="btn btn-secondary btn-block" data-t="proyecto"><span class="icon-inline" style="width:16px;height:16px;">${Icon.folder()}</span> Proyecto</button>
          <button class="btn btn-secondary btn-block" data-t="otro"><span class="icon-inline" style="width:16px;height:16px;">${Icon.pin()}</span> Otro</button>
        </div>
      </div>
    `);
    wrap.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      Utils.closeSheet();
      setTimeout(() => {
        if (b.dataset.t === 'proyecto') this.openProjectForm();
        else this.openItemForm(b.dataset.t);
      }, 200);
    });
    Utils.openSheet(wrap);
  },

  openItemForm(tipo, existing = null) {
    const it = existing || { id: DB.uuid(), tipo, nombre: '', fecha: this.selectedDate, horaInicio: '', horaFinal: '', anotacion: '', repeticion: tipo === 'cumpleanos' ? 'anual' : 'unica' };
    const isEdit = !!existing;
    const titleMap = { evento: 'evento', cumpleanos: 'cumpleaños', otro: 'elemento' };

    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar' : 'Nuevo'} ${titleMap[tipo]}</div>
        <div class="field"><label>Nombre</label><input type="text" id="if-nombre"></div>
        <div class="field"><label>Fecha</label><input type="date" id="if-fecha"></div>
        ${tipo !== 'cumpleanos' ? `
        <div class="field-row">
          <div class="field"><label>Hora inicio</label><input type="time" id="if-hi"></div>
          <div class="field"><label>Hora final</label><input type="time" id="if-hf"></div>
        </div>` : ''}
        ${tipo !== 'cumpleanos' ? `
        <div class="field">
          <label>Repetición</label>
          <select id="if-rep">
            <option value="unica">Una vez</option>
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </div>` : ''}
        <div class="field"><label>Anotación (opcional)</label><textarea id="if-nota"></textarea></div>
        ${isEdit ? `<button class="btn btn-secondary btn-block" id="if-remind" style="margin-bottom:16px;">Agregar recordatorio a tu Calendario</button>` : ''}
        <div class="sheet-actions">
          ${isEdit ? `<button class="btn btn-danger" id="if-delete">Eliminar</button>` : `<button class="btn btn-ghost" id="if-cancel">Cancelar</button>`}
          <button class="btn btn-primary" id="if-save">Guardar</button>
        </div>
      </div>
    `);

    wrap.querySelector('#if-nombre').value = it.nombre;
    wrap.querySelector('#if-fecha').value = it.fecha;
    if (tipo !== 'cumpleanos') {
      wrap.querySelector('#if-hi').value = it.horaInicio || '';
      wrap.querySelector('#if-hf').value = it.horaFinal || '';
      wrap.querySelector('#if-rep').value = it.repeticion || 'unica';
    }
    wrap.querySelector('#if-nota').value = it.anotacion || '';

    if (isEdit) {
      wrap.querySelector('#if-remind').onclick = () => this.exportItemToCalendar(it);
      wrap.querySelector('#if-delete').onclick = async () => {
        const ok = await Utils.confirmDialog('¿Eliminar este elemento?', 'Eliminar');
        if (ok) {
          await DB.delete('calendarItems', it.id);
          this.items = this.items.filter(x => x.id !== it.id);
          Utils.toast('Eliminado');
          this.render();
        }
      };
    } else {
      wrap.querySelector('#if-cancel').onclick = () => Utils.closeSheet();
    }

    wrap.querySelector('#if-save').onclick = async () => {
      const nombre = wrap.querySelector('#if-nombre').value.trim();
      const fecha = wrap.querySelector('#if-fecha').value;
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      if (!fecha) { Utils.toast('Selecciona una fecha'); return; }
      if (tipo !== 'cumpleanos') {
        const hi = wrap.querySelector('#if-hi').value, hf = wrap.querySelector('#if-hf').value;
        if (hi && hf && hi >= hf) { Utils.toast('La hora de inicio debe ser anterior a la final'); return; }
        it.horaInicio = hi; it.horaFinal = hf;
        it.repeticion = wrap.querySelector('#if-rep').value;
      } else {
        it.repeticion = 'anual';
      }
      it.nombre = nombre;
      it.fecha = fecha;
      it.anotacion = wrap.querySelector('#if-nota').value.trim();
      await DB.put('calendarItems', it);
      if (!isEdit) this.items.push(it);
      Utils.closeSheet();
      Utils.toast('Guardado');
      this.render();
    };

    Utils.openSheet(wrap);
  },

  // ---------- Projects ----------
  openProjectForm(existing = null) {
    const p = existing || { id: DB.uuid(), tipo: 'proyecto', nombre: '', fechaInicio: this.selectedDate, fechaFinal: Utils.addDays(this.selectedDate, 30), estado: 'no_iniciado', color: CAL_TYPE_META.proyecto.dot, fases: [] };
    const isEdit = !!existing;

    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</div>
        <div class="field"><label>Nombre</label><input type="text" id="pf-nombre"></div>
        <div class="field-row">
          <div class="field"><label>Fecha inicio</label><input type="date" id="pf-inicio"></div>
          <div class="field"><label>Fecha final</label><input type="date" id="pf-final"></div>
        </div>
        <div class="field">
          <label>Estado</label>
          <select id="pf-estado">
            <option value="no_iniciado">No iniciado</option>
            <option value="en_progreso">En progreso</option>
            <option value="completado">Completado</option>
          </select>
        </div>
        <p style="font-size:12.5px;color:var(--gray);margin-top:-6px;">Podrás agregar fases y tareas después de guardar el proyecto.</p>
        <div class="sheet-actions">
          ${isEdit ? `<button class="btn btn-danger" id="pf-delete">Eliminar</button>` : `<button class="btn btn-ghost" id="pf-cancel">Cancelar</button>`}
          <button class="btn btn-primary" id="pf-save">Guardar</button>
        </div>
      </div>
    `);

    wrap.querySelector('#pf-nombre').value = p.nombre;
    wrap.querySelector('#pf-inicio').value = p.fechaInicio;
    wrap.querySelector('#pf-final').value = p.fechaFinal;
    wrap.querySelector('#pf-estado').value = p.estado;

    if (isEdit) {
      wrap.querySelector('#pf-delete').onclick = async () => {
        const ok = await Utils.confirmDialog(`¿Eliminar proyecto "${p.nombre}"?`, 'Eliminar');
        if (ok) {
          await DB.delete('calendarItems', p.id);
          this.items = this.items.filter(x => x.id !== p.id);
          Utils.toast('Proyecto eliminado');
          this.render();
        }
      };
    } else {
      wrap.querySelector('#pf-cancel').onclick = () => Utils.closeSheet();
    }

    wrap.querySelector('#pf-save').onclick = async () => {
      const nombre = wrap.querySelector('#pf-nombre').value.trim();
      const fi = wrap.querySelector('#pf-inicio').value, ff = wrap.querySelector('#pf-final').value;
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      if (!fi || !ff || fi > ff) { Utils.toast('La fecha de inicio no puede ser posterior a la final'); return; }
      p.nombre = nombre; p.fechaInicio = fi; p.fechaFinal = ff;
      p.estado = wrap.querySelector('#pf-estado').value;
      await DB.put('calendarItems', p);
      if (!isEdit) this.items.push(p);
      Utils.closeSheet();
      Utils.toast('Proyecto guardado');
      this.render();
      setTimeout(() => this.openProjectDetail(p), 250);
    };

    Utils.openSheet(wrap);
  },

  openProjectDetail(project) {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="flex-between"><div class="sheet-title" style="margin-bottom:4px;">${Utils.escapeHtml(project.nombre)}</div></div>
        <p style="font-size:12.5px;color:var(--gray);margin-top:0;">${Utils.formatDateShort(project.fechaInicio)} — ${Utils.formatDateShort(project.fechaFinal)}</p>
        <div class="section-title">Progreso</div>
        <div class="progress-track" style="margin-bottom:4px;"><div class="progress-fill" id="pd-progress-fill"></div></div>
        <div style="text-align:right;font-size:12px;color:var(--gray);" id="pd-progress-pct"></div>
        <div class="section-title" style="margin-top:16px;">Diagrama de Gantt</div>
        <div id="pd-gantt"></div>
        <div class="flex-between" style="margin-top:16px;">
          <div class="section-title" style="margin:0;">Fases</div>
          <button class="btn btn-secondary" id="pd-add-phase" style="padding:7px 14px;font-size:13px;">+ Fase</button>
        </div>
        <div id="pd-phases"></div>
        <div class="sheet-actions">
          <button class="btn btn-secondary" id="pd-edit">Editar proyecto</button>
        </div>
      </div>
    `);

    const renderInner = () => {
      const allTasks = (project.fases || []).flatMap(f => f.tasks || []);
      const doneTasks = allTasks.filter(t => t.completada).length;
      const pct = allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0;
      wrap.querySelector('#pd-progress-fill').style.width = pct + '%';
      wrap.querySelector('#pd-progress-pct').textContent = pct + '%';

      // Gantt
      const gantt = wrap.querySelector('#pd-gantt');
      gantt.innerHTML = '';
      const projStart = Utils.isoToDate(project.fechaInicio).getTime();
      const projEnd = Utils.isoToDate(project.fechaFinal).getTime();
      const totalSpan = Math.max(1, projEnd - projStart);
      (project.fases || []).forEach(f => {
        const s = Utils.isoToDate(f.fechaInicio).getTime();
        const e = Utils.isoToDate(f.fechaFin).getTime();
        const left = Math.max(0, ((s - projStart) / totalSpan) * 100);
        const width = Math.max(3, ((e - s) / totalSpan) * 100);
        const color = f.estado === 'completada' ? '#22C55E' : (f.estado === 'en_progreso' ? '#4F46E5' : '#C7C7CC');
        const row = Utils.el(`
          <div class="gantt-row">
            <div class="gantt-label"><span>${Utils.escapeHtml(f.nombre)}</span><span style="color:var(--gray);">${f.estado === 'completada' ? '✔' : ''}</span></div>
            <div class="gantt-track"><div class="gantt-bar" style="margin-left:${left}%;width:${width}%;background:${color};"></div></div>
          </div>
        `);
        gantt.appendChild(row);
      });
      if (!project.fases || !project.fases.length) {
        gantt.innerHTML = '<p style="font-size:13px;color:var(--gray);">Agrega fases para ver el diagrama.</p>';
      }

      // Phases + tasks
      const phasesWrap = wrap.querySelector('#pd-phases');
      phasesWrap.innerHTML = '';
      (project.fases || []).forEach(f => {
        const fBox = Utils.el(`
          <div class="card" style="margin-bottom:10px;padding:14px;">
            <div class="flex-between">
              <div style="font-weight:700;font-size:14.5px;">${Utils.escapeHtml(f.nombre)}</div>
              <span style="font-size:11px;color:var(--gray);">${Utils.formatDateShort(f.fechaInicio)}–${Utils.formatDateShort(f.fechaFin)}</span>
            </div>
            <div class="tasks-wrap" style="margin-top:8px;"></div>
            <button class="btn btn-ghost" data-add-task style="padding:6px 0;font-size:13px;">+ Tarea</button>
          </div>
        `);
        const tasksWrap = fBox.querySelector('.tasks-wrap');
        (f.tasks || []).forEach(t => {
          const row = Utils.el(`
            <div class="task-row">
              <div class="task-check ${t.completada ? 'checked' : ''}">${t.completada ? '✓' : ''}</div>
              <div class="task-name ${t.completada ? 'done' : ''}">${Utils.escapeHtml(t.nombre)}</div>
            </div>
          `);
          row.querySelector('.task-check').onclick = async () => {
            t.completada = !t.completada;
            // auto-complete phase if all tasks done
            if (f.tasks.length && f.tasks.every(x => x.completada)) f.estado = 'completada';
            else if (f.estado === 'completada') f.estado = 'en_progreso';
            await DB.put('calendarItems', project);
            renderInner();
          };
          tasksWrap.appendChild(row);
        });
        fBox.querySelector('[data-add-task]').onclick = () => {
          const name = prompt('Nombre de la tarea:');
          if (name && name.trim()) {
            f.tasks = f.tasks || [];
            f.tasks.push({ id: DB.uuid(), nombre: name.trim(), completada: false });
            DB.put('calendarItems', project).then(renderInner);
          }
        };
        phasesWrap.appendChild(fBox);
      });
    };

    wrap.querySelector('#pd-add-phase').onclick = () => {
      const name = prompt('Nombre de la fase:');
      if (!name || !name.trim()) return;
      const fi = prompt('Fecha de inicio (YYYY-MM-DD):', project.fechaInicio);
      const ff = prompt('Fecha de fin (YYYY-MM-DD):', project.fechaFinal);
      if (!fi || !ff) return;
      project.fases = project.fases || [];
      project.fases.push({ id: DB.uuid(), nombre: name.trim(), fechaInicio: fi, fechaFin: ff, estado: 'pendiente', tasks: [] });
      DB.put('calendarItems', project).then(renderInner);
    };
    wrap.querySelector('#pd-edit').onclick = () => { Utils.closeSheet(); setTimeout(() => this.openProjectForm(project), 200); };

    renderInner();
    Utils.openSheet(wrap);
  }
};
