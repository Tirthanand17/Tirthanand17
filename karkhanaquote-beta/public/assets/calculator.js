export const MATERIALS = Object.freeze({
  ms: { name: 'Mild Steel', density: 7850 },
  ss304: { name: 'Stainless Steel 304', density: 7930 },
  aluminium: { name: 'Aluminium', density: 2700 },
  brass: { name: 'Brass', density: 8500 },
});

export function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function nonNegative(value) {
  return Math.max(0, asNumber(value));
}

export function positiveInt(value, fallback = 1) {
  const n = Math.floor(asNumber(value, fallback));
  return n >= 1 ? n : fallback;
}

export function calculateLine(raw = {}) {
  const lengthMm = nonNegative(raw.lengthMm);
  const widthMm = nonNegative(raw.widthMm);
  const thicknessMm = nonNegative(raw.thicknessMm);
  const density = nonNegative(raw.density);
  const quantity = positiveInt(raw.quantity, 1);
  const materialRatePerKg = nonNegative(raw.materialRatePerKg);
  const wastePct = nonNegative(raw.wastePct);
  const cutLengthMm = nonNegative(raw.cutLengthMm);
  const cutRatePerM = nonNegative(raw.cutRatePerM);
  const pierces = nonNegative(raw.pierces);
  const pierceRate = nonNegative(raw.pierceRate);
  const secondaryOps = nonNegative(raw.secondaryOps);

  const volumeM3PerPiece = lengthMm * widthMm * thicknessMm * 1e-9;
  const weightPerPieceKg = volumeM3PerPiece * density;
  const totalWeightKg = weightPerPieceKg * quantity;
  const materialBase = totalWeightKg * materialRatePerKg;
  const materialCost = materialBase * (1 + wastePct / 100);
  const cuttingCost = (cutLengthMm / 1000) * cutRatePerM * quantity;
  const piercingCost = pierces * pierceRate * quantity;
  const directCost = materialCost + cuttingCost + piercingCost + secondaryOps;

  return {
    weightPerPieceKg,
    totalWeightKg,
    materialCost,
    cuttingCost,
    piercingCost,
    secondaryOps,
    directCost,
  };
}

export function calculateQuote(raw = {}) {
  const lines = Array.isArray(raw.lines) && raw.lines.length ? raw.lines : [{}];
  const lineResults = lines.map(calculateLine);
  const linesCost = lineResults.reduce((sum, line) => sum + line.directCost, 0);
  const setupCost = nonNegative(raw.setupCost);
  const overheadPct = nonNegative(raw.overheadPct);
  const markupPct = nonNegative(raw.markupPct);
  const gstPct = nonNegative(raw.gstPct);

  const costBeforeOverhead = linesCost + setupCost;
  const overheadAmount = costBeforeOverhead * (overheadPct / 100);
  const productionCost = costBeforeOverhead + overheadAmount;
  const markupAmount = productionCost * (markupPct / 100);
  const subtotal = productionCost + markupAmount;
  const gstAmount = subtotal * (gstPct / 100);
  const grandTotal = subtotal + gstAmount;

  return {
    lineResults,
    linesCost,
    setupCost,
    overheadAmount,
    productionCost,
    markupAmount,
    subtotal,
    gstAmount,
    grandTotal,
  };
}

export function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}
