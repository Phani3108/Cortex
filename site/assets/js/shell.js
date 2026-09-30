// Site chrome: theme toggle, mobile nav, copy buttons, data-freshness badge.
import { $, $$, copyText, toast, loadRegistry, relTime, daysSince, COPY_ICON } from './util.js';

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>';

function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paintThemeIcon() {
  const svg = $('#theme-toggle svg');
  if (svg) svg.innerHTML = currentTheme() === 'dark' ? SUN : MOON;
  const btn = $('#theme-toggle');
  if (btn) btn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function initTheme() {
  paintThemeIcon();
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cortex-theme', next); } catch { /* private mode */ }
    paintThemeIcon();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintThemeIcon);
}

function initNav() {
  const toggle = $('#nav-toggle');
  const links = $('#nav-links');
  toggle?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', e => {
    if (e.target.closest('a')) { links.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); }
  });
  const page = document.body.dataset.page;
  if (page) $$(`[data-nav="${page}"]`).forEach(a => a.setAttribute('aria-current', 'page'));
}

/** Any element with [data-copy] (text) or [data-copy-target] (selector) copies on click. */
function initCopy() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-copy], [data-copy-target]');
    if (!btn) return;
    const text = btn.dataset.copy ?? $(btn.dataset.copyTarget)?.textContent ?? '';
    await copyText(text.trim());
    btn.classList.add('copied');
    const label = btn.querySelector('.copy-label');
    if (label) { const prev = label.textContent; label.textContent = 'Copied'; setTimeout(() => { label.textContent = prev; }, 1500); }
    setTimeout(() => btn.classList.remove('copied'), 1500);
    toast('Copied to clipboard');
  });
  for (const btn of $$('.copy-btn:not(:has(svg))')) btn.insertAdjacentHTML('afterbegin', COPY_ICON);
}

async function initFreshness() {
  const els = $$('[data-freshness]');
  if (!els.length) return;
  try {
    const reg = await loadRegistry();
    const stale = daysSince(reg.lastUpdated) > 7;
    for (const el of els) {
      el.classList.toggle('is-stale', stale);
      el.querySelector('span:last-child').textContent = `${reg.modelCount || Object.keys(reg.models).length} models · data updated ${relTime(reg.lastUpdated)}`;
      el.title = `Source: ${reg.source?.name || 'registry'} — refreshed daily by GitHub Actions`;
    }
  } catch {
    for (const el of els) el.querySelector('span:last-child').textContent = 'Model data unavailable';
  }
}

initTheme();
initNav();
initCopy();
initFreshness();
