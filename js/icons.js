// ============================================
// BetterME — Set de íconos (SVG inline, estilo trazo)
// Reemplaza los emojis por íconos consistentes con el sistema de diseño.
// ============================================

const Icon = {
  svg(paths, viewBox = '0 0 24 24') {
    return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },
  home: () => Icon.svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>'),
  calendar: () => Icon.svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
  wallet: () => Icon.svg('<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M16 12h2.5M3 9h18"/>'),
  chart: () => Icon.svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  timer: () => Icon.svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4M12 2v3"/>'),
  settings: () => Icon.svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  checkSquare: () => Icon.svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>'),
  hash: () => Icon.svg('<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>'),
  clock: () => Icon.svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  barChart: () => Icon.svg('<path d="M12 20V10M18 20V4M6 20v-4"/>'),
  flame: () => Icon.svg('<path d="M12 2s-3.2 3.8-3.2 7a3.2 3.2 0 0 0 6.4 0c0 .8-.6 1.6-.6 1.6s3.4 1.4 3.4 5.4a5.5 5.5 0 0 1-11 0c0-3.2 1.1-5.2 2.2-7.4.6 1 1.2 1.5 1.2 1.5S9 5.6 12 2Z"/>'),
  plus: () => Icon.svg('<path d="M12 5v14M5 12h14"/>'),
  minus: () => Icon.svg('<path d="M5 12h14"/>'),
  cart: () => Icon.svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
  piggyBank: () => Icon.svg('<path d="M19 9V6a2 2 0 0 0-2-2h-1.17A4 4 0 0 0 12 2a4 4 0 0 0-3.83 2H7a2 2 0 0 0-2 2v1a5 5 0 0 0-2 4v1a2 2 0 0 0 2 2h1v3a2 2 0 0 0 2 2h1v-3h4v3h1a2 2 0 0 0 2-2v-3a2 2 0 0 0 2-2v-1a5 5 0 0 0-1-3Z"/><circle cx="16" cy="10" r=".6" fill="currentColor" stroke="none"/>'),
  sparkles: () => Icon.svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l1.8 1.8M15.7 15.7l1.8 1.8M6.5 17.5l1.8-1.8M15.7 8.3l1.8-1.8"/>'),
  fileText: () => Icon.svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'),
  handshake: () => Icon.svg('<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87"/><path d="M21 3 3 4l8 10"/>'),
  cake: () => Icon.svg('<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 2 1 2 1"/><path d="M12 3v3M8 3v3M16 3v3"/>'),
  folder: () => Icon.svg('<path d="M4 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/>'),
  pin: () => Icon.svg('<path d="M12 17v5"/><path d="M9 10.5V6a3 3 0 0 1 6 0v4.5"/><path d="M6 10h12l-1.5 5h-9L6 10Z"/>'),
  bookmark: () => Icon.svg('<path d="M6 3h12v18l-6-4-6 4V3Z"/>'),
  trendUp: () => Icon.svg('<path d="M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6"/>'),
  play: () => Icon.svg('<path d="M6 4v16l14-8L6 4Z"/>'),
  pause: () => Icon.svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  rotateCcw: () => Icon.svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  skipForward: () => Icon.svg('<path d="M5 4v16l12-8L5 4Z"/><path d="M19 5v14"/>'),
  sliders: () => Icon.svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>')
};
