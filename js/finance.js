// ============================================
// BetterME — Módulo de Finanzas
// ============================================

const DEFAULT_CATEGORIES = {
  gasto: ['Alimentación','Transporte','Vivienda','Salud','Educación','Entretenimiento','Compras','Servicios','Otros'],
  ingreso: ['Salario','Freelance','Venta','Regalo','Inversión','Otros']
};
const ACCOUNT_COLORS = ['#4F46E5','#14B8A6','#F59E0B','#EC4899'];

const Finance = {
  accounts: [], transactions: [], categories: [], budgets: [], goals: [], debts: [], receivables: [], frequent: [], wishlist: [],
  activeTab: 'movimientos',
  wishlistPlan: { mode: null, fecha: '', mensual: null },

  async init() {
    this.accounts = await DB.getAll('accounts');
    this.transactions = await DB.getAll('transactions');
    this.categories = await DB.getAll('categories');
    this.budgets = await DB.getAll('budgets');
    this.goals = await DB.getAll('savingGoals');
    this.debts = await DB.getAll('debts');
    this.receivables = await DB.getAll('receivables');
    this.frequent = await DB.getAll('frequentExpenses');
    this.wishlist = await DB.getAll('wishlist');
    this.wishlistPlan = await DB.getSetting('wishlistPlan', { mode: null, fecha: '', mensual: null });

    if (this.accounts.length === 0) {
      const def = { id: DB.uuid(), nombre: 'Cuenta Principal', color: ACCOUNT_COLORS[0], saldoInicial: 0 };
      await DB.put('accounts', def);
      this.accounts.push(def);
    }
    if (this.categories.length === 0) {
      const cats = [];
      DEFAULT_CATEGORIES.gasto.forEach(n => cats.push({ id: DB.uuid(), nombre: n, tipo: 'gasto' }));
      DEFAULT_CATEGORIES.ingreso.forEach(n => cats.push({ id: DB.uuid(), nombre: n, tipo: 'ingreso' }));
      await DB.bulkPut('categories', cats);
      this.categories = cats;
    }
    this.render();
  },

  // ---------- Balance calculations ----------
  accountBalance(accountId) {
    const acc = this.accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    let bal = acc.saldoInicial || 0;
    this.transactions.forEach(t => {
      if (t.cuenta === accountId) {
        if (t.tipo === 'ingreso') bal += t.valor;
        else if (t.tipo === 'gasto') bal -= t.valor;
        else if (t.tipo === 'ahorro') bal -= t.valor; // outgoing transfer
        else if (t.tipo === 'cobro_recibido') bal += t.valor;
      }
      if (t.tipo === 'ahorro' && t.cuentaDestino === accountId) bal += t.valor;
    });
    return bal;
  },

  monthTransactions(year, month) {
    return this.transactions.filter(t => {
      const d = Utils.isoToDate(t.fecha);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  currentMonthSummary() {
    const now = new Date();
    const txs = this.monthTransactions(now.getFullYear(), now.getMonth());
    const ingresos = txs.filter(t => t.tipo === 'ingreso').reduce((s,t) => s + t.valor, 0);
    const gastos = txs.filter(t => t.tipo === 'gasto').reduce((s,t) => s + t.valor, 0);
    return { ingresos, gastos, balance: ingresos - gastos };
  },

  currentMonthBudget() {
    const key = Utils.todayISO().slice(0,7);
    return this.budgets.find(b => b.tipo === 'mensual' && b.mes === key);
  },

  render() {
    const { ingresos, gastos, balance } = this.currentMonthSummary();
    document.getElementById('fin-balance-total').textContent = Utils.money(balance);
    document.getElementById('fin-ingresos').textContent = '+ ' + Utils.money(ingresos);
    document.getElementById('fin-gastos').textContent = '- ' + Utils.money(gastos);

    const budget = this.currentMonthBudget();
    const budgetSection = document.getElementById('fin-budget-section');
    if (budget) {
      const pct = Utils.clampPct(Math.round((gastos / budget.monto) * 100));
      budgetSection.classList.remove('hidden');
      document.getElementById('fin-budget-pct').textContent = pct + '%';
      const fill = document.getElementById('fin-budget-fill');
      fill.style.width = pct + '%';
      fill.className = 'progress-fill' + (pct >= 100 ? ' danger' : pct >= 90 ? ' warn' : '');
    } else {
      budgetSection.classList.add('hidden');
    }

    // accounts scroller
    const accWrap = document.getElementById('fin-accounts-scroll');
    accWrap.innerHTML = '';
    this.accounts.forEach((a, i) => {
      const chip = Utils.el(`
        <div class="account-chip" style="background:${a.color || ACCOUNT_COLORS[i % 4]}">
          <div class="name">${Utils.escapeHtml(a.nombre)}</div>
          <div class="bal">${Utils.money(this.accountBalance(a.id))}</div>
        </div>
      `);
      chip.onclick = () => this.openAccountForm(a);
      accWrap.appendChild(chip);
    });
    const addAcc = Utils.el(`<div class="account-chip" style="background:var(--surface);color:var(--indigo);display:flex;align-items:center;justify-content:center;border:1.5px dashed var(--indigo-soft);">+ Cuenta</div>`);
    addAcc.onclick = () => this.openAccountForm();
    if (this.accounts.length < 4) accWrap.appendChild(addAcc);

    this.renderTabContent();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('#fin-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    this.renderTabContent();
  },

  renderTabContent() {
    const wrap = document.getElementById('fin-tab-content');
    wrap.innerHTML = '';
    if (this.activeTab === 'movimientos') this.renderMovimientos(wrap);
    else if (this.activeTab === 'ahorros') this.renderAhorros(wrap);
    else if (this.activeTab === 'deudas') this.renderDeudas(wrap);
    else if (this.activeTab === 'frecuentes') this.renderFrecuentes(wrap);
    else if (this.activeTab === 'deseos') this.renderWishlist(wrap);
  },

  renderMovimientos(wrap) {
    const sorted = [...this.transactions].sort((a,b) => b.fecha.localeCompare(a.fecha));
    if (!sorted.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">💸</div><div class="title">Sin movimientos</div><div>Registra tu primer ingreso o gasto.</div></div>`;
      return;
    }
    const card = Utils.el('<div class="card"></div>');
    sorted.slice(0, 60).forEach(t => {
      const cat = this.categories.find(c => c.id === t.categoria);
      const icons = { ingreso: '💰', gasto: '🛒', ahorro: '🏦', deuda: '📄', cobro: '🤝' };
      const row = Utils.el(`
        <div class="movement-row">
          <div class="mv-icon" style="background:${t.tipo === 'ingreso' ? '#DCFCE7' : 'var(--indigo-tint)'}">${icons[t.tipo] || '•'}</div>
          <div class="mv-info">
            <div class="name">${Utils.escapeHtml(t.descripcion || (cat ? cat.nombre : t.tipo))}${t.esHormiga ? ' 🐜' : ''}</div>
            <div class="cat">${cat ? Utils.escapeHtml(cat.nombre) : ''} · ${Utils.formatDateShort(t.fecha)}</div>
          </div>
          <div class="mv-amount ${t.tipo === 'ingreso' ? 'income' : 'expense'}">${t.tipo === 'ingreso' ? '+' : '-'}${Utils.money(t.valor)}</div>
        </div>
      `);
      row.onclick = () => this.openMovementForm(t.tipo, t);
      card.appendChild(row);
    });
    wrap.appendChild(card);
  },

  renderAhorros(wrap) {
    if (!this.goals.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">🎯</div><div class="title">Sin metas de ahorro</div><div>Crea una meta desde el botón +.</div></div>`;
      return;
    }
    this.goals.forEach(g => {
      const bal = this.accountBalance(g.cuenta);
      const pct = Utils.clampPct(Math.round((bal / g.objetivo) * 100));
      const card = Utils.el(`
        <div class="card" style="margin-bottom:12px;">
          <div class="flex-between"><strong>${Utils.escapeHtml(g.nombre)}</strong><span style="font-weight:700;color:var(--indigo);">${pct}%</span></div>
          <div class="progress-track" style="margin:10px 0 6px;"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:12.5px;color:var(--gray);">${Utils.money(Math.max(bal,0))} / ${Utils.money(g.objetivo)}</div>
        </div>
      `);
      card.onclick = () => this.openGoalForm(g);
      wrap.appendChild(card);
    });
  },

  renderDeudas(wrap) {
    const section = (title, list, kind) => {
      const h = Utils.el(`<div class="section-title" style="margin-top:14px;">${title}</div>`);
      wrap.appendChild(h);
      if (!list.length) {
        wrap.appendChild(Utils.el(`<p style="font-size:13px;color:var(--gray);padding:0 4px;">Sin registros.</p>`));
        return;
      }
      list.forEach(d => {
        const pagado = (d.pagos || []).reduce((s,p) => s + p.valor, 0);
        const pendiente = d.valorInicial - pagado;
        const card = Utils.el(`
          <div class="card" style="margin-bottom:10px;">
            <div class="flex-between"><strong>${Utils.escapeHtml(d.nombre)}</strong><span style="font-size:12px;font-weight:700;color:${d.estado === 'pendiente' ? 'var(--red)' : 'var(--green)'}">${d.estado === 'pendiente' ? 'Pendiente' : (kind === 'debt' ? 'Pagada' : 'Cobrada')}</span></div>
            <div class="stat-grid" style="margin-top:8px;">
              <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(pagado)}</div><div class="lbl">${kind === 'debt' ? 'Pagado' : 'Recibido'}</div></div>
              <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(Math.max(pendiente,0))}</div><div class="lbl">Pendiente</div></div>
            </div>
          </div>
        `);
        card.onclick = () => this.openDebtDetail(d, kind);
        wrap.appendChild(card);
      });
    };
    section('Deudas', this.debts, 'debt');
    section('Cuentas por cobrar', this.receivables, 'receivable');
  },

  renderFrecuentes(wrap) {
    if (!this.frequent.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">⚡</div><div class="title">Sin gastos frecuentes</div><div>Agrega accesos rápidos como "Café" o "Transporte".</div></div>`;
      return;
    }
    this.frequent.forEach(f => {
      const row = Utils.el(`
        <div class="movement-row">
          <div class="mv-icon" style="background:var(--indigo-tint);">⚡</div>
          <div class="mv-info"><div class="name">${Utils.escapeHtml(f.nombre)}</div><div class="cat">${Utils.money(f.valor)}</div></div>
          <button class="btn btn-secondary" style="padding:8px 14px;font-size:13px;">Registrar</button>
        </div>
      `);
      row.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        this.openMovementForm('gasto', { descripcion: f.nombre, valor: f.valor, categoria: f.categoria, fecha: Utils.todayISO() }, true);
      };
      row.onclick = async () => {
        const ok = await Utils.confirmDialog(`¿Eliminar "${f.nombre}" de gastos frecuentes?`, 'Eliminar');
        if (ok) { await DB.delete('frequentExpenses', f.id); this.frequent = this.frequent.filter(x => x.id !== f.id); this.render(); }
      };
      wrap.appendChild(row);
    });
  },

  // ---------- Floating menu ----------
  openTypeMenu() {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Crear</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-secondary btn-block" data-t="ingreso">💰 Ingreso</button>
          <button class="btn btn-secondary btn-block" data-t="gasto">🛒 Gasto</button>
          <button class="btn btn-secondary btn-block" data-t="ahorro">🏦 Ahorro</button>
          <button class="btn btn-secondary btn-block" data-t="deseo">✨ Deseo (wishlist)</button>
          <button class="btn btn-secondary btn-block" data-t="deuda">📄 Deuda</button>
          <button class="btn btn-secondary btn-block" data-t="cobrar">🤝 Cuenta por cobrar</button>
        </div>
      </div>
    `);
    wrap.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      Utils.closeSheet();
      setTimeout(() => {
        if (b.dataset.t === 'deuda') this.openDebtForm('debt');
        else if (b.dataset.t === 'cobrar') this.openDebtForm('receivable');
        else if (b.dataset.t === 'ahorro') this.openTransferForm();
        else if (b.dataset.t === 'deseo') this.openWishlistForm();
        else this.openMovementForm(b.dataset.t);
      }, 200);
    });
    Utils.openSheet(wrap);
  },

  openMovementForm(tipo, prefill = {}, autoSave = false) {
    const t = Object.assign({ id: DB.uuid(), tipo, valor: '', fecha: Utils.todayISO(), categoria: '', cuenta: this.accounts[0]?.id, descripcion: '', esHormiga: false }, prefill);
    const isEdit = !!prefill.id;
    const cats = this.categories.filter(c => c.tipo === tipo || tipo === 'gasto');

    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar' : 'Nuevo'} ${tipo === 'ingreso' ? 'ingreso' : 'gasto'}</div>
        <div class="field"><label>Valor (COP)</label><input type="number" id="mf-valor" min="1" placeholder="0"></div>
        <div class="field"><label>Categoría</label><select id="mf-cat"></select></div>
        <div class="field"><label>Cuenta</label><select id="mf-cuenta"></select></div>
        <div class="field"><label>Fecha</label><input type="date" id="mf-fecha"></div>
        <div class="field"><label>Descripción (opcional)</label><input type="text" id="mf-desc"></div>
        ${tipo === 'gasto' ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:14px;"><input type="checkbox" id="mf-hormiga" style="width:auto;"> Marcar como gasto hormiga</label></div>` : ''}
        <div class="sheet-actions">
          ${isEdit ? `<button class="btn btn-danger" id="mf-delete">Eliminar</button>` : `<button class="btn btn-ghost" id="mf-cancel">Cancelar</button>`}
          <button class="btn btn-primary" id="mf-save">Guardar</button>
        </div>
      </div>
    `);

    const catSel = wrap.querySelector('#mf-cat');
    cats.forEach(c => catSel.appendChild(Utils.el(`<option value="${c.id}">${Utils.escapeHtml(c.nombre)}</option>`)));
    if (t.categoria) catSel.value = t.categoria;

    const accSel = wrap.querySelector('#mf-cuenta');
    this.accounts.forEach(a => accSel.appendChild(Utils.el(`<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`)));
    if (t.cuenta) accSel.value = t.cuenta;

    wrap.querySelector('#mf-valor').value = t.valor || '';
    wrap.querySelector('#mf-fecha').value = t.fecha;
    wrap.querySelector('#mf-desc').value = t.descripcion || '';
    if (tipo === 'gasto') wrap.querySelector('#mf-hormiga').checked = !!t.esHormiga;

    if (isEdit) {
      wrap.querySelector('#mf-delete').onclick = async () => {
        const ok = await Utils.confirmDialog('¿Eliminar este movimiento?', 'Eliminar');
        if (ok) {
          await DB.delete('transactions', t.id);
          this.transactions = this.transactions.filter(x => x.id !== t.id);
          Utils.toast('Movimiento eliminado');
          this.render();
        }
      };
    } else {
      wrap.querySelector('#mf-cancel').onclick = () => Utils.closeSheet();
    }

    const doSave = async () => {
      const valor = parseFloat(wrap.querySelector('#mf-valor').value);
      if (!valor || valor <= 0) { Utils.toast('Ingresa un valor válido'); return; }
      const fecha = wrap.querySelector('#mf-fecha').value;
      if (!fecha) { Utils.toast('Selecciona una fecha'); return; }
      t.valor = valor; t.fecha = fecha;
      t.categoria = catSel.value; t.cuenta = accSel.value;
      t.descripcion = wrap.querySelector('#mf-desc').value.trim();
      if (tipo === 'gasto') t.esHormiga = wrap.querySelector('#mf-hormiga').checked;
      await DB.put('transactions', t);
      if (!isEdit) this.transactions.push(t);
      Utils.closeSheet();
      Utils.toast('Guardado');
      this.render();
    };

    wrap.querySelector('#mf-save').onclick = doSave;
    if (autoSave) { Utils.openSheet(wrap); return; }
    Utils.openSheet(wrap);
  },

  openTransferForm() {
    if (this.accounts.length < 2) { Utils.toast('Necesitas al menos 2 cuentas para transferir a ahorro'); return; }
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Nuevo ahorro</div>
        <div class="field"><label>Valor (COP)</label><input type="number" id="tf-valor" min="1"></div>
        <div class="field"><label>Cuenta origen</label><select id="tf-origen"></select></div>
        <div class="field"><label>Cuenta destino</label><select id="tf-destino"></select></div>
        <div class="field"><label>Fecha</label><input type="date" id="tf-fecha"></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="tf-cancel">Cancelar</button>
          <button class="btn btn-primary" id="tf-save">Guardar</button>
        </div>
      </div>
    `);
    const oSel = wrap.querySelector('#tf-origen'), dSel = wrap.querySelector('#tf-destino');
    this.accounts.forEach(a => { oSel.appendChild(Utils.el(`<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`)); dSel.appendChild(Utils.el(`<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`)); });
    dSel.selectedIndex = 1;
    wrap.querySelector('#tf-fecha').value = Utils.todayISO();
    wrap.querySelector('#tf-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#tf-save').onclick = async () => {
      const valor = parseFloat(wrap.querySelector('#tf-valor').value);
      if (!valor || valor <= 0) { Utils.toast('Ingresa un valor válido'); return; }
      if (oSel.value === dSel.value) { Utils.toast('Las cuentas deben ser diferentes'); return; }
      const t = { id: DB.uuid(), tipo: 'ahorro', valor, cuenta: oSel.value, cuentaDestino: dSel.value, fecha: wrap.querySelector('#tf-fecha').value, descripcion: 'Transferencia a ahorro' };
      await DB.put('transactions', t);
      this.transactions.push(t);
      Utils.closeSheet();
      Utils.toast('Ahorro registrado');
      this.render();
    };
    Utils.openSheet(wrap);
  },

  openAccountForm(existing = null) {
    const a = existing || { id: DB.uuid(), nombre: '', color: ACCOUNT_COLORS[this.accounts.length % 4], saldoInicial: 0 };
    const isEdit = !!existing;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar cuenta' : 'Nueva cuenta'}</div>
        <div class="field"><label>Nombre</label><input type="text" id="af-nombre"></div>
        ${!isEdit ? `<div class="field"><label>Saldo inicial</label><input type="number" id="af-saldo" value="0"></div>` : ''}
        <div class="field"><label>Color</label><div class="color-swatch-group" id="af-color"></div></div>
        <div class="sheet-actions">
          ${isEdit ? `<button class="btn btn-danger" id="af-delete">Eliminar</button>` : `<button class="btn btn-ghost" id="af-cancel">Cancelar</button>`}
          <button class="btn btn-primary" id="af-save">Guardar</button>
        </div>
      </div>
    `);
    wrap.querySelector('#af-nombre').value = a.nombre;
    const colorGroup = wrap.querySelector('#af-color');
    ACCOUNT_COLORS.forEach(c => {
      const sw = Utils.el(`<div class="color-swatch ${c === a.color ? 'active' : ''}" style="background:${c}"></div>`);
      sw.onclick = () => { [...colorGroup.children].forEach(x => x.classList.remove('active')); sw.classList.add('active'); };
      colorGroup.appendChild(sw);
    });

    if (isEdit) {
      wrap.querySelector('#af-delete').onclick = async () => {
        const hasMovs = this.transactions.some(t => t.cuenta === a.id || t.cuentaDestino === a.id);
        if (hasMovs) { Utils.toast('No puedes eliminar una cuenta con movimientos'); return; }
        const ok = await Utils.confirmDialog(`¿Eliminar cuenta "${a.nombre}"?`, 'Eliminar');
        if (ok) {
          await DB.delete('accounts', a.id);
          this.accounts = this.accounts.filter(x => x.id !== a.id);
          Utils.toast('Cuenta eliminada');
          this.render();
        }
      };
    } else {
      wrap.querySelector('#af-cancel').onclick = () => Utils.closeSheet();
    }

    wrap.querySelector('#af-save').onclick = async () => {
      const nombre = wrap.querySelector('#af-nombre').value.trim();
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      a.nombre = nombre;
      const activeSw = colorGroup.querySelector('.active');
      if (activeSw) a.color = ACCOUNT_COLORS.find(c => activeSw.style.background.includes(c.slice(1))) || a.color;
      if (!isEdit) a.saldoInicial = parseFloat(wrap.querySelector('#af-saldo').value) || 0;
      await DB.put('accounts', a);
      if (!isEdit) this.accounts.push(a);
      Utils.closeSheet();
      Utils.toast('Cuenta guardada');
      this.render();
    };
    Utils.openSheet(wrap);
  },

  openGoalForm(existing = null) {
    const g = existing || { id: DB.uuid(), nombre: '', objetivo: '', fechaLimite: '', cuenta: this.accounts[0]?.id };
    const isEdit = !!existing;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${isEdit ? 'Editar meta' : 'Nueva meta de ahorro'}</div>
        <div class="field"><label>Nombre</label><input type="text" id="gf-nombre"></div>
        <div class="field"><label>Objetivo (COP)</label><input type="number" id="gf-objetivo" min="1"></div>
        <div class="field"><label>Fecha límite (opcional)</label><input type="date" id="gf-fecha"></div>
        <div class="field"><label>Cuenta asociada</label><select id="gf-cuenta"></select></div>
        <div class="sheet-actions">
          ${isEdit ? `<button class="btn btn-danger" id="gf-delete">Eliminar</button>` : `<button class="btn btn-ghost" id="gf-cancel">Cancelar</button>`}
          <button class="btn btn-primary" id="gf-save">Guardar</button>
        </div>
      </div>
    `);
    wrap.querySelector('#gf-nombre').value = g.nombre;
    wrap.querySelector('#gf-objetivo').value = g.objetivo || '';
    wrap.querySelector('#gf-fecha').value = g.fechaLimite || '';
    const sel = wrap.querySelector('#gf-cuenta');
    this.accounts.forEach(a => sel.appendChild(Utils.el(`<option value="${a.id}">${Utils.escapeHtml(a.nombre)}</option>`)));
    if (g.cuenta) sel.value = g.cuenta;

    if (isEdit) {
      wrap.querySelector('#gf-delete').onclick = async () => {
        await DB.delete('savingGoals', g.id);
        this.goals = this.goals.filter(x => x.id !== g.id);
        Utils.closeSheet(); Utils.toast('Meta eliminada'); this.render();
      };
    } else {
      wrap.querySelector('#gf-cancel').onclick = () => Utils.closeSheet();
    }
    wrap.querySelector('#gf-save').onclick = async () => {
      const nombre = wrap.querySelector('#gf-nombre').value.trim();
      const objetivo = parseFloat(wrap.querySelector('#gf-objetivo').value);
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      if (!objetivo || objetivo <= 0) { Utils.toast('El objetivo debe ser mayor a cero'); return; }
      g.nombre = nombre; g.objetivo = objetivo;
      g.fechaLimite = wrap.querySelector('#gf-fecha').value;
      g.cuenta = sel.value;
      await DB.put('savingGoals', g);
      if (!isEdit) this.goals.push(g);
      Utils.closeSheet(); Utils.toast('Meta guardada'); this.render();
    };
    Utils.openSheet(wrap);
  },

  openDebtForm(kind) {
    const store = kind === 'debt' ? 'debts' : 'receivables';
    const label = kind === 'debt' ? 'Acreedor' : 'Nombre';
    const d = { id: DB.uuid(), nombre: '', valorInicial: '', fecha: Utils.todayISO(), estado: 'pendiente', pagos: [] };
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${kind === 'debt' ? 'Nueva deuda' : 'Nueva cuenta por cobrar'}</div>
        <div class="field"><label>${label}</label><input type="text" id="df-nombre"></div>
        <div class="field"><label>Valor</label><input type="number" id="df-valor" min="1"></div>
        <div class="field"><label>Fecha</label><input type="date" id="df-fecha"></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="df-cancel">Cancelar</button>
          <button class="btn btn-primary" id="df-save">Guardar</button>
        </div>
      </div>
    `);
    wrap.querySelector('#df-fecha').value = d.fecha;
    wrap.querySelector('#df-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#df-save').onclick = async () => {
      const nombre = wrap.querySelector('#df-nombre').value.trim();
      const valor = parseFloat(wrap.querySelector('#df-valor').value);
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      if (!valor || valor <= 0) { Utils.toast('Ingresa un valor válido'); return; }
      d.nombre = nombre; d.valorInicial = valor; d.fecha = wrap.querySelector('#df-fecha').value;
      await DB.put(store, d);
      (kind === 'debt' ? this.debts : this.receivables).push(d);
      Utils.closeSheet(); Utils.toast('Guardado'); this.render();
    };
    Utils.openSheet(wrap);
  },

  openDebtDetail(d, kind) {
    const store = kind === 'debt' ? 'debts' : 'receivables';
    const pagado = (d.pagos || []).reduce((s,p) => s + p.valor, 0);
    const pendiente = d.valorInicial - pagado;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${Utils.escapeHtml(d.nombre)}</div>
        <div class="stat-grid">
          <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(d.valorInicial)}</div><div class="lbl">Valor total</div></div>
          <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(Math.max(pendiente,0))}</div><div class="lbl">Pendiente</div></div>
        </div>
        ${d.estado === 'pendiente' ? `
        <div class="field" style="margin-top:16px;"><label>${kind === 'debt' ? 'Registrar pago' : 'Registrar cobro'}</label><input type="number" id="dd-pago" min="1" max="${pendiente}"></div>
        <button class="btn btn-primary btn-block" id="dd-add-pago">${kind === 'debt' ? 'Registrar pago' : 'Registrar cobro'}</button>
        ` : `<p style="text-align:center;color:var(--green);font-weight:700;margin-top:16px;">✔ ${kind === 'debt' ? 'Pagada' : 'Cobrada'} completamente</p>`}
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" id="dd-delete">Eliminar registro</button>
      </div>
    `);
    if (d.estado === 'pendiente') {
      wrap.querySelector('#dd-add-pago').onclick = async () => {
        const val = parseFloat(wrap.querySelector('#dd-pago').value);
        if (!val || val <= 0) { Utils.toast('Ingresa un valor válido'); return; }
        d.pagos = d.pagos || [];
        d.pagos.push({ id: DB.uuid(), valor: val, fecha: Utils.todayISO() });
        const totalPagado = d.pagos.reduce((s,p) => s + p.valor, 0);
        if (totalPagado >= d.valorInicial) d.estado = kind === 'debt' ? 'pagada' : 'cobrada';
        await DB.put(store, d);
        Utils.closeSheet(); Utils.toast('Registrado'); this.render();
      };
    }
    wrap.querySelector('#dd-delete').onclick = async () => {
      const ok = await Utils.confirmDialog('¿Eliminar este registro?', 'Eliminar');
      if (ok) {
        await DB.delete(store, d.id);
        if (kind === 'debt') this.debts = this.debts.filter(x => x.id !== d.id);
        else this.receivables = this.receivables.filter(x => x.id !== d.id);
        Utils.closeSheet(); Utils.toast('Eliminado'); this.render();
      }
    };
    Utils.openSheet(wrap);
  },

  // ---------- Wishlist (ahorro guiado) ----------
  // Aggregate calculation: works on the TOTAL pending amount across every active wish, not per item.
  wishlistPending(item) {
    const aportado = (item.aportes || []).reduce((s, a) => s + a.valor, 0);
    return Math.max(0, item.valorObjetivo - aportado);
  },
  wishlistAportado(item) {
    return (item.aportes || []).reduce((s, a) => s + a.valor, 0);
  },
  wishlistTotalPending() {
    return this.wishlist.filter(w => w.estado !== 'completado').reduce((s, w) => s + this.wishlistPending(w), 0);
  },
  monthsBetween(fromIso, toIso) {
    const a = Utils.isoToDate(fromIso), b = Utils.isoToDate(toIso);
    let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) months -= 1;
    return Math.max(1, months);
  },

  renderWishlist(wrap) {
    const totalPending = this.wishlistTotalPending();
    const plan = this.wishlistPlan;

    const summary = Utils.el(`<div class="wishlist-summary"></div>`);
    if (!this.wishlist.length) {
      summary.innerHTML = `<div class="lbl">Ahorro guiado</div><div class="sub" style="margin-top:6px;">Agrega tu primer deseo para calcular cuánto ahorrar.</div>`;
    } else {
      let planHtml = `<div class="sub">Define un plan para ver cuánto ahorrar en total.</div>`;
      if (plan.mode === 'fecha' && plan.fecha) {
        const months = this.monthsBetween(Utils.todayISO(), plan.fecha);
        const monthly = totalPending / months;
        planHtml = `<div class="sub">Para lograr todo antes del ${Utils.formatDateShort(plan.fecha)}, ahorra <strong>${Utils.money(monthly)}/mes</strong> (${months} ${months === 1 ? 'mes' : 'meses'}).</div>`;
      } else if (plan.mode === 'mensual' && plan.mensual) {
        if (totalPending <= 0) {
          planHtml = `<div class="sub">¡Ya reuniste el total de tus deseos activos! 🎉</div>`;
        } else {
          const months = Math.ceil(totalPending / plan.mensual);
          const eta = Utils.dateToISO(new Date(new Date().setMonth(new Date().getMonth() + months)));
          planHtml = `<div class="sub">Ahorrando ${Utils.money(plan.mensual)}/mes, lograrás todos tus deseos en ~${months} ${months === 1 ? 'mes' : 'meses'} (${Utils.formatDateShort(eta)}).</div>`;
        }
      }
      summary.innerHTML = `
        <div class="lbl">Pendiente por ahorrar (todos tus deseos)</div>
        <div class="amt">${Utils.money(totalPending)}</div>
        ${planHtml}
      `;
    }
    wrap.appendChild(summary);

    const planBtn = Utils.el(`<button class="btn btn-secondary btn-block" style="margin-bottom:14px;">${plan.mode ? 'Editar plan de ahorro' : 'Configurar plan de ahorro'}</button>`);
    planBtn.onclick = () => this.openWishlistPlanForm();
    wrap.appendChild(planBtn);

    if (!this.wishlist.length) {
      wrap.appendChild(Utils.el(`<div class="empty-state"><div class="icon">✨</div><div class="title">Sin deseos aún</div><div>Agrega lo que quieres lograr desde el botón +.</div></div>`));
      return;
    }

    [...this.wishlist].sort((a,b) => (a.estado === 'completado') - (b.estado === 'completado')).forEach(w => {
      const aportado = this.wishlistAportado(w);
      const pct = Utils.clampPct(Math.round((aportado / w.valorObjetivo) * 100));
      const card = Utils.el(`
        <div class="wishlist-card ${w.estado === 'completado' ? 'completed' : ''}">
          <div class="flex-between"><strong>${w.estado === 'completado' ? '✔ ' : ''}${Utils.escapeHtml(w.nombre)}</strong><span style="font-weight:700;color:var(--teal);">${pct}%</span></div>
          <div class="progress-track" style="margin:8px 0 6px;"><div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--teal-soft),var(--teal));"></div></div>
          <div class="wl-meta">${Utils.money(aportado)} / ${Utils.money(w.valorObjetivo)}</div>
        </div>
      `);
      card.onclick = () => this.openWishlistDetail(w);
      wrap.appendChild(card);
    });
  },

  openWishlistPlanForm() {
    const plan = this.wishlistPlan;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Plan de ahorro guiado</div>
        <p style="font-size:12.5px;color:var(--gray);margin-top:-8px;">Este plan se calcula sobre la suma de todos tus deseos activos.</p>
        <div class="chip-group" id="wp-mode" style="margin-bottom:16px;">
          <div class="chip" data-v="fecha">Quiero lograrlo para una fecha</div>
          <div class="chip" data-v="mensual">Puedo ahorrar un monto fijo al mes</div>
        </div>
        <div class="field" id="wp-fecha-field"><label>Fecha límite</label><input type="date" id="wp-fecha"></div>
        <div class="field" id="wp-mensual-field"><label>Ahorro mensual disponible</label><input type="number" id="wp-mensual" min="1"></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="wp-cancel">Cancelar</button>
          <button class="btn btn-primary" id="wp-save">Guardar plan</button>
        </div>
      </div>
    `);
    const modeGroup = wrap.querySelector('#wp-mode');
    const showFields = (mode) => {
      wrap.querySelector('#wp-fecha-field').style.display = mode === 'fecha' ? 'block' : 'none';
      wrap.querySelector('#wp-mensual-field').style.display = mode === 'mensual' ? 'block' : 'none';
    };
    [...modeGroup.children].forEach(c => {
      c.classList.toggle('active', c.dataset.v === plan.mode);
      c.onclick = () => { [...modeGroup.children].forEach(x => x.classList.remove('active')); c.classList.add('active'); showFields(c.dataset.v); };
    });
    showFields(plan.mode);
    wrap.querySelector('#wp-fecha').value = plan.fecha || '';
    wrap.querySelector('#wp-mensual').value = plan.mensual || '';

    wrap.querySelector('#wp-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#wp-save').onclick = async () => {
      const mode = modeGroup.querySelector('.active')?.dataset.v;
      if (!mode) { Utils.toast('Elige una forma de calcular tu plan'); return; }
      if (mode === 'fecha') {
        const fecha = wrap.querySelector('#wp-fecha').value;
        if (!fecha || fecha <= Utils.todayISO()) { Utils.toast('Elige una fecha futura'); return; }
        this.wishlistPlan = { mode: 'fecha', fecha, mensual: null };
      } else {
        const mensual = parseFloat(wrap.querySelector('#wp-mensual').value);
        if (!mensual || mensual <= 0) { Utils.toast('Ingresa un monto válido'); return; }
        this.wishlistPlan = { mode: 'mensual', fecha: '', mensual };
      }
      await DB.setSetting('wishlistPlan', this.wishlistPlan);
      Utils.closeSheet();
      Utils.toast('Plan guardado');
      this.render();
    };
    Utils.openSheet(wrap);
  },

  openWishlistForm() {
    const w = { id: DB.uuid(), nombre: '', valorObjetivo: '', estado: 'activo', aportes: [], fechaCreacion: Utils.todayISO() };
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Nuevo deseo</div>
        <div class="field"><label>¿Qué quieres lograr?</label><input type="text" id="wf-nombre" placeholder="Ej. Viaje a Japón, laptop nueva..."></div>
        <div class="field"><label>Valor</label><input type="number" id="wf-valor" min="1"></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="wf-cancel">Cancelar</button>
          <button class="btn btn-primary" id="wf-save">Agregar deseo</button>
        </div>
      </div>
    `);
    wrap.querySelector('#wf-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#wf-save').onclick = async () => {
      const nombre = wrap.querySelector('#wf-nombre').value.trim();
      const valor = parseFloat(wrap.querySelector('#wf-valor').value);
      if (!nombre) { Utils.toast('El nombre no puede estar vacío'); return; }
      if (!valor || valor <= 0) { Utils.toast('Ingresa un valor válido'); return; }
      w.nombre = nombre; w.valorObjetivo = valor;
      await DB.put('wishlist', w);
      this.wishlist.push(w);
      Utils.closeSheet();
      Utils.toast('Deseo agregado');
      this.switchTab('deseos');
    };
    Utils.openSheet(wrap);
  },

  openWishlistDetail(w) {
    const aportado = this.wishlistAportado(w);
    const pendiente = this.wishlistPending(w);
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">${Utils.escapeHtml(w.nombre)}</div>
        <div class="stat-grid">
          <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(aportado)}</div><div class="lbl">Ahorrado</div></div>
          <div class="stat-box"><div class="val" style="font-size:16px;">${Utils.money(pendiente)}</div><div class="lbl">Pendiente</div></div>
        </div>
        ${w.estado !== 'completado' ? `
        <div class="field" style="margin-top:16px;"><label>Agregar aporte</label><input type="number" id="wd-aporte" min="1"></div>
        <button class="btn btn-primary btn-block" id="wd-add-aporte">Registrar aporte</button>
        ` : `<p style="text-align:center;color:var(--green);font-weight:700;margin-top:16px;">✔ ¡Deseo cumplido!</p>`}
        <button class="btn btn-ghost btn-block" style="margin-top:10px;" id="wd-delete">Eliminar deseo</button>
      </div>
    `);
    if (w.estado !== 'completado') {
      wrap.querySelector('#wd-add-aporte').onclick = async () => {
        const val = parseFloat(wrap.querySelector('#wd-aporte').value);
        if (!val || val <= 0) { Utils.toast('Ingresa un valor válido'); return; }
        w.aportes = w.aportes || [];
        w.aportes.push({ id: DB.uuid(), valor: val, fecha: Utils.todayISO() });
        if (this.wishlistAportado(w) >= w.valorObjetivo) w.estado = 'completado';
        await DB.put('wishlist', w);
        Utils.closeSheet();
        Utils.toast(w.estado === 'completado' ? '¡Deseo cumplido! 🎉' : 'Aporte registrado');
        this.render();
      };
    }
    wrap.querySelector('#wd-delete').onclick = async () => {
      const ok = await Utils.confirmDialog(`¿Eliminar "${w.nombre}" de tu lista de deseos?`, 'Eliminar');
      if (ok) {
        await DB.delete('wishlist', w.id);
        this.wishlist = this.wishlist.filter(x => x.id !== w.id);
        Utils.closeSheet();
        Utils.toast('Deseo eliminado');
        this.render();
      }
    };
    Utils.openSheet(wrap);
  },

  openBudgetForm() {
    const key = Utils.todayISO().slice(0,7);
    const existing = this.budgets.find(b => b.tipo === 'mensual' && b.mes === key);
    const b = existing || { id: DB.uuid(), tipo: 'mensual', mes: key, monto: '' };
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Presupuesto mensual</div>
        <div class="field"><label>Monto máximo para este mes</label><input type="number" id="bf-monto" min="1"></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="bf-cancel">Cancelar</button>
          <button class="btn btn-primary" id="bf-save">Guardar</button>
        </div>
      </div>
    `);
    wrap.querySelector('#bf-monto').value = b.monto || '';
    wrap.querySelector('#bf-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#bf-save').onclick = async () => {
      const monto = parseFloat(wrap.querySelector('#bf-monto').value);
      if (!monto || monto <= 0) { Utils.toast('Ingresa un valor válido'); return; }
      b.monto = monto;
      await DB.put('budgets', b);
      if (!existing) this.budgets.push(b);
      Utils.closeSheet(); Utils.toast('Presupuesto guardado'); this.render();
    };
    Utils.openSheet(wrap);
  },

  openFrequentForm() {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Nuevo gasto frecuente</div>
        <div class="field"><label>Nombre</label><input type="text" id="ff-nombre" placeholder="Ej. Café"></div>
        <div class="field"><label>Valor</label><input type="number" id="ff-valor" min="1"></div>
        <div class="field"><label>Categoría</label><select id="ff-cat"></select></div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="ff-cancel">Cancelar</button>
          <button class="btn btn-primary" id="ff-save">Guardar</button>
        </div>
      </div>
    `);
    const sel = wrap.querySelector('#ff-cat');
    this.categories.filter(c => c.tipo === 'gasto').forEach(c => sel.appendChild(Utils.el(`<option value="${c.id}">${Utils.escapeHtml(c.nombre)}</option>`)));
    wrap.querySelector('#ff-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#ff-save').onclick = async () => {
      const nombre = wrap.querySelector('#ff-nombre').value.trim();
      const valor = parseFloat(wrap.querySelector('#ff-valor').value);
      if (!nombre || !valor) { Utils.toast('Completa nombre y valor'); return; }
      const f = { id: DB.uuid(), nombre, valor, categoria: sel.value };
      await DB.put('frequentExpenses', f);
      this.frequent.push(f);
      Utils.closeSheet(); Utils.toast('Gasto frecuente creado'); this.render();
    };
    Utils.openSheet(wrap);
  }
};
