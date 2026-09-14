const KEY = 'karkhanaquote:v1';

function blankState() {
  return { quotes: [], rateCards: [], settings: { companyName: '', gstin: '', msRate: 70, ssRate: 220, aluminiumRate: 260, wastePct: 10, cutRatePerM: 10, pierceRate: 1, overheadPct: 8, markupPct: 25, gstPct: 18 } };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    return {
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
      rateCards: Array.isArray(parsed.rateCards) ? parsed.rateCards : [],
      settings: parsed.settings && typeof parsed.settings === 'object'
        ? parsed.settings
        : blankState().settings,
    };
  } catch {
    return blankState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function makeId(prefix = 'q') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
