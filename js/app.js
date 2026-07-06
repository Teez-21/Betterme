// ============================================
// BetterME — App shell (router + init)
// ============================================

const App = {
  currentTab: 'habits',

  async boot() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    Pin.onSuccess = () => this.startApp();
    await Pin.start();

    // splash fade a bit after pin logic starts, handled visually via CSS z-index (pin sits above splash)
  },

  async startApp() {
    document.getElementById('splash-screen').classList.add('fade-out');
    setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 400);

    await Habits.init();
    await Calendar.init();
    await Finance.init();
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
    fab.classList.toggle('hidden', tab === 'dashboard' || tab === 'settings');
    fab.onclick = () => {
      if (tab === 'habits') Habits.openCreateForm();
      else if (tab === 'calendar') Calendar.openTypeMenu();
      else if (tab === 'finance') Finance.openTypeMenu();
    };

    if (tab === 'dashboard') Dashboard.render();
    if (tab === 'calendar') Calendar.render();
    if (tab === 'finance') Finance.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.boot());
