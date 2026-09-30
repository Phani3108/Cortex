// Academy: learning library generated from the same catalog the Lab uses.
import { TARGETS } from '/engine/src/engine/index.js';
import { $, esc, loadRegistry } from './util.js';
import { CATEGORIES, PRESETS, buildCatalog } from './stack-data.js';
import { learningPath, CH } from './buildpack.js';

const yt = k => ({ name: CH[k].name, url: `https://www.youtube.com/@${CH[k].handle}` });
const q = s => `https://www.youtube.com/results?search_query=${encodeURIComponent(s)}`;

function card(i) {
  return `<div class="card">
    <strong>${esc(i.label)}</strong>
    <div class="stack-sm" style="margin-top:8px">
      ${i.docs ? `<a class="small" href="${esc(i.docs)}" rel="noopener" target="_blank">Official docs ↗</a>` : ''}
      ${i.channels.map(c => `<a class="small" href="${esc(c.url)}" rel="noopener" target="_blank">▶ ${esc(c.name)}</a>`).join('')}
      <a class="small muted" href="${esc(i.search)}" rel="noopener" target="_blank">Recent tutorials ↗</a>
    </div></div>`;
}

async function main() {
  let registry = null;
  try { registry = await loadRegistry(); } catch { /* offline: tiers still render */ }
  const catalog = buildCatalog({ registry, targets: TARGETS });
  const byId = new Map(catalog.map(t => [t.id, t]));
  const lp = learningPath({ selected: catalog.map(t => t.id), catalog: byId });
  const groups = CATEGORIES.filter(c => c.id !== 'patterns').map(c => [c, lp.items.filter(i => i.category === c.id)]).filter(([, items]) => items.length);

  $('#library').innerHTML = groups.map(([c, items]) => `
    <div style="margin-top:28px"><h3 class="h3" style="margin-bottom:12px">${esc(c.label)}</h3>
    <div class="grid grid-4" style="gap:12px">${items.map(card).join('')}</div></div>`).join('');

  const foundations = [
    { title: 'System design & architecture', links: [yt('bbg'), yt('hussein')] },
    { title: 'Fast overviews of any technology', links: [yt('fireship'), yt('fcc')] },
    { title: 'Building with AI (LLM apps & agents)', links: [yt('aie'), yt('anthropic'), yt('openai')] },
  ];
  $('#foundations').innerHTML = foundations.map(f => `<div class="card"><strong>${esc(f.title)}</strong><div class="stack-sm" style="margin-top:8px">${f.links.map(c => `<a class="small" href="${esc(c.url)}" rel="noopener" target="_blank">▶ ${esc(c.name)}</a>`).join('')}</div></div>`).join('');

  $('#build-alongs').innerHTML = Object.values(PRESETS).map(p => {
    const labels = p.chips.map(id => byId.get(id)).filter(t => t && ['frontend', 'backend', 'database'].includes(t.category)).map(t => t.label);
    return `<a class="card card-hover" href="${esc(q(`build a ${p.name} with ${labels.slice(0, 3).join(' ')} full tutorial`))}" rel="noopener" target="_blank" style="color:inherit;text-decoration:none">
      <strong>${esc(p.name)}</strong><p class="small" style="margin-top:6px">${esc(labels.join(' · ') || p.headline)}</p><span class="small" style="color:var(--brand)">Watch builds like this ↗</span></a>`;
  }).join('');
}
main();
