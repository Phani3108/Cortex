// Build Pack view: renders the Lab's output (clarity gate + 7 sections).
import { $, $$, esc, money, copyText, toast } from './util.js';
import { clarity, architecture, skeleton, cost, learningPath, prompts, planMarkdown } from './buildpack.js';
import { download } from './zip.js';

const TABS = [
  ['overview', 'Overview'], ['architecture', 'Architecture'], ['skeleton', 'Skeleton'], ['cost', 'Cost'],
  ['learn', 'Learn'], ['prompts', 'Prompts'], ['rules', 'AI rules (.cortex)'],
];
const states = {};
const bound = new WeakSet();
const lastCtx = {};

function gauge(c) {
  const cls = c.level === 'ready' ? '' : c.level === 'almost' ? 'is-warn' : 'is-over';
  return `<div class="bp-gauge">
    <div class="bp-score"><span class="bp-num">${c.score}</span><span class="muted small">/100</span></div>
    <div style="flex:1;min-width:0">
      <div class="row" style="gap:8px"><strong>Clarity</strong><span class="badge ${c.level === 'ready' ? 'badge-ok' : c.level === 'almost' ? 'badge-warn' : 'badge-bad'}">${esc(c.label)}</span></div>
      <div class="meter ${cls}" style="margin-top:8px" role="progressbar" aria-label="Clarity score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.score}"><span style="width:${c.score}%"></span></div>
    </div>
  </div>`;
}

function checklist(c) {
  return `<ul class="bp-checks">${c.checks.map(k => `<li class="${k.ok ? 'ok' : 'gap'}"><span aria-hidden="true">${k.ok ? '✓' : '○'}</span>
    <span><strong>${esc(k.title)}</strong>${k.ok ? '' : `<span class="small muted"> — ${esc(k.fix)}</span>`}<span class="visually-hidden">${k.ok ? ' (done)' : ' (gap)'}</span></span></li>`).join('')}</ul>`;
}

