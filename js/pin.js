// ============================================
// BetterME — Seguridad (PIN de 6 dígitos)
// El PIN se almacena cifrado mediante hash (SHA-256), nunca en texto plano.
// ============================================

const Pin = {
  buffer: '',
  mode: 'auth', // 'auth' | 'setup' | 'setup-confirm' | 'change-old' | 'change-new' | 'change-confirm'
  pendingNewPin: '',
  onSuccess: null,

  async sha256(text) {
    const enc = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async hasPin() {
    const hash = await DB.getSetting('pinHash');
    return !!hash;
  },

  async start() {
    const screen = document.getElementById('pin-screen');
    screen.classList.remove('hidden');
    const has = await this.hasPin();
    this.mode = has ? 'auth' : 'setup';
    this.buffer = '';
    this.renderMode();
    this.renderDots();
  },

  renderMode() {
    const screen = document.getElementById('pin-screen');
    const titles = {
      auth: 'Ingresa tu PIN',
      setup: 'Crea tu PIN de seguridad',
      'setup-confirm': 'Confirma tu PIN',
      'change-old': 'Ingresa tu PIN actual',
      'change-new': 'Crea tu nuevo PIN',
      'change-confirm': 'Confirma tu nuevo PIN'
    };
    const subs = {
      auth: 'Protege tu información personal',
      setup: 'Usarás este PIN para entrar a BetterME',
      'setup-confirm': 'Vuelve a escribirlo para confirmar',
      'change-old': '',
      'change-new': '',
      'change-confirm': ''
    };
    screen.querySelector('h1').textContent = titles[this.mode];
    screen.querySelector('.sub').textContent = subs[this.mode];
    screen.classList.toggle('setup-mode', this.mode !== 'auth');
    document.getElementById('pin-cancel-btn').classList.toggle('hidden', !(this.mode.startsWith('change')));
  },

  renderDots() {
    const wrap = document.getElementById('pin-dots');
    wrap.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      wrap.appendChild(Utils.el(`<div class="pin-dot ${i < this.buffer.length ? 'filled' : ''}"></div>`));
    }
  },

  errorShake() {
    const wrap = document.getElementById('pin-dots');
    [...wrap.children].forEach(d => d.classList.add('error'));
    if (navigator.vibrate) navigator.vibrate(100);
    setTimeout(() => { this.buffer = ''; this.renderDots(); }, 400);
  },

  async press(digit) {
    if (this.buffer.length >= 6) return;
    this.buffer += digit;
    this.renderDots();
    if (this.buffer.length === 6) {
      await this.handleComplete();
    }
  },

  backspace() {
    this.buffer = this.buffer.slice(0, -1);
    this.renderDots();
  },

  async handleComplete() {
    const pin = this.buffer;
    if (this.mode === 'auth') {
      const hash = await DB.getSetting('pinHash');
      const inputHash = await this.sha256(pin);
      if (inputHash === hash) {
        this.finish();
      } else {
        this.errorShake();
      }
    } else if (this.mode === 'setup') {
      this.pendingNewPin = pin;
      this.mode = 'setup-confirm';
      this.buffer = '';
      this.renderMode(); this.renderDots();
    } else if (this.mode === 'setup-confirm') {
      if (pin === this.pendingNewPin) {
        const hash = await this.sha256(pin);
        await DB.setSetting('pinHash', hash);
        this.finish();
      } else {
        Utils.toast('Los PIN no coinciden, intenta de nuevo');
        this.mode = 'setup';
        this.buffer = ''; this.pendingNewPin = '';
        this.renderMode(); this.renderDots();
      }
    } else if (this.mode === 'change-old') {
      const hash = await DB.getSetting('pinHash');
      const inputHash = await this.sha256(pin);
      if (inputHash === hash) {
        this.mode = 'change-new';
        this.buffer = '';
        this.renderMode(); this.renderDots();
      } else {
        this.errorShake();
      }
    } else if (this.mode === 'change-new') {
      this.pendingNewPin = pin;
      this.mode = 'change-confirm';
      this.buffer = '';
      this.renderMode(); this.renderDots();
    } else if (this.mode === 'change-confirm') {
      if (pin === this.pendingNewPin) {
        const hash = await this.sha256(pin);
        await DB.setSetting('pinHash', hash);
        document.getElementById('pin-screen').classList.add('hidden');
        Utils.toast('PIN actualizado');
        this.mode = 'auth';
      } else {
        Utils.toast('Los PIN no coinciden');
        this.mode = 'change-new';
        this.buffer = '';
        this.renderMode(); this.renderDots();
      }
    }
  },

  cancelChange() {
    document.getElementById('pin-screen').classList.add('hidden');
    this.mode = 'auth';
    this.buffer = '';
  },

  startChangeFlow() {
    document.getElementById('pin-screen').classList.remove('hidden');
    this.mode = 'change-old';
    this.buffer = '';
    this.renderMode(); this.renderDots();
  },

  finish() {
    document.getElementById('pin-screen').classList.add('hidden');
    if (this.onSuccess) this.onSuccess();
  }
};
