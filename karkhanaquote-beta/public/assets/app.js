import { MATERIALS, calculateQuote, money, nonNegative, positiveInt } from './calculator.js';
import { loadState, makeId, saveState } from './storage.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = loadState();

function rateForMaterial(key) {
  if (key === 'ss304') return nonNegative(state.settings.ssRate ?? 220);
  if (key === 'aluminium') return nonNegative(state.settings.aluminiumRate ?? 260);
  if (key === 'ms') return nonNegative(state.settings.msRate ?? 70);
  return 0;
}

const defaultLine = () => ({
  id: makeId('line'), description: 'Laser cut part', materialKey: 'ms', density: 7850,
  lengthMm: 1000, widthMm: 1000, thicknessMm: 1, quantity: 1,
  materialRatePerKg: rateForMaterial('ms'), wastePct: nonNegative(state.settings.wastePct ?? 10),
  cutLengthMm: 4000, cutRatePerM: nonNegative(state.settings.cutRatePerM ?? 10),
  pierces: 4, pierceRate: nonNegative(state.settings.pierceRate ?? 1), secondaryOps: 0,
});

let draft = {
  id: makeId('quote'), ref: `KQ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-001`,
  customer: '', status: 'Draft', validDays: 15, notes: '',
  setupCost: 100, overheadPct: nonNegative(state.settings.overheadPct ?? 8), markupPct: nonNegative(state.settings.markupPct ?? 25), gstPct: nonNegative(state.settings.gstPct ?? 18),
  lines: [defaultLine()], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function lineHtml(line, index) {
  const materialOptions = Object.entries(MATERIALS).map(([key, m]) =>
    `<option value="${key}" ${line.materialKey === key ? 'selected' : ''}>${m.name}</option>`
  ).join('') + `<option value="custom" ${line.materialKey === 'custom' ? 'selected' : ''}>Custom density</option>`;

  return `<article class="line-item" data-id="${escapeHtml(line.id)}">
    <div class="line-head"><strong>Item ${index + 1}</strong><button class="ghost danger remove-line" type="button">Remove</button></div>
    <div class="form-grid compact">
      <label class="span-2">Description<input data-f="description" value="${escapeHtml(line.description)}" maxlength="120"></label>
      <label>Material<select data-f="materialKey">${materialOptions}</select></label>
      <label>Density kg/m³<input data-f="density" type="number" min="1" step="1" value="${line.density}"></label>
      <label>Length mm<input data-f="lengthMm" type="number" min="0" step="0.01" value="${line.lengthMm}"></label>
      <label>Width mm<input data-f="widthMm" type="number" min="0" step="0.01" value="${line.widthMm}"></label>
      <label>Thickness mm<input data-f="thicknessMm" type="number" min="0" step="0.01" value="${line.thicknessMm}"></label>
      <label>Quantity<input data-f="quantity" type="number" min="1" step="1" value="${line.quantity}"></label>
      <label>Material ₹/kg<input data-f="materialRatePerKg" type="number" min="0" step="0.01" value="${line.materialRatePerKg}"></label>
      <label>Waste %<input data-f="wastePct" type="number" min="0" step="0.01" value="${line.wastePct}"></label>
      <label>Cut path mm / piece<input data-f="cutLengthMm" type="number" min="0" step="0.01" value="${line.cutLengthMm}"></label>
      <label>Cut ₹/metre<input data-f="cutRatePerM" type="number" min="0" step="0.01" value="${line.cutRatePerM}"></label>
      <label>Pierces / piece<input data-f="pierces" type="number" min="0" step="1" value="${line.pierces}"></label>
      <label>₹ / pierce<input data-f="pierceRate" type="number" min="0" step="0.01" value="${line.pierceRate}"></label>
      <label class="span-2">Secondary operations total ₹<input data-f="secondaryOps" type="number" min="0" step="0.01" value="${line.secondaryOps}"></label>
    </div>
    <div class="line-result" id="result-${escapeHtml(line.id)}"></div>
  </article>`;
}

function renderLines() {
  $('#lines').innerHTML = draft.lines.map(lineHtml).join('');
  bindLineEvents();
  recalc();
}

function bindLineEvents() {
  $$('.line-item').forEach((el) => {
    const id = el.dataset.id;
    el.querySelectorAll('[data-f]').forEach((input) => input.addEventListener('input', () => {
      const line = draft.lines.find((x) => x.id === id);
      const f = input.dataset.f;
      if (f === 'description' || f === 'materialKey') line[f] = input.value;
      else if (f === 'quantity') line[f] = positiveInt(input.value);
      else line[f] = nonNegative(input.value);

      if (f === 'materialKey' && input.value !== 'custom') {
        line.density = MATERIALS[input.value].density;
        line.materialRatePerKg = rateForMaterial(input.value);
        el.querySelector('[data-f="density"]').value = line.density;
        el.querySelector('[data-f="materialRatePerKg"]').value = line.materialRatePerKg;
      }
      recalc();
    }));
    el.querySelector('.remove-line').addEventListener('click', () => {
      if (draft.lines.length === 1) return showToast('A quote needs at least one item.');
      draft.lines = draft.lines.filter((x) => x.id !== id);
      renderLines();
    });
  });
}

function syncHeader() {
  ['ref','customer','status','validDays','notes','setupCost','overheadPct','markupPct','gstPct'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = draft[id];
    el.addEventListener('input', () => {
      draft[id] = ['ref','customer','status','notes'].includes(id) ? el.value : nonNegative(el.value);
      if (id === 'validDays') draft[id] = positiveInt(el.value, 15);
      recalc();
    });
  });
}