function overview(ctx, c, arch) {
  const i = ctx.intent || {};
  const field = (label, v) => `<div class="bp-field"><div class="eyebrow" style="margin:0 0 4px">${label}</div>${v ? `<p>${esc(v)}</p>` : '<p class="muted small">Not defined — this is a gap.</p>'}</div>`;
  const fields = ctx.persona === 'extend'
    ? field('Feature', i.feature) + field('Must not break', i.guardrails)
    : field('What', i.idea) + (ctx.persona === 'pick' ? '' : field('For', i.users) + field('Edge', i.moat) + field('Success in 90 days', i.success));
  const traps = ctx.rec?.traps || [];
  return `<div class="bp-grid">
    <div class="stack">
      <div class="card"><h4 class="h3" style="margin-bottom:10px">Your intent</h4><div class="bp-fields">${fields}</div></div>
      <div class="card"><h4 class="h3" style="margin-bottom:10px">Readiness checklist</h4>${checklist(c)}</div>
    </div>
    <div class="stack">
      <div class="card"><h4 class="h3">Shape</h4><p class="small" style="margin-top:6px">${esc(arch.style)} · ${esc(ctx.title || '')}</p>
        <div class="chips" style="margin-top:10px">${(ctx.selected || []).map(id => ctx.catalog.get(id)).filter(Boolean).map(t => `<span class="sl-tag">${esc(t.model?.name || t.label)}</span>`).join('')}</div></div>
      ${traps.length ? `<div class="card"><h4 class="h3" style="margin-bottom:8px">Traps you now know about</h4><ul class="bp-list">${traps.map(t => `<li><strong>${esc(t.title)}.</strong> <span class="small muted">${esc(t.text)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="callout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/></svg>
        <div><strong>Next:</strong> ${c.level === 'ready' ? 'review the architecture and cost, then take Phase 1 of the prompts to your AI tool.' : 'close the gaps above first. Every gap you leave is a guess your AI tool will make for you.'}</div></div>
    </div>
  </div>`;
}

function archView(arch) {
  return `<p class="small muted" style="margin-bottom:14px">Requests flow left → right. <strong>${esc(arch.style)}</strong> — start here and split only when a measured bottleneck forces it.</p>
  <div class="bp-arch" role="list">${arch.lanes.map((l, i) => `
    <div class="bp-lane" role="listitem"><div class="bp-lane-h">${esc(l.title)}</div>
      ${l.nodes.map(n => `<div class="bp-node"><strong>${esc(n.label)}</strong>${n.note ? `<span>${esc(n.note)}</span>` : ''}</div>`).join('')}
    </div>${i < arch.lanes.length - 1 ? '<div class="bp-arrow" aria-hidden="true">→</div>' : ''}`).join('')}
  </div>`;
}

function costView(cr) {
  const r = ([a, b]) => `${money(a, { digits: 0 })} – ${money(b, { digits: 0 })}`;
  return `<div class="grid grid-2" style="gap:16px">
    <div class="card">
      <h4 class="h3">Infrastructure / month</h4>
      <p class="stat-value" style="margin-top:8px">${r(cr.infra)}</p>
      <p class="small muted">at ~${cr.users.toLocaleString()} users · order of magnitude, verify with provider calculators</p>
      <table class="table" style="margin-top:12px"><tbody>${cr.lines.map(l => `<tr><td>${esc(l.item)}</td><td class="num">${r(l.range)}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card">
      <h4 class="h3">AI features / month</h4>
      ${cr.ai.length ? `<p class="small muted" style="margin-top:6px">Live model prices from the registry. ${esc(cr.ai[0].assumption)}.</p>
        <table class="table" style="margin-top:12px"><tbody>${cr.ai.map(x => `<tr><td>${esc(x.model.name)}<div class="tiny muted">${money(x.model.costPer1M.input)} in / ${money(x.model.costPer1M.output)} out per 1M</div></td><td class="num"><strong>${money(x.monthly, { digits: 0 })}</strong></td></tr>`).join('')}</tbody></table>
        <p class="tiny muted" style="margin-top:8px">Route routine calls to the cheapest model that passes your evals; cache repeated context.</p>`
        : '<p class="small muted" style="margin-top:8px">No AI model in this plan. Add a model tier to see what AI features would cost at your scale.</p>'}
    </div>
  </div>`;
}

function learnView(lp) {
  return `<p class="small muted" style="margin-bottom:14px">Learn the pieces before an AI writes them for you — you can’t review code you don’t understand.</p>
  <div class="grid grid-3" style="gap:12px">${lp.items.map(i => `<div class="card">
    <strong>${esc(i.label)}</strong>
    <div class="stack-sm" style="margin-top:8px">
      ${i.docs ? `<a class="small" href="${esc(i.docs)}" rel="noopener" target="_blank">Official docs ↗</a>` : ''}
      ${i.channels.map(ch => `<a class="small" href="${esc(ch.url)}" rel="noopener" target="_blank">▶ ${esc(ch.name)}</a>`).join('')}
      <a class="small muted" href="${esc(i.search)}" rel="noopener" target="_blank">Search recent tutorials ↗</a>
    </div></div>`).join('') || '<div class="empty">Pick a stack to get a learning path.</div>'}</div>
  <div class="card" style="margin-top:14px"><strong>Foundations for any stack</strong>
    <div class="row" style="margin-top:8px;gap:14px">${lp.foundations.map(ch => `<a class="small" href="${esc(ch.url)}" rel="noopener" target="_blank">▶ ${esc(ch.name)}</a>`).join('')}
    ${lp.buildAlong ? `<a class="small" href="${esc(lp.buildAlong)}" rel="noopener" target="_blank">See how a build like this looks ↗</a>` : ''}</div></div>`;
}

function promptsView(phases, c, ps, key) {
  const locked = c.level === 'blind' && !ps.unlocked;
  if (locked) {
    return `<div class="bp-lock">
      <h4 class="h3">Prompts are locked until your plan is clear</h4>
      <p class="small text-2" style="margin-top:6px">A vague prompt makes the AI guess — and you pay for every guess in tokens, rework and a product without a point. Close these gaps first:</p>
      ${checklist({ checks: c.checks.filter(k => !k.ok) })}
      <button type="button" class="btn btn-ghost btn-sm" data-pack-unlock="${key}" style="margin-top:12px">Show them anyway</button>
    </div>`;
  }
  return `<p class="small muted" style="margin-bottom:14px">Use one phase at a time, in order. Each ends with the AI stopping for your review — that’s where quality comes from.</p>
  <div class="stack">${phases.map((p, i) => `<div class="card bp-phase">
    <div class="row"><span class="step-n" style="margin:0">${i + 1}</span><div><strong>${esc(p.title)}</strong><div class="tiny muted">${esc(p.when)}</div></div><span class="spacer"></span>
      <button type="button" class="copy-btn" data-pack-copy="${i}"><span class="copy-label">Copy prompt</span></button></div>
    <pre class="bp-prompt">${esc(p.prompt)}</pre></div>`).join('')}</div>`;
}

/**
 * @param {HTMLElement} outer - the [data-cfg-slot] container
 * @param {string} key
 * @param {object} ctx - { persona, selected, catalog(Map), registry, answers, intent, rec, title, name, targets }
 */
export function renderPack(outer, key, ctx) {
  const ps = (states[key] ||= { tab: 'overview', unlocked: false });
  const c = clarity(ctx);
  const arch = architecture(ctx);
  const tree = skeleton(ctx);
  const cr = cost(ctx, ctx.registry);
  const lp = learningPath(ctx);
  const phases = prompts({ ...ctx, tree });
  lastCtx[key] = { ctx, parts: { clarityRes: c, arch, tree, costRes: cr, learn: lp, phases } };

  const panels = {
    overview: overview(ctx, c, arch),
    architecture: archView(arch),
    skeleton: `<p class="small muted" style="margin-bottom:12px">How the repository should look before any feature exists. Phase 2 of the prompts asks your AI tool to create exactly this.</p><div class="code"><div class="code-head"><span>${esc(ctx.name || 'my-app')}/</span><span class="spacer"></span><button class="copy-btn" data-pack-copy-tree="${key}"><span class="copy-label">Copy</span></button></div><pre>${esc(tree)}</pre></div>`,
    cost: costView(cr),
    learn: learnView(lp),
    prompts: promptsView(phases, c, ps, key),
    rules: `<p class="small muted" style="margin-bottom:12px">Your vision, stack and guardrails as rules every AI tool reads on every request — so they stay on course after the first prompt.</p><div data-cfg-inner="${key}"></div>`,
  };
  outer.innerHTML = `<section class="bp" aria-label="Build pack">
    <div class="bp-head">
      <div><div class="eyebrow" style="margin-bottom:4px">Your build pack</div><h3 class="h2" style="font-size:1.5rem">${esc(ctx.title || 'Plan')}</h3></div>
      ${gauge(c)}
    </div>
    <div class="tabs bp-tabs" role="tablist" aria-label="Build pack sections">${TABS.map(([id, label]) => `<button type="button" class="tab" role="tab" data-pack-tab="${id}" aria-selected="${ps.tab === id}" tabindex="${ps.tab === id ? 0 : -1}">${esc(label)}${id === 'prompts' && c.level === 'blind' && !ps.unlocked ? ' 🔒' : ''}</button>`).join('')}</div>
    ${TABS.map(([id]) => `<div class="bp-panel" role="tabpanel" data-pack-panel="${id}" ${ps.tab === id ? '' : 'hidden'}>${panels[id]}</div>`).join('')}
    <div class="bp-actions">
      <button type="button" class="btn btn-ghost" data-pack-plan="${key}">Download PLAN.md</button>
      <span class="spacer"></span>
      <button type="button" class="btn btn-ghost" data-pack-tabjump="prompts">See the prompts</button>
      <button type="button" class="btn btn-brand" data-pack-tabjump="rules">Compile for my AI tools →</button>
    </div>
  </section>`;

  if (!bound.has(outer)) {
    bound.add(outer);
    outer.addEventListener('click', async e => {
      const st = states[key];
      const tab = e.target.closest('[data-pack-tab], [data-pack-tabjump]');
      if (tab) {
        st.tab = tab.dataset.packTab || tab.dataset.packTabjump;
        for (const b of $$('[data-pack-tab]', outer)) { const on = b.dataset.packTab === st.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
        for (const p of $$('[data-pack-panel]', outer)) p.hidden = p.dataset.packPanel !== st.tab;
        if (tab.dataset.packTabjump) $(`[data-pack-tab="${st.tab}"]`, outer)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (e.target.closest('[data-pack-unlock]')) { st.unlocked = true; const L = lastCtx[key]; $(`[data-pack-panel="prompts"]`, outer).innerHTML = promptsView(L.parts.phases, L.parts.clarityRes, st, key); $(`[data-pack-tab="prompts"]`, outer).textContent = 'Prompts'; return; }
      const cp = e.target.closest('[data-pack-copy]');
      if (cp) { await copyText(lastCtx[key].parts.phases[+cp.dataset.packCopy].prompt); toast('Prompt copied — paste it into your AI tool'); return; }
      if (e.target.closest('[data-pack-copy-tree]')) { await copyText(lastCtx[key].parts.tree); toast('Skeleton copied'); return; }
      if (e.target.closest('[data-pack-plan]')) {
        const L = lastCtx[key];
        download(new Blob([planMarkdown(L.ctx, L.parts)], { type: 'text/markdown' }), 'PLAN.md');
        toast('PLAN.md downloaded');
      }
    });
    outer.addEventListener('keydown', e => {
      const t = e.target.closest('[data-pack-tab]');
      if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tabs = $$('[data-pack-tab]', outer);
      const n = tabs[(tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.click(); n.focus();
    });
  }
}
