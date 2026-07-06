// ============================================
// BetterME — Motor de gráficos ligero (canvas nativo)
// Sin dependencias externas: 100% offline.
// ============================================

const Charts = {
  setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = (rect.height || 220) * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height || 220 };
  },

  pie(canvas, data) {
    // data: [{label, value, color}]
    const { ctx, w, h } = this.setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) { this.emptyMsg(ctx, w, h); return; }
    const cx = w * 0.32, cy = h / 2, r = Math.min(w * 0.28, h * 0.42);
    let start = -Math.PI / 2;
    data.forEach(d => {
      const angle = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += angle;
    });
    // legend
    const legendX = w * 0.62;
    let ly = h / 2 - (data.length * 20) / 2;
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    data.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.fillRect(legendX, ly - 5, 10, 10);
      ctx.fillStyle = '#4B4867';
      ctx.fillText(`${d.label} (${Math.round((d.value/total)*100)}%)`, legendX + 16, ly);
      ly += 20;
    });
  },

  bar(canvas, data, opts = {}) {
    // data: [{label, value, color}]
    const { ctx, w, h } = this.setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!data.length) { this.emptyMsg(ctx, w, h); return; }
    const max = Math.max(...data.map(d => d.value), 1);
    const padBottom = 24, padTop = 10;
    const barW = (w / data.length) * 0.5;
    const gap = (w / data.length) * 0.5;
    ctx.font = '10.5px -apple-system, sans-serif';
    data.forEach((d, i) => {
      const barH = ((d.value / max) * (h - padBottom - padTop));
      const x = i * (barW + gap) + gap / 2;
      const y = h - padBottom - barH;
      ctx.fillStyle = d.color || '#4F46E5';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, barH, 4) : ctx.rect(x, y, barW, barH);
      ctx.fill();
      ctx.fillStyle = '#8E8E93';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, h - 10);
    });
  },

  line(canvas, data, opts = {}) {
    // data: [{label, value}]
    const { ctx, w, h } = this.setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    if (!data.length) { this.emptyMsg(ctx, w, h); return; }
    const max = Math.max(...data.map(d => d.value), 1);
    const min = Math.min(...data.map(d => d.value), 0);
    const range = (max - min) || 1;
    const padBottom = 22, padTop = 12, padX = 10;
    const stepX = (w - padX * 2) / Math.max(1, data.length - 1);

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padX + i * stepX;
      const y = padTop + (1 - (d.value - min) / range) * (h - padTop - padBottom);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = opts.color || '#4F46E5';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // fill under line
    ctx.lineTo(padX + (data.length - 1) * stepX, h - padBottom);
    ctx.lineTo(padX, h - padBottom);
    ctx.closePath();
    ctx.fillStyle = (opts.color || '#4F46E5') + '18';
    ctx.fill();

    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#8E8E93';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (data.length > 8 && i % Math.ceil(data.length / 6) !== 0) return;
      const x = padX + i * stepX;
      ctx.fillText(d.label, x, h - 6);
    });
  },

  emptyMsg(ctx, w, h) {
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillStyle = '#C7C7CC';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos suficientes', w / 2, h / 2);
  }
};
