// ============================================
// BetterME — Dashboard y Estadísticas
// Consumidor puro de datos: no crea ni modifica información.
// ============================================

const Dashboard = {
  compareRange: 'week', // week | month | year

  init() {
    this.render();
  },

  render() {
    this.renderSummary();
    this.renderHabitsBlock();
    this.renderFinanceBlock();
    this.renderProjectsBlock();
    this.renderGlobalGithub();
    this.renderComparisons();
  },

  renderSummary() {
    document.getElementById('dash-greeting').textContent = `${Utils.greeting()}, ${Settings.userName}`;
    document.getElementById('dash-date').textContent = Utils.capitalize(Utils.formatDateLong(Utils.todayISO()));

    const { pct, done, total } = Habits.pctToday();
    const fin = Finance.currentMonthSummary();
    const activeProjects = Calendar.items.filter(i => i.tipo === 'proyecto' && i.estado !== 'completado');
    const topProject = activeProjects[0];

    const wrap = document.getElementById('dash-summary-rows');
    wrap.innerHTML = '';
    const rows = [
      ['Hábitos hoy', `${done} / ${total} (${pct}%)`, null],
      ['Balance del mes', Utils.money(fin.balance), fin.balance >= 0 ? 'pos' : 'neg'],
      ['Ahorro acumulado', Utils.money(this.totalSavings()), 'pos'],
    ];
    if (topProject) rows.push([`Proyecto: ${topProject.nombre}`, this.projectProgress(topProject) + '%', null]);

    rows.forEach(([k,v,cls]) => {
      wrap.appendChild(Utils.el(`<div class="dash-summary-row"><span class="k">${Utils.escapeHtml(k)}</span><span class="v ${cls||''}">${v}</span></div>`));
    });
  },

  totalSavings() {
    // sum of balances in accounts flagged/used as saving destinations via ahorro transactions
    const destAccounts = new Set(Finance.transactions.filter(t => t.tipo === 'ahorro').map(t => t.cuentaDestino));
    let total = 0;
    destAccounts.forEach(accId => { total += Finance.accountBalance(accId); });
    return total;
  },

  projectProgress(p) {
    const allTasks = (p.fases || []).flatMap(f => f.tasks || []);
    if (!allTasks.length) return 0;
    return Math.round((allTasks.filter(t => t.completada).length / allTasks.length) * 100);
  },

  renderHabitsBlock() {
    const habits = Habits.activeHabits();
    const iso = Utils.todayISO();
    let best = null, worst = null;
    habits.forEach(h => {
      const s = Habits.computeStreak(h);
      if (!best || s.current > Habits.computeStreak(best).current) best = h;
      if (!worst || s.current < Habits.computeStreak(worst).current) worst = h;
    });

    const weekPct = this.weeklyHabitPct();
    const monthPct = this.monthlyHabitPct();

    document.getElementById('dash-habits-stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="val">${weekPct}%</div><div class="lbl">Cumplimiento semanal</div></div>
        <div class="stat-box"><div class="val">${monthPct}%</div><div class="lbl">Cumplimiento mensual</div></div>
        <div class="stat-box"><div class="val">${best ? Utils.escapeHtml(best.nombre) : '—'}</div><div class="lbl">Mejor hábito</div></div>
        <div class="stat-box"><div class="val">${habits.filter(h=>h.archivado).length + Habits.list.filter(h=>h.archivado).length}</div><div class="lbl">Archivados</div></div>
      </div>
    `;
  },

  weeklyHabitPct() {
    const start = Utils.startOfWeek(Utils.todayISO());
    let total = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const iso = Utils.addDays(start, i);
      if (iso > Utils.todayISO()) break;
      Habits.activeHabits().forEach(h => { total++; if (Habits.isCompletedOnDate(h, iso)) done++; });
    }
    return total ? Math.round((done/total)*100) : 0;
  },

  monthlyHabitPct() {
    const today = Utils.todayISO();
    const monthStart = today.slice(0,7) + '-01';
    let total = 0, done = 0;
    let cursor = monthStart;
    while (cursor <= today) {
      Habits.activeHabits().forEach(h => { total++; if (Habits.isCompletedOnDate(h, cursor)) done++; });
      cursor = Utils.addDays(cursor, 1);
    }
    return total ? Math.round((done/total)*100) : 0;
  },

  renderFinanceBlock() {
    const fin = Finance.currentMonthSummary();
    document.getElementById('dash-finance-stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="val">${Utils.money(fin.ingresos)}</div><div class="lbl">Ingresos del mes</div></div>
        <div class="stat-box"><div class="val">${Utils.money(fin.gastos)}</div><div class="lbl">Gastos del mes</div></div>
      </div>
    `;
    // category pie
    const gastos = Finance.transactions.filter(t => t.tipo === 'gasto');
    const byCat = {};
    gastos.forEach(t => {
      const cat = Finance.categories.find(c => c.id === t.categoria);
      const name = cat ? cat.nombre : 'Otros';
      byCat[name] = (byCat[name] || 0) + t.valor;
    });
    const palette = ['#4F46E5','#14B8A6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#22C55E','#0EA5E9','#F97316'];
    const pieData = Object.entries(byCat).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
    Charts.pie(document.getElementById('dash-chart-categories'), pieData);

    // last 6 months bar (balance)
    const now = new Date();
    const barData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const txs = Finance.monthTransactions(d.getFullYear(), d.getMonth());
      const bal = txs.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.valor,0) - txs.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.valor,0);
      barData.push({ label: Utils.monthName(d.getMonth()).slice(0,3), value: Math.max(bal,0), color: '#4F46E5' });
    }
    Charts.bar(document.getElementById('dash-chart-months'), barData);

    // savings evolution line
    const lineData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cutoff = Utils.dateToISO(new Date(d.getFullYear(), d.getMonth()+1, 0));
      const destAccounts = new Set(Finance.transactions.filter(t => t.tipo === 'ahorro' && t.fecha <= cutoff).map(t => t.cuentaDestino));
      let total = 0;
      destAccounts.forEach(accId => {
        Finance.transactions.filter(t => t.fecha <= cutoff).forEach(t => {
          if (t.tipo === 'ahorro' && t.cuentaDestino === accId) total += t.valor;
        });
      });
      lineData.push({ label: Utils.monthName(d.getMonth()).slice(0,3), value: total });
    }
    Charts.line(document.getElementById('dash-chart-savings'), lineData, { color: '#14B8A6' });

    // gastos hormiga
    const hormiga = gastos.filter(t => t.esHormiga);
    const hormigaTotal = hormiga.reduce((s,t)=>s+t.valor,0);
    const pctHormiga = fin.gastos ? Math.round((hormigaTotal/fin.gastos)*100) : 0;
    document.getElementById('dash-hormiga-stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="val">${Utils.money(hormigaTotal)}</div><div class="lbl">Gastos hormiga (mes)</div></div>
        <div class="stat-box"><div class="val">${pctHormiga}%</div><div class="lbl">Sobre el total</div></div>
      </div>
    `;
  },

  renderProjectsBlock() {
    const projects = Calendar.items.filter(i => i.tipo === 'proyecto');
    const active = projects.filter(p => p.estado !== 'completado');
    const done = projects.filter(p => p.estado === 'completado');
    const avgProgress = projects.length ? Math.round(projects.reduce((s,p)=>s+this.projectProgress(p),0)/projects.length) : 0;
    document.getElementById('dash-projects-stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="val">${active.length}</div><div class="lbl">Proyectos activos</div></div>
        <div class="stat-box"><div class="val">${done.length}</div><div class="lbl">Finalizados</div></div>
        <div class="stat-box"><div class="val">${avgProgress}%</div><div class="lbl">Avance promedio</div></div>
        <div class="stat-box"><div class="val">${projects[0] ? Utils.escapeHtml(projects[0].nombre) : '—'}</div><div class="lbl">Más reciente</div></div>
      </div>
    `;
  },

  renderGlobalGithub() {
    const wrap = document.getElementById('dash-gh-global');
    wrap.innerHTML = '';
    const days = 140;
    const habits = Habits.activeHabits();
    for (let i = days; i >= 0; i--) {
      const iso = Utils.addDays(Utils.todayISO(), -i);
      let level = 0;
      if (habits.length) {
        const doneCount = habits.filter(h => Habits.isCompletedOnDate(h, iso)).length;
        const pct = doneCount / habits.length;
        if (pct === 0) level = 0;
        else if (pct < 0.4) level = 1;
        else if (pct < 0.7) level = 2;
        else if (pct < 0.9) level = 3;
        else level = 4;
      }
      wrap.appendChild(Utils.el(`<div class="gh-cell" data-level="${level}" title="${iso}"></div>`));
    }
  },

  renderComparisons() {
    const wrap = document.getElementById('dash-comparisons');
    const now = new Date();
    let curLabel, prevLabel, curFin, prevFin, curHabitsPct, prevHabitsPct;

    if (this.compareRange === 'week') {
      curLabel = 'Esta semana'; prevLabel = 'Semana anterior';
      const curStart = Utils.startOfWeek(Utils.todayISO());
      const prevStart = Utils.addDays(curStart, -7);
      curFin = this.finRange(curStart, Utils.todayISO());
      prevFin = this.finRange(prevStart, Utils.addDays(prevStart, 6));
      curHabitsPct = this.habitsRangePct(curStart, Utils.todayISO());
      prevHabitsPct = this.habitsRangePct(prevStart, Utils.addDays(prevStart, 6));
    } else if (this.compareRange === 'month') {
      curLabel = 'Este mes'; prevLabel = 'Mes anterior';
      const curTx = Finance.monthTransactions(now.getFullYear(), now.getMonth());
      const prevM = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const prevTx = Finance.monthTransactions(prevM.getFullYear(), prevM.getMonth());
      curFin = this.sumFin(curTx); prevFin = this.sumFin(prevTx);
      const curStart = now.toISOString().slice(0,7)+'-01';
      curHabitsPct = this.habitsRangePct(curStart, Utils.todayISO());
      const prevStart = Utils.dateToISO(prevM);
      const prevEnd = Utils.dateToISO(new Date(now.getFullYear(), now.getMonth(), 0));
      prevHabitsPct = this.habitsRangePct(prevStart, prevEnd);
    } else {
      curLabel = 'Este año'; prevLabel = 'Año anterior';
      const curTx = Finance.transactions.filter(t => Utils.isoToDate(t.fecha).getFullYear() === now.getFullYear());
      const prevTx = Finance.transactions.filter(t => Utils.isoToDate(t.fecha).getFullYear() === now.getFullYear()-1);
      curFin = this.sumFin(curTx); prevFin = this.sumFin(prevTx);
      curHabitsPct = this.habitsRangePct(now.getFullYear()+'-01-01', Utils.todayISO());
      prevHabitsPct = this.habitsRangePct((now.getFullYear()-1)+'-01-01', (now.getFullYear()-1)+'-12-31');
    }

    wrap.innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="val">${Utils.money(curFin.balance)}</div><div class="lbl">Balance · ${curLabel}</div></div>
        <div class="stat-box"><div class="val">${Utils.money(prevFin.balance)}</div><div class="lbl">Balance · ${prevLabel}</div></div>
        <div class="stat-box"><div class="val">${curHabitsPct}%</div><div class="lbl">Hábitos · ${curLabel}</div></div>
        <div class="stat-box"><div class="val">${prevHabitsPct}%</div><div class="lbl">Hábitos · ${prevLabel}</div></div>
      </div>
    `;
  },

  finRange(startIso, endIso) {
    const tx = Finance.transactions.filter(t => t.fecha >= startIso && t.fecha <= endIso);
    return this.sumFin(tx);
  },
  sumFin(tx) {
    const ingresos = tx.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.valor,0);
    const gastos = tx.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.valor,0);
    return { ingresos, gastos, balance: ingresos - gastos };
  },
  habitsRangePct(startIso, endIso) {
    let total = 0, done = 0;
    let cursor = startIso;
    const today = Utils.todayISO();
    const end = endIso > today ? today : endIso;
    while (cursor <= end) {
      Habits.activeHabits().forEach(h => { total++; if (Habits.isCompletedOnDate(h, cursor)) done++; });
      cursor = Utils.addDays(cursor, 1);
    }
    return total ? Math.round((done/total)*100) : 0;
  },

  setCompareRange(range) {
    this.compareRange = range;
    document.querySelectorAll('#dash-compare-toggle button').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    this.renderComparisons();
  },

  // ---------- PDF export ----------
  async exportPDF() {
    const hasData = Habits.list.length || Finance.transactions.length || Calendar.items.length;
    if (!hasData) { Utils.toast('Aún no hay datos suficientes para exportar'); return; }
    Utils.toast('Generando PDF…');

    const win = window.open('', '_blank');
    const fin = Finance.currentMonthSummary();
    const iso = Utils.todayISO();
    const habitsToday = Habits.pctToday();

    const html = `
      <html><head><meta charset="utf-8"><title>BetterME — Reporte</title>
      <style>
        body { font-family: -apple-system, Arial, sans-serif; padding: 40px; color: #1E1B3A; }
        h1 { color: #4F46E5; }
        .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee; }
        .section { margin-top:28px; }
        .badge { color:#4F46E5; font-weight:bold; }
      </style></head>
      <body>
        <h1>BetterME — Reporte General</h1>
        <p>Generado el ${Utils.formatDateLong(iso)}</p>
        <div class="section">
          <h2>Resumen general</h2>
          <div class="row"><span>Hábitos completados hoy</span><span class="badge">${habitsToday.done} / ${habitsToday.total} (${habitsToday.pct}%)</span></div>
          <div class="row"><span>Balance del mes</span><span class="badge">${Utils.money(fin.balance)}</span></div>
          <div class="row"><span>Ahorro acumulado</span><span class="badge">${Utils.money(this.totalSavings())}</span></div>
        </div>
        <div class="section">
          <h2>Finanzas</h2>
          <div class="row"><span>Ingresos del mes</span><span>${Utils.money(fin.ingresos)}</span></div>
          <div class="row"><span>Gastos del mes</span><span>${Utils.money(fin.gastos)}</span></div>
        </div>
        <div class="section">
          <h2>Proyectos</h2>
          ${Calendar.items.filter(i=>i.tipo==='proyecto').map(p => `<div class="row"><span>${Utils.escapeHtml(p.nombre)}</span><span>${this.projectProgress(p)}%</span></div>`).join('') || '<p>Sin proyectos registrados.</p>'}
        </div>
        <script>window.print();</script>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  }
};
