// ============================================
// BetterME — Configuración
// ============================================

const Settings = {
  render() {
    // static screen, nothing dynamic needed on load besides handlers already bound in HTML/App
  },

  async exportData() {
    const payload = await DB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betterme-backup-${Utils.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Utils.toast('Copia de seguridad exportada');
  },

  importData() {
    const input = document.getElementById('import-file-input');
    input.value = '';
    input.click();
  },

  async handleImportFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const ok = await Utils.confirmDialog('Esto reemplazará toda tu información actual con la del archivo. ¿Continuar?', 'Importar');
      if (!ok) return;
      await DB.importAll(payload);
      Utils.toast('Datos importados. Reiniciando…');
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      Utils.toast('El archivo no es válido');
    }
  },

  async clearAllData() {
    const ok = await Utils.confirmDialog('Esto eliminará TODA tu información de forma permanente. ¿Estás seguro?', 'Eliminar todo');
    if (!ok) return;
    const ok2 = await Utils.confirmDialog('Esta acción no se puede deshacer. Confirma nuevamente.', 'Sí, eliminar todo');
    if (!ok2) return;
    await DB.clearAll();
    Utils.toast('Datos eliminados. Reiniciando…');
    setTimeout(() => location.reload(), 900);
  },

  async resetProgress() {
    const ok = await Utils.confirmDialog('Esto borrará los registros de hábitos, movimientos y avances, pero conservará tu configuración de hábitos y cuentas. ¿Continuar?', 'Reiniciar progreso');
    if (!ok) return;
    await DB.clear('habitLogs');
    await DB.clear('transactions');
    Calendar.items.forEach(p => { if (p.fases) p.fases.forEach(f => f.tasks && f.tasks.forEach(t => t.completada = false)); });
    for (const it of Calendar.items) { if (it.tipo === 'proyecto') await DB.put('calendarItems', it); }
    Utils.toast('Progreso reiniciado. Recargando…');
    setTimeout(() => location.reload(), 900);
  },

  openCategoriesManager() {
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Categorías</div>
        <div class="tabbed-toggle" style="margin-bottom:14px;">
          <button class="active" data-t="gasto">Gastos</button>
          <button data-t="ingreso">Ingresos</button>
        </div>
        <div id="cat-list"></div>
        <div class="field" style="margin-top:14px;">
          <label>Nueva categoría</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="cat-new-name" style="flex:1;">
            <button class="btn btn-primary" id="cat-add">Agregar</button>
          </div>
        </div>
      </div>
    `);
    let currentType = 'gasto';
    const renderList = () => {
      const listEl = wrap.querySelector('#cat-list');
      listEl.innerHTML = '';
      Finance.categories.filter(c => c.tipo === currentType).forEach(c => {
        const row = Utils.el(`<div class="settings-row"><span class="lbl">${Utils.escapeHtml(c.nombre)}</span><span style="color:var(--gray);font-size:18px;cursor:pointer;">✕</span></div>`);
        row.lastElementChild.onclick = async () => {
          const hasMovs = Finance.transactions.some(t => t.categoria === c.id);
          if (hasMovs) {
            const otros = Finance.categories.find(x => x.nombre === 'Otros' && x.tipo === currentType);
            const ok = await Utils.confirmDialog(`Los movimientos de "${c.nombre}" pasarán a "Otros". ¿Continuar?`, 'Eliminar');
            if (!ok) return;
            Finance.transactions.forEach(t => { if (t.categoria === c.id && otros) t.categoria = otros.id; });
            for (const t of Finance.transactions.filter(t => t.categoria === (otros?.id))) await DB.put('transactions', t);
          }
          await DB.delete('categories', c.id);
          Finance.categories = Finance.categories.filter(x => x.id !== c.id);
          renderList();
        };
        listEl.appendChild(row);
      });
    };
    wrap.querySelectorAll('.tabbed-toggle button').forEach(b => b.onclick = () => {
      wrap.querySelectorAll('.tabbed-toggle button').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); currentType = b.dataset.t; renderList();
    });
    wrap.querySelector('#cat-add').onclick = async () => {
      const name = wrap.querySelector('#cat-new-name').value.trim();
      if (!name) return;
      const c = { id: DB.uuid(), nombre: name, tipo: currentType };
      await DB.put('categories', c);
      Finance.categories.push(c);
      wrap.querySelector('#cat-new-name').value = '';
      renderList();
    };
    renderList();
    Utils.openSheet(wrap);
  },

  openAccountsManager() {
    const wrap = Utils.el(`<div><div class="sheet-handle"></div><div class="sheet-title">Cuentas</div><div id="acc-mgr-list"></div></div>`);
    const listEl = wrap.querySelector('#acc-mgr-list');
    Finance.accounts.forEach(a => {
      const row = Utils.el(`<div class="settings-row"><span class="lbl">${Utils.escapeHtml(a.nombre)}</span><span style="color:var(--gray);">${Utils.money(Finance.accountBalance(a.id))}</span></div>`);
      row.onclick = () => { Utils.closeSheet(); setTimeout(() => Finance.openAccountForm(a), 200); };
      listEl.appendChild(row);
    });
    Utils.openSheet(wrap);
  },

  openFrequentManager() {
    Utils.closeSheet();
    App.goTo('finance');
    setTimeout(() => { Finance.switchTab('frecuentes'); Utils.toast('Gestiona tus gastos frecuentes aquí'); }, 200);
  }
};
