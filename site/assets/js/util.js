// Shared helpers for the Cortex site (no dependencies).

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function money(n, { digits } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  const d = digits ?? (n >= 100 ? 0 : n >= 1 ? 2 : n >= 0.01 ? 3 : 4);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: d > 2 ? 2 : d, maximumFractionDigits: d })}`;
}

export function compact(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}M`;
  if (n >= 1000) return `${+(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

export function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function relTime(iso) {
  const d = daysSince(iso);
  if (d === Infinity) return 'unknown';
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

let registryPromise;
/** The model registry (refreshed daily by GitHub Actions, shipped with each deploy). */
export function loadRegistry() {
  registryPromise ||= fetch('/data/registry.json').then(r => {
    if (!r.ok) throw new Error(`registry HTTP ${r.status}`);
    return r.json();
  });
  return registryPromise;
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

/** Store a value for another page (e.g. Stack Lab → Playground handoff). */
export function handoff(key, value) {
  try { sessionStorage.setItem(`cortex:${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function takeHandoff(key) {
  try {
    const v = sessionStorage.getItem(`cortex:${key}`);
    if (v) sessionStorage.removeItem(`cortex:${key}`);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