function recalc() {
  const result = calculateQuote(draft);
  result.lineResults.forEach((r, i) => {
    const line = draft.lines[i];
    const target = document.getElementById(`result-${line.id}`);
    if (target) target.textContent = `${r.totalWeightKg.toFixed(3)} kg • Direct cost ${money(r.directCost)}`;
  });
  $('#sumLines').textContent = money(result.linesCost);
  $('#sumSetup').textContent = money(result.setupCost);
  $('#sumOverhead').textContent = money(result.overheadAmount);
  $('#sumProduction').textContent = money(result.productionCost);
  $('#sumMarkup').textContent = money(result.markupAmount);
  $('#sumSubtotal').textContent = money(result.subtotal);
  $('#sumGst').textContent = money(result.gstAmount);
  const grand = $('#sumGrand');
  grand.textContent = money(result.grandTotal);
  grand.classList.remove('total-flash');
  void grand.offsetWidth;
  grand.classList.add('total-flash');
  $('#summaryMeta').textContent = `${draft.lines.length} item${draft.lines.length === 1 ? '' : 's'} • ${draft.status}`;
  const itemKpi = $('#kpiItems');
  const statusKpi = $('#kpiStatus');
  const totalKpi = $('#kpiTotal');
  if (itemKpi) itemKpi.textContent = `${draft.lines.length} item${draft.lines.length === 1 ? '' : 's'}`;
  if (statusKpi) statusKpi.textContent = draft.status;
  if (totalKpi) totalKpi.textContent = money(result.grandTotal);
  draft.updatedAt = new Date().toISOString();
  return result;
}

function showToast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function validateDraft() {
  if (!draft.ref.trim()) return 'Quote reference is required.';
  if (!draft.customer.trim()) return 'Customer name is required before saving.';
  for (const [i, line] of draft.lines.entries()) {
    if (line.lengthMm <= 0 || line.widthMm <= 0 || line.thicknessMm <= 0) return `Item ${i+1}: dimensions must be greater than zero.`;
    if (line.density <= 0) return `Item ${i+1}: density must be greater than zero.`;
    if (line.quantity < 1) return `Item ${i+1}: quantity must be at least 1.`;
  }
  return null;
}

function saveQuote() {
  const error = validateDraft();
  if (error) return showToast(error);
  const copy = structuredClone(draft);
  const i = state.quotes.findIndex((q) => q.id === draft.id);
  if (i >= 0) state.quotes[i] = copy; else state.quotes.unshift(copy);
  saveState(state);
  renderHistory();
  showToast('Quote saved on this device.');
}

