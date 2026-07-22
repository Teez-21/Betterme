// ============================================
// BetterME — Enfoque (técnica Pomodoro)
// Temporizador de concentración: ciclos de trabajo y descanso.
// ============================================

const Focus = {
  config: { work: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLong: 4, autoStartNext: false },
  phase: 'trabajo', // trabajo | corto | largo
  secondsLeft: 25 * 60,
  totalSeconds: 25 * 60,
  running: false,
  timerId: null,
  endTimestamp: null,
  completedCycles: 0,
  sessionsToday: [],

  async init() {
    const saved = await DB.getSetting('focusConfig');
    if (saved) this.config = Object.assign({}, this.config, saved);
    const all = await DB.getAll('focusSessions');
    this.sessionsToday = all.filter(s => s.date === Utils.todayISO());
    const workDoneToday = this.sessionsToday.filter(s => s.type === 'trabajo').length;
    this.completedCycles = workDoneToday % this.config.cyclesBeforeLong;
    this.resetTimer('trabajo');

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.running) this.tick();
    });

    this.render();
  },

  resetTimer(phase) {
    clearInterval(this.timerId);
    this.running = false;
    this.phase = phase;
    const mins = phase === 'trabajo' ? this.config.work : (phase === 'largo' ? this.config.longBreak : this.config.shortBreak);
    this.totalSeconds = mins * 60;
    this.secondsLeft = this.totalSeconds;
  },

  toggle() {
    if (this.running) this.pause(); else this.start();
  },

  start() {
    this.running = true;
    this.endTimestamp = Date.now() + this.secondsLeft * 1000;
    this.timerId = setInterval(() => this.tick(), 250);
    this.render();
  },

  pause() {
    this.running = false;
    clearInterval(this.timerId);
    this.render();
  },

  tick() {
    const remaining = Math.max(0, Math.ceil((this.endTimestamp - Date.now()) / 1000));
    this.secondsLeft = remaining;
    if (remaining <= 0) this.completePhase();
    else this.renderTimerOnly();
  },

  async completePhase() {
    clearInterval(this.timerId);
    this.running = false;
    const mins = this.phase === 'trabajo' ? this.config.work : (this.phase === 'largo' ? this.config.longBreak : this.config.shortBreak);
    const rec = { id: DB.uuid(), date: Utils.todayISO(), type: this.phase, minutos: mins, completadoEn: new Date().toISOString() };
    await DB.put('focusSessions', rec);
    this.sessionsToday.push(rec);

    this.notify();

    let next;
    if (this.phase === 'trabajo') {
      this.completedCycles += 1;
      next = (this.completedCycles % this.config.cyclesBeforeLong === 0) ? 'largo' : 'corto';
    } else {
      next = 'trabajo';
    }
    this.resetTimer(next);
    this.render();
    if (this.config.autoStartNext) this.start();
  },

  skip() {
    const next = this.phase === 'trabajo' ? 'corto' : 'trabajo';
    this.resetTimer(next);
    this.render();
  },

  resetCurrent() {
    this.resetTimer(this.phase);
    this.render();
  },

  notify() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    this.beep();
    if ('Notification' in window && Notification.permission === 'granted') {
      const msgs = { trabajo: 'Sesión de enfoque completada', corto: 'Descanso corto terminado, ¡a enfocarse!', largo: 'Descanso largo terminado, ¡a enfocarse!' };
      try { new Notification('BetterME', { body: msgs[this.phase] || 'Fase completada', icon: './icons/icon-192.png' }); } catch (e) {}
    }
    const toastMsgs = { trabajo: '¡Sesión completada! Toma un descanso', corto: 'Descanso terminado, a enfocarse', largo: 'Descanso largo terminado, a enfocarse' };
    Utils.toast(toastMsgs[this.phase] || 'Fase completada');
  },

  beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start();
      o.stop(ctx.currentTime + 0.55);
    } catch (e) {}
  },

  async requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
  },

  render() {
    const phaseLabels = { trabajo: 'Enfoque', corto: 'Descanso corto', largo: 'Descanso largo' };
    const phaseLabelEl = document.getElementById('focus-phase-label');
    if (phaseLabelEl) phaseLabelEl.textContent = phaseLabels[this.phase];

    const cycleLabelEl = document.getElementById('focus-cycle-label');
    if (cycleLabelEl) {
      const current = (this.completedCycles % this.config.cyclesBeforeLong) + (this.phase === 'trabajo' ? 1 : 0) || this.config.cyclesBeforeLong;
      cycleLabelEl.textContent = `Pomodoro ${Math.min(current, this.config.cyclesBeforeLong)} de ${this.config.cyclesBeforeLong}`;
    }

    this.renderTimerOnly();

    const toggleBtn = document.getElementById('focus-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = this.running ? 'Pausar' : (this.secondsLeft < this.totalSeconds ? 'Reanudar' : 'Iniciar');

    const ringWrap = document.getElementById('focus-ring-wrap');
    if (ringWrap) ringWrap.classList.toggle('running', this.running);

    const statEl = document.getElementById('focus-today-stat');
    if (statEl) {
      const workSessions = this.sessionsToday.filter(s => s.type === 'trabajo');
      const totalMin = workSessions.reduce((s, x) => s + x.minutos, 0);
      statEl.textContent = `${workSessions.length} ${workSessions.length === 1 ? 'pomodoro' : 'pomodoros'} · ${totalMin} min hoy`;
    }
  },

  renderTimerOnly() {
    const m = Math.floor(this.secondsLeft / 60).toString().padStart(2, '0');
    const s = (this.secondsLeft % 60).toString().padStart(2, '0');
    const timeEl = document.getElementById('focus-time-label');
    if (timeEl) timeEl.textContent = `${m}:${s}`;
    const pct = this.totalSeconds ? 100 - (this.secondsLeft / this.totalSeconds) * 100 : 0;
    const ringEl = document.getElementById('focus-ring');
    if (ringEl) ringEl.innerHTML = Utils.ringSVG(pct, 88, 200);
  },

  openConfigForm() {
    this.requestNotifPermission();
    const c = this.config;
    const wrap = Utils.el(`
      <div>
        <div class="sheet-handle"></div>
        <div class="sheet-title">Configurar Pomodoro</div>
        <div class="field-row">
          <div class="field"><label>Enfoque (min)</label><input type="number" id="fc-work" min="1"></div>
          <div class="field"><label>Descanso corto</label><input type="number" id="fc-short" min="1"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Descanso largo</label><input type="number" id="fc-long" min="1"></div>
          <div class="field"><label>Ciclos antes del largo</label><input type="number" id="fc-cycles" min="1"></div>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;text-transform:none;font-size:14px;"><input type="checkbox" id="fc-auto" style="width:auto;"> Iniciar la siguiente fase automáticamente</label>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-ghost" id="fc-cancel">Cancelar</button>
          <button class="btn btn-primary" id="fc-save">Guardar</button>
        </div>
      </div>
    `);
    wrap.querySelector('#fc-work').value = c.work;
    wrap.querySelector('#fc-short').value = c.shortBreak;
    wrap.querySelector('#fc-long').value = c.longBreak;
    wrap.querySelector('#fc-cycles').value = c.cyclesBeforeLong;
    wrap.querySelector('#fc-auto').checked = c.autoStartNext;
    wrap.querySelector('#fc-cancel').onclick = () => Utils.closeSheet();
    wrap.querySelector('#fc-save').onclick = async () => {
      const work = Math.max(1, parseInt(wrap.querySelector('#fc-work').value) || 25);
      const shortB = Math.max(1, parseInt(wrap.querySelector('#fc-short').value) || 5);
      const longB = Math.max(1, parseInt(wrap.querySelector('#fc-long').value) || 15);
      const cycles = Math.max(1, parseInt(wrap.querySelector('#fc-cycles').value) || 4);
      const auto = wrap.querySelector('#fc-auto').checked;
      this.config = { work, shortBreak: shortB, longBreak: longB, cyclesBeforeLong: cycles, autoStartNext: auto };
      await DB.setSetting('focusConfig', this.config);
      if (!this.running) this.resetTimer(this.phase);
      Utils.closeSheet();
      Utils.toast('Configuración guardada');
      this.render();
    };
    Utils.openSheet(wrap);
  }
};
