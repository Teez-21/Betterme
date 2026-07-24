// ============================================
// BetterME — App shell (router + init)
// ============================================

const App = {
  currentTab: 'habits',

  async boot() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
    }

    // Safety net: never leave the user staring at a frozen splash screen.
    const splashTimeout = setTimeout(() => {
      document.getElementById('splash-screen').classList.add('fade-out');
      setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 400);
    }, 4000);

    try {
      Pin.onSuccess = () => this.startApp();
      await Pin.start();
      // Once the PIN screen is ready to receive input, get the splash out of the way.
      document.getElementById('splash-screen').classList.add('fade-out');
      setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 400);
      clearTimeout(splashTimeout);
    } catch (err) {
      clearTimeout(splashTimeout);
      document.getElementById('splash-screen').classList.add('fade-out');
      setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 400);
      console.error('BetterME boot error:', err);
      alert('Ocurrió un error al iniciar BetterME: ' + (err.message || err));
    }
  },

  async startApp() {
    document.getElementById('splash-screen').classList.add('fade-out');
    setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 400);

    await Settings.initName();
    await Habits.init();
    await Calendar.init();
    await Finance.init();
    await Focus.init();
    Dashboard.init();
    Settings.render();

    this.goTo('habits');
    document.getElementById('app').classList.remove('hidden');
  },

  goTo(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    // FAB visibility & behavior per screen
    const fab = document.getElementById('fab');
    fab.classList.toggle('hidden', tab === 'dashboard' || tab === 'settings' || tab === 'focus');
    fab.onclick = () => {
      if (tab === 'habits') Habits.openCreateForm();
      else if (tab === 'calendar') Calendar.openTypeMenu();
      else if (tab === 'finance') Finance.openTypeMenu();
    };

    if (tab === 'dashboard') Dashboard.render();
    if (tab === 'calendar') Calendar.render();
    if (tab === 'finance') Finance.render();
    if (tab === 'focus') Focus.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.boot());
