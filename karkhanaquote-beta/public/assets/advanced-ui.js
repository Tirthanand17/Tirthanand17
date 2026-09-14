const moneyNumber = (id) => {
  const el = document.getElementById(id);
  if (!el) return 0;
  const n = Number((el.textContent || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

function updateCostBars() {
  const grand = Math.max(moneyNumber('sumGrand'), 0.01);
  const parts = {
    Direct: moneyNumber('sumLines'),
    Overhead: moneyNumber('sumSetup') + moneyNumber('sumOverhead'),
    Markup: moneyNumber('sumMarkup'),
    Gst: moneyNumber('sumGst'),
  };
  for (const [key, value] of Object.entries(parts)) {
    const pct = Math.max(0, Math.min(100, value / grand * 100));
    const bar = document.getElementById(`bar${key}`);
    const label = document.getElementById(`bar${key}Pct`);
    if (bar) bar.style.width = `${pct.toFixed(1)}%`;
    if (label) label.textContent = `${Math.round(pct)}%`;
  }
}

const total = document.getElementById('sumGrand');
if (total) {
  new MutationObserver(updateCostBars).observe(total, { childList: true, characterData: true, subtree: true });
  updateCostBars();
}

const stage = document.querySelector('.machine-stage');
const shell = document.querySelector('.machine-shell');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (stage && shell && !reduced && matchMedia('(pointer:fine)').matches) {
  stage.addEventListener('pointermove', (event) => {
    const r = stage.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    shell.style.transform = `rotateY(${x * 4 - 1}deg) rotateX(${-y * 3 + .5}deg) translateY(-3px)`;
  });
  stage.addEventListener('pointerleave', () => { shell.style.transform = ''; });
}
