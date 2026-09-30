// Models page: registry table, filters, context-cost calculator.
import { $, $$, esc, money, compact, loadRegistry, relTime, daysSince } from './util.js';

let reg;
const view = { q: '', vendor: '', activeOnly: true, sort: 'released', dir: -1 };

const FLAGSHIP_KEYS = [['anthropic', 'opus'], ['anthropic', 'sonnet'], ['anthropic', 'fable'], ['openai', 'sol'], ['openai', 'astra'], ['google', 'pro'], ['x-ai', 'default'], ['deepseek', 'pro'], ['qwen', 'max'], ['moonshotai', 'default'], ['z-ai', 'default']];
const BUDGET_KEYS = [['anthropic', 'haiku'], ['openai', 'luna'], ['openai', 'mini'], ['google', 'flash'], ['google', 'flash-lite'], ['deepseek', 'flash'], ['qwen', 'flash'], ['z-ai', 'flash'], ['meta-llama', 'scout'], ['mistralai', 'small']];

function rows() {
  const q = view.q.trim().toLowerCase();
  let list = Object.values(reg.models).filter(m => {
    if (view.activeOnly && m.status !== 'active') return false;
    if (view.vendor && m.vendor !== view.vendor) return false;
    if (q && !`${m.id} ${m.name} ${m.vendor} ${m.tier}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const key = {
    name: m => (m.name || m.id).toLowerCase(), vendor: m => m.vendor, tier: m => m.tier || '',
    input: m => m.costPer1M.input, output: m => m.costPer1M.output, context: m => m.contextWindow || 0, released: m => m.released || '',
  }[view.sort];
  list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * view.dir);
  return list;
}

function renderTable() {
  const list = rows();
  $('#f-count').textContent = `${list.length} model${list.length === 1 ? '' : 's'}`;
  const body = $('#models-table tbody');
  if (!list.length) { body.innerHTML = '<tr><td colspan="7" class="muted">No models match.</td></tr>'; return; }
  body.innerHTML = list.map(m => `<tr>
    <td><div style="font-weight:600">${esc(m.name || m.id)}</div><div class="mono muted">${esc(m.id)}</div></td>
    <td>${esc(reg.vendors?.[m.vendor] || m.vendor)}</td>
    <td>${m.tier ? `<span class="badge">${esc(m.tier)}</span>` : '<span class="muted">—</span>'}${m.status !== 'active' ? ` <span class="badge badge-warn">${esc(m.status)}</span>` : ''}</td>
    <td class="num">${money(m.costPer1M.input)}</td>
    <td class="num">${money(m.costPer1M.output)}</td>
    <td class="num">${compact(m.contextWindow)}</td>
    <td class="small">${esc(m.released || '—')}</td>
  </tr>`).join('');
  for (const b of $$('#models-table th button')) {
    const active = b.dataset.sort === view.sort;
    b.textContent = b.textContent.replace(/ [↑↓]$/, '') + (active ? (view.dir === 1 ? ' ↑' : ' ↓') : '');
    b.closest('th').setAttribute('aria-sort', active ? (view.dir === 1 ? 'ascending' : 'descending') : 'none');
  }
}

function renderStats() {
  const all = Object.values(reg.models);
  const recent = all.filter(m => daysSince(m.released) <= 30).length;
  const vendors = new Set(all.map(m => m.vendor)).size;
  const values = [all.length, vendors, recent, relTime(reg.lastUpdated)];
  $$('#stats .stat-value').forEach((el, i) => { el.textContent = values[i]; });
}

// ── Calculator ──────────────────────────────────────────────────────────────
function comparisonSet() {
  const set = $('#c-set').value;
  const h = reg.highlights || {};
  let ids;
  if (set === 'flagships') ids = FLAGSHIP_KEYS.map(([v, t]) => h[v]?.[t]);
  else if (set === 'budget') ids = BUDGET_KEYS.map(([v, t]) => h[v]?.[t]);
  else ids = Object.values(reg.models).filter(m => m.status === 'active').sort((a, b) => a.costPer1M.input - b.costPer1M.input).slice(0, 12).map(m => m.id);
  return [...new Set(ids.filter(Boolean))].map(id => reg.models[id]).filter(Boolean);
}

function renderCalculator() {
  const tokens = Math.max(0, Number($('#c-tokens').value) || 0);
  const perDay = Math.max(0, Number($('#c-requests').value) || 0);
  const days = Math.max(0, Number($('#c-days').value) || 0);
  const cache = $('#c-cache').checked;
  const requests = perDay * days;
  const data = comparisonSet().map(m => {
    const price = cache && m.costPer1M.cacheRead ? m.costPer1M.cacheRead : m.costPer1M.input;
    return { m, price, cached: cache && !!m.costPer1M.cacheRead, cost: (tokens * requests / 1e6) * price };
  }).sort((a, b) => a.cost - b.cost);

  $('#c-note').textContent = `${compact(tokens * requests)} input tokens / month`;
  const max = Math.max(...data.map(d => d.cost), 0.0001);
  $('#c-chart').innerHTML = data.length ? `<div style="display:grid;gap:7px">${data.map(d => `
    <div style="display:grid;grid-template-columns:minmax(110px,34%) 1fr auto;gap:10px;align-items:center" title="${esc(d.m.id)}: ${money(d.cost)}/month at ${money(d.price)} per 1M${d.cached ? ' (cache read)' : ''}">
      <span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.m.name || d.m.id)}</span>
      <span style="height:14px;background:var(--bg-sunken);border-radius:0 4px 4px 0;overflow:hidden"><span style="display:block;height:100%;width:${Math.max(1, (d.cost / max) * 100)}%;background:var(--data-1);border-radius:0 4px 4px 0"></span></span>
      <span class="small" style="font-variant-numeric:tabular-nums;min-width:64px;text-align:right">${money(d.cost)}</span>
    </div>`).join('')}</div>` : '<div class="empty">No models in this set.</div>';

  $('#c-table').innerHTML = `<thead><tr><th>Model</th><th class="num">Price used / 1M</th><th class="num">Monthly</th></tr></thead><tbody>${data.map(d => `<tr><td>${esc(d.m.id)}</td><td class="num">${money(d.price)}${d.cached ? ' <span class="tiny muted">cache</span>' : ''}</td><td class="num">${money(d.cost)}</td></tr>`).join('')}</tbody>`;
}

// ── Boot ────────────────────────────────────────────────────────────────────
async function main() {
  try {
    reg = await loadRegistry();
  } catch {
    $('#models-table tbody').innerHTML = '<tr><td colspan="7">Could not load model data.</td></tr>';
    return;
  }
  const vendors = [...new Set(Object.values(reg.models).map(m => m.vendor))].sort();
  $('#f-vendor').insertAdjacentHTML('beforeend', vendors.map(v => `<option value="${esc(v)}">${esc(reg.vendors?.[v] || v)}</option>`).join(''));

  const params = new URLSearchParams(location.search);
  if (params.get('q')) { view.q = params.get('q'); $('#f-q').value = view.q; view.activeOnly = false; $('#f-active').checked = false; }

  $('#f-q').addEventListener('input', e => { view.q = e.target.value; renderTable(); });
  $('#f-vendor').addEventListener('change', e => { view.vendor = e.target.value; renderTable(); });
  $('#f-active').addEventListener('change', e => { view.activeOnly = e.target.checked; renderTable(); });
  $('#models-table thead').addEventListener('click', e => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    if (view.sort === b.dataset.sort) view.dir *= -1;
    else { view.sort = b.dataset.sort; view.dir = ['name', 'vendor', 'tier'].includes(view.sort) ? 1 : -1; }
    renderTable();
  });
  for (const id of ['#c-tokens', '#c-requests', '#c-days', '#c-set', '#c-cache']) $(id).addEventListener('input', renderCalculator);

  renderStats();
  renderTable();
  renderCalculator();
}
main();