function newQuote() {
  const previousRef = draft.ref;
  draft = {
    id: makeId('quote'), ref: incrementRef(previousRef), customer: '', status: 'Draft', validDays: 15, notes: '',
    setupCost: 100, overheadPct: nonNegative(state.settings.overheadPct ?? 8), markupPct: nonNegative(state.settings.markupPct ?? 25), gstPct: nonNegative(state.settings.gstPct ?? 18),
    lines: [defaultLine()], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  renderAll();
  showToast('New quote started.');
}

function incrementRef(ref) {
  const m = String(ref).match(/^(.*?)(\d+)$/);
  if (!m) return `KQ-${Date.now().toString().slice(-6)}`;
  return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`;
}

function loadQuote(id) {
  const q = state.quotes.find((x) => x.id === id);
  if (!q) return;
  draft = structuredClone(q);
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteQuote(id) {
  state.quotes = state.quotes.filter((x) => x.id !== id);
  saveState(state);
  renderHistory();
  showToast('Saved quote deleted.');
}

function duplicateQuote(id) {
  const q = state.quotes.find((x) => x.id === id);
  if (!q) return;
  draft = structuredClone(q);
  draft.id = makeId('quote');
  draft.ref = incrementRef(q.ref);
  draft.status = 'Draft';
  draft.createdAt = new Date().toISOString();
  draft.updatedAt = draft.createdAt;
  renderAll();
  showToast('Quote duplicated.');
}

function renderHistory() {
  const body = $('#historyBody');
  if (!state.quotes.length) {
    body.innerHTML = '<tr><td colspan="6" class="muted">No saved quotes yet.</td></tr>';
    return;
  }
  body.innerHTML = state.quotes.map((q) => {
    const total = calculateQuote(q).grandTotal;
    return `<tr><td><strong>${escapeHtml(q.ref)}</strong></td><td>${escapeHtml(q.customer)}</td><td><span class="status-chip">${escapeHtml(q.status)}</span></td><td>${new Date(q.updatedAt).toLocaleDateString('en-IN')}</td><td class="num"><strong>${money(total)}</strong></td><td class="actions-cell"><button data-load="${q.id}">Open</button><button data-copy="${q.id}">Copy</button><button class="danger" data-delete="${q.id}">Delete</button></td></tr>`;
  }).join('');
  $$('[data-load]').forEach((b) => b.onclick = () => loadQuote(b.dataset.load));
  $$('[data-copy]').forEach((b) => b.onclick = () => duplicateQuote(b.dataset.copy));
  $$('[data-delete]').forEach((b) => b.onclick = () => deleteQuote(b.dataset.delete));
}

function exportCsv() {
  if (!state.quotes.length) return showToast('Save at least one quote first.');
  const rows = [['Reference','Customer','Status','Updated','Subtotal','GST','Grand Total']];
  state.quotes.forEach((q) => {
    const r = calculateQuote(q);
    rows.push([q.ref, q.customer, q.status, q.updatedAt, r.subtotal.toFixed(2), r.gstAmount.toFixed(2), r.grandTotal.toFixed(2)]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'karkhanaquote-quotes.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

function renderPrintHeader() {
  $('#printCompany').textContent = state.settings.companyName || 'KarkhanaQuote Beta';
  $('#printGstin').textContent = state.settings.gstin ? `GSTIN: ${state.settings.gstin}` : '';
  $('#printQuote').textContent = `Quotation ${draft.ref}`;
  $('#printCustomer').textContent = `Customer: ${draft.customer || '—'}`;
  $('#printValidity').textContent = `Status: ${draft.status} • Validity: ${draft.validDays} day${draft.validDays === 1 ? '' : 's'}`;
}

function renderAll() {
  syncHeaderValuesOnly();
  renderLines();
  renderHistory();
  renderPrintHeader();
}

function syncHeaderValuesOnly() {
  ['ref','customer','status','validDays','notes','setupCost','overheadPct','markupPct','gstPct'].forEach((id) => {
    const el = document.getElementById(id); if (el) el.value = draft[id];
  });
}

syncHeader();
$('#addLine').onclick = () => { draft.lines.push(defaultLine()); renderLines(); };
$('#saveQuote').onclick = saveQuote;
$('#newQuote').onclick = newQuote;
$('#exportCsv').onclick = exportCsv;
$('#printQuoteBtn').onclick = () => { renderPrintHeader(); window.print(); };
const settingFields = {
  companyName: 'companyName', gstin: 'gstin', msRate: 'msRate', ssRate: 'ssRate', aluminiumRate: 'aluminiumRate',
  wastePct: 'defaultWastePct', cutRatePerM: 'defaultCutRate', pierceRate: 'defaultPierceRate',
  overheadPct: 'defaultOverheadPct', markupPct: 'defaultMarkupPct',
};
Object.entries(settingFields).forEach(([key, id]) => {
  const el = document.getElementById(id);
  if (el) el.value = state.settings[key] ?? '';
});
$('#saveSettings').onclick = () => {
  state.settings.companyName = $('#companyName').value.trim();
  state.settings.gstin = $('#gstin').value.trim();
  for (const [key, id] of Object.entries(settingFields)) {
    if (key === 'companyName' || key === 'gstin') continue;
    state.settings[key] = nonNegative(document.getElementById(id).value);
  }
  state.settings.gstPct = nonNegative($('#gstPct').value);
  saveState(state); renderPrintHeader(); showToast('Workshop defaults saved.');
};
$('#applyDefaults').onclick = () => {
  draft.overheadPct = nonNegative(state.settings.overheadPct ?? 8);
  draft.markupPct = nonNegative(state.settings.markupPct ?? 25);
  draft.gstPct = nonNegative(state.settings.gstPct ?? 18);
  draft.lines.forEach((line) => {
    if (line.materialKey !== 'custom') line.materialRatePerKg = rateForMaterial(line.materialKey);
    line.wastePct = nonNegative(state.settings.wastePct ?? 10);
    line.cutRatePerM = nonNegative(state.settings.cutRatePerM ?? 10);
    line.pierceRate = nonNegative(state.settings.pierceRate ?? 1);
  });
  syncHeaderValuesOnly(); renderLines(); showToast('Workshop defaults applied to this quote.');
};

renderAll();
