// Small preferences store (localStorage). Theme keeps its own key (et_theme).

const KEY = 'et_prefs';

const DEFAULTS = {
  name: '',        // display name for greeting/avatar
  accent: 'gold',  // 'gold' | 'violet' | 'sage' | 'ocean' | 'rose'
  weekStart: 'mon', // 'mon' | 'sun'
};

export const ACCENTS = [
  { key: 'gold', label: 'Champagne' },
  { key: 'violet', label: 'Violet' },
  { key: 'sage', label: 'Sage' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'rose', label: 'Rose' },
];

export function loadPrefs() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
