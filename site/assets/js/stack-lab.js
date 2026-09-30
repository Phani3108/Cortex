// Stack Lab page: Pick my stack · Guide me · Architect my project.
// Content and pure logic live in stack-data.js; this file is DOM + state only.
import { TARGETS, TARGET_IDS } from '/engine/src/engine/index.js';
import { stringify } from '/engine/src/utils/yaml.js';
import { $, $$, esc, money, compact, loadRegistry, copyText, toast, handoff, COPY_ICON } from './util.js';
import {
  CATEGORIES, MATRIX, QA_STEPS, PRESETS, getPresetKey, GUIDE_SECTIONS, stackTips,
  ARCH_STEPS, toggleMulti, evaluateInsights, INSIGHT_TYPE_LABEL, getArchRecommendation,
  buildCatalog, validateCatalogRefs, fillModels, buildCortexFiles, targetsFromSelection,
} from './stack-data.js';

const MODES = ['pick', 'guide', 'architect'];
const IS_DEV = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(location.hostname);
const narrow = matchMedia('(max-width: 959px)');
const COMPLIANCE_INSIGHTS = new Set(['hipaa-llm', 'hipaa-storage', 'gdpr-residency', 'airgapped', 'soc2-logging', 'pci-scope', 'auth-diy', 'auth-enterprise', 'multitenant']);
const TYPE_BADGE = { warning: 'badge-warn', pattern: 'badge-brand', tip: 'badge-ok', tool: '' };
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const state = {
  mode: 'pick',
  registry: null,
  registryFailed: false,
  catalog: [],
  byId: new Map(),
  pick: { selected: new Set(), focus: null, tab: 'matrix', showAll: false },
  guide: { step: 0, answers: {}, done: false },
  arch: { step: 0, answers: {}, done: false, seen: new Set() },
  cfg: {}, // per panel: { name, targets:Set|null, file, input }
};

// ── Catalog ────────────────────────────────────────────────────────────────
function setCatalog() {
  state.catalog = buildCatalog({ registry: state.registry, targets: TARGETS });
  state.byId = new Map(state.catalog.map(t => [t.id, t]));
  const problems = validateCatalogRefs(state.catalog);
  if (problems.length && IS_DEV) console.error('[stack-lab] catalog self-check failed:\n  ' + problems.join('\n  '));
}
const tech = id => state.byId.get(id);
const fm = text => fillModels(text, state.registry);
const catLabel = id => CATEGORIES.find(c => c.id === id)?.label || id;

function modelMeta(t) {
  const m = t.model;
  if (!m) return state.registryFailed ? 'model data unavailable' : 'loading…';
  const p = m.costPer1M || {};
  return `${money(p.input)} / ${money(p.output)} · ${compact(m.contextWindow)} ctx`;
}

function tag(id, { match = false } = {}) {
  const t = tech(id);
  const label = t ? (t.category === 'ai' && !t.model ? t.tier || t.label : t.label) : id;
  return `<span class="sl-tag${match ? ' is-match' : ''}">${match ? '<span aria-hidden="true">✓ </span>' : ''}${esc(label)}${match ? '<span class="visually-hidden"> (in your stack)</span>' : ''}</span>`;
}

// ── Modes ──────────────────────────────────────────────────────────────────
function modeFromHash() {
  const h = location.hash.replace('#', '');
  return MODES.includes(h) ? h : null;
}

function setMode(mode, { focus = false } = {}) {
  state.mode = mode;
  for (const b of $$('#sl-mode [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  for (const p of $$('[data-mode-panel]')) p.hidden = p.dataset.modePanel !== mode;
  if (mode === 'pick') renderPick();
  if (mode === 'guide') renderGuide();
  if (mode === 'architect') renderArch();
  if (focus) $(`#sl-mode [data-mode="${mode}"]`)?.focus();
}

function goMode(mode) {
  if (location.hash !== `#${mode}`) location.hash = mode; // hashchange → setMode
  else setMode(mode);
}

function initModes() {
  const seg = $('#sl-mode');
  seg.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) goMode(b.dataset.mode);
  });
  seg.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const i = MODES.indexOf(state.mode);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? MODES.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length;
    e.preventDefault();
    goMode(MODES[next]);
    $(`#sl-mode [data-mode="${MODES[next]}"]`)?.focus();
  });
  addEventListener('hashchange', () => {
    const m = modeFromHash();
    if (m && m !== state.mode) setMode(m);
  });
}

// ══ Pick my stack ═══════════════════════════════════════════════════════════
function renderPresetStarts() {
  const keys = ['lean-mvp', 'ai-mvp', 'web-with-ai', 'api-microservice', 'enterprise', 'self-hosted-ai'];
  $('#sl-preset-starts').innerHTML = keys.map(k =>
    `<button type="button" class="btn btn-ghost btn-sm" data-preset="${k}">${esc(PRESETS[k].name)}</button>`).join('');
}

function chipHTML(t) {
  const on = state.pick.selected.has(t.id);
  const meta = t.category === 'ai' ? `<span class="sl-chip-meta">${esc(modelMeta(t))}</span>` : '';
  const title = t.category === 'ai' ? `${t.tier} tier` : t.bestFor?.[0] || '';
  return `<button type="button" class="chip sl-chip" data-tech="${esc(t.id)}" aria-pressed="${on}" aria-describedby="sl-detail" title="${esc(title)}"><span>${esc(t.label)}</span>${meta}</button>`;
}

function renderGroups() {
  $('#sl-detail-home').appendChild($('#sl-detail')); // rescue the panel before re-rendering groups
  $('#sl-groups').innerHTML = CATEGORIES.map(cat => {
    let items = state.catalog.filter(t => t.category === cat.id);
    let note = '';
    if (cat.id === 'ai') {
      if (!state.registry) note = state.registryFailed ? '<p class="tiny muted">Current model data could not be loaded. Try again later.</p>' : '<p class="tiny muted">Loading current models from the registry…</p>';
      items = items.filter(t => t.available);
      if (state.registry) note = `<p class="tiny muted">Current models from the registry (updated daily). Prices are USD per 1M input / output tokens. <a href="/models.html">Compare all models</a>.</p>`;
    }
    if (cat.id === 'tools') note = '<p class="tiny muted">Each tool reads its own instruction file. Picks here decide which files your config compiles to.</p>';
    return `<section class="sl-group" aria-labelledby="sl-g-${cat.id}">
      <h3 class="sl-group-h" id="sl-g-${cat.id}">${esc(cat.label)}</h3>${note}
      <div class="chips sl-chips">${items.map(chipHTML).join('')}</div>
    </section>`;
  }).join('');
}

function detailHTML(t) {
  if (!t) return '<p class="muted small">Hover, focus or tap a technology to see what it is best for and who uses it.</p>';
  const on = state.pick.selected.has(t.id);
  let extra = '';
  if (t.category === 'ai') {
    const m = t.model;
    extra = m ? `<dl class="sl-facts">
        <div><dt>Model id</dt><dd><code>${esc(m.id)}</code></dd></div>
        <div><dt>Price / 1M tokens</dt><dd>${money(m.costPer1M?.input)} in · ${money(m.costPer1M?.output)} out</dd></div>
        <div><dt>Context</dt><dd>${compact(m.contextWindow)} tokens</dd></div>
        ${m.released ? `<div><dt>Released</dt><dd>${esc(m.released)}</dd></div>` : ''}
      </dl>` : `<p class="tiny muted">Model data unavailable.</p>`;
  } else if (t.category === 'tools') {
    extra = t.mainFile ? `<p class="small">Cortex writes <code>${esc(t.mainFile)}</code> for this tool.</p>` : '';
  } else if (t.example) {
    extra = `<p class="tiny muted sl-dh">Powering</p><p class="small"><strong>${esc(t.example.app)}</strong></p>
      <div class="chips sl-mini">${t.example.stack.map(s => `<span class="sl-tag${s === t.example.highlight ? ' is-match' : ''}">${esc(s)}</span>`).join('')}</div>`;
  }
  return `<div class="row sl-detail-head"><h3 class="h3">${esc(t.label)}</h3><span class="badge">${esc(t.category === 'ai' ? t.tier : catLabel(t.category))}</span></div>
    <p class="tiny muted sl-dh">Best for</p>
    <ul class="sl-list">${(t.bestFor || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
    ${extra}
    <button type="button" class="btn btn-ghost btn-sm sl-detail-toggle" data-tech="${esc(t.id)}" aria-pressed="${on}">${on ? 'Remove from stack' : 'Add to stack'}</button>`;
}

function showDetail(id) {
  state.pick.focus = id;
  const el = $('#sl-detail');
  el.innerHTML = detailHTML(tech(id));
  // On narrow screens the panel follows the group being browsed.
  if (narrow.matches && id) {
    const group = $(`#sl-groups [data-tech="${CSS.escape(id)}"]`)?.closest('.sl-group');
    if (group && el.parentElement !== group) group.appendChild(el);
  } else if (!narrow.matches && el.parentElement !== $('#sl-detail-home')) {
    $('#sl-detail-home').appendChild(el);
  }
}

function renderSummary() {
  const sel = [...state.pick.selected];
  const n = sel.length;
  $('#sl-count').textContent = n ? `${n} selected` : 'Nothing selected yet';
  $('#sl-clear').disabled = !n;
  $('#sl-jump').hidden = !n;
  $('#sl-selected').innerHTML = n
    ? sel.map(id => `<button type="button" class="chip sl-chip-sm" data-remove="${esc(id)}" aria-label="Remove ${esc(tech(id)?.label || id)}">${esc(tech(id)?.label || id)} <span aria-hidden="true">×</span></button>`).join('')
    : '<p class="tiny muted">Pick a few technologies, or start from a preset.</p>';
}

function renderPickResults() {
  const sel = state.pick.selected;
  const box = $('#sl-pick-results');
  box.hidden = !sel.size;
  if (!sel.size) return;
  for (const t of $$('#sl-pick-results [data-tab]')) {
    const on = t.dataset.tab === state.pick.tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  for (const p of $$('#sl-pick-results .sl-tabpanel')) p.hidden = p.id !== `sl-panel-${state.pick.tab}`;
  if (state.pick.tab === 'matrix') renderMatrix();
  if (state.pick.tab === 'tips') renderTips();
  if (state.pick.tab === 'config') renderConfig('pick', { selected: [...sel], extraRules: [], title: 'Custom stack' });
}

function renderMatrix() {
  const sel = state.pick.selected;
  const rows = MATRIX.map(r => {
    const matched = r.stack.filter(id => sel.has(id)).length;
    return { ...r, matched, total: r.stack.length, score: matched / r.stack.length };
  }).sort((a, b) => b.score - a.score || b.matched - a.matched);
  const withMatch = rows.filter(r => r.matched);
  const shown = state.pick.showAll || !withMatch.length ? rows : withMatch;
  const body = shown.map(r => {
    const full = r.matched === r.total;
    const badge = full ? '<span class="badge badge-ok">✓ Full match</span>'
      : r.matched ? `<span class="badge">${r.matched} of ${r.total}</span>` : '<span class="badge">No overlap</span>';
    return `<tr>
      <td data-label="Build"><strong>${esc(r.name)}</strong></td>
      <td data-label="Stack"><div class="chips sl-mini">${r.stack.map(id => tag(id, { match: sel.has(id) })).join('')}</div></td>
      <td data-label="Complexity">${esc(r.complexity)}</td>
      <td data-label="Examples" class="muted small">${esc(r.example)}</td>
      <td data-label="Match">${badge}</td>
    </tr>`;
  }).join('');
  $('#sl-panel-matrix').innerHTML = `
    <p class="small muted sl-panel-intro">Common builds ranked by how much of their stack you already picked.</p>
    <div class="table-wrap sl-matrix"><table class="table">
      <thead><tr><th scope="col">Build</th><th scope="col">Stack</th><th scope="col">Complexity</th><th scope="col">Examples</th><th scope="col">Match</th></tr></thead>
      <tbody>${body}</tbody></table></div>
    ${withMatch.length && withMatch.length < rows.length ? `<button type="button" class="btn btn-ghost btn-sm sl-showall" data-showall aria-expanded="${state.pick.showAll}">${state.pick.showAll ? 'Show matches only' : `Show all ${rows.length} builds`}</button>` : ''}`;
}

function renderTips() {
  const cats = new Set([...state.pick.selected].map(id => tech(id)?.category).filter(Boolean));
  const tips = stackTips(cats, state.pick.selected.size);
  $('#sl-panel-tips').innerHTML = `
    ${tips.length ? `<h3 class="h3 sl-sub">For your stack</h3><div class="grid grid-2">${tips.map(t => `<div class="card"><h4 class="sl-card-h">${esc(t.title)}</h4><p>${esc(t.body)}</p></div>`).join('')}</div>` : ''}
    ${GUIDE_SECTIONS.map(s => `<h3 class="h3 sl-sub">${esc(s.heading)}</h3>
      <div class="grid grid-2">${s.items.map(i => `<div class="card"><h4 class="sl-card-h">${esc(i.label)}</h4><p>${esc(fm(i.body))}</p></div>`).join('')}</div>`).join('')}`;
}

function toggleTech(id) {
  const s = state.pick.selected;
  if (s.has(id)) s.delete(id); else s.add(id);
  for (const b of $$(`[data-tech="${CSS.escape(id)}"]`)) {
    b.setAttribute('aria-pressed', String(s.has(id)));
    if (b.classList.contains('sl-detail-toggle')) b.textContent = s.has(id) ? 'Remove from stack' : 'Add to stack';
  }
  renderSummary();
  renderPickResults();
}

function loadIntoPicker(ids) {
  state.pick.selected = new Set(ids.filter(id => tech(id)));
  state.pick.tab = 'matrix';
  state.pick.showAll = false;
  if (state.mode === 'pick') renderPick();
}

function renderPick() {
  renderGroups();
  renderSummary();
  showDetail(state.pick.focus);
  renderPickResults();
}

function initPick() {
  renderPresetStarts();
  const root = $('#sl-pick');
  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-tech]');
    if (chip) { toggleTech(chip.dataset.tech); if (!chip.classList.contains('sl-detail-toggle')) showDetail(chip.dataset.tech); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) { toggleTech(rm.dataset.remove); ($('#sl-selected [data-remove]') || $('#sl-count')).focus(); return; }
    const pre = e.target.closest('[data-preset]');
    if (pre) { loadIntoPicker(PRESETS[pre.dataset.preset].chips); toast(`Loaded ${PRESETS[pre.dataset.preset].name}`); return; }
    if (e.target.closest('#sl-clear')) { state.pick.selected.clear(); renderPick(); return; }
    if (e.target.closest('[data-showall]')) { state.pick.showAll = !state.pick.showAll; renderMatrix(); $('[data-showall]')?.focus(); return; }
    const tab = e.target.closest('#sl-pick-results [data-tab]');
    if (tab) { state.pick.tab = tab.dataset.tab; renderPickResults(); }
  });
  const onPoint = e => {
    const chip = e.target.closest('#sl-groups [data-tech]');
    if (chip && chip.dataset.tech !== state.pick.focus) showDetail(chip.dataset.tech);
  };
  root.addEventListener('focusin', onPoint);
  root.addEventListener('mouseover', e => { if (!narrow.matches) onPoint(e); });
  $('#sl-pick-results .tabs').addEventListener('keydown', e => tabKeys(e, tab => { state.pick.tab = tab.dataset.tab; renderPickResults(); }));
  narrow.addEventListener?.('change', () => showDetail(state.pick.focus));
}

/** Left/right/home/end on a tablist; activate = callback(tabEl). */
function tabKeys(e, activate) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = $$('[role="tab"]', e.currentTarget);
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  const id = tabs[n].id;
  activate(tabs[n]);
  (document.getElementById(id) || $$('[role="tab"]', e.currentTarget)[n])?.focus();
}

// ══ Shared wizard pieces ════════════════════════════════════════════════════
function answerLabel(step, value) {
  if (Array.isArray(value)) return value.map(v => step.options.find(o => o.value === v)?.label || v).join(', ');
  return step.options.find(o => o.value === value)?.label || value;
}

function answersHTML(steps, answers, current, kind) {
  const done = steps.map((s, i) => [s, i]).filter(([s]) => answers[s.id] !== undefined && (!Array.isArray(answers[s.id]) || answers[s.id].length));
  if (!done.length) return '';
  return `<div class="sl-answers" aria-label="Your answers">
    <span class="tiny muted">Your answers <span class="sl-hint">(select one to change it)</span></span>
    <div class="chips">${done.map(([s, i]) => `<button type="button" class="sl-answer" data-${kind}-goto="${i}"${i === current ? ' aria-current="step"' : ''}>
      <span class="sl-answer-q">${esc(s.short || s.question.replace(/\?$/, ''))}</span><span class="sl-answer-a">${esc(answerLabel(s, answers[s.id]))}</span></button>`).join('')}</div>
  </div>`;
}

function wizardHTML({ steps, index, answers, kind, finishLabel, allDone }) {
  const step = steps[index];
  const cur = answers[step.id];
  const multi = !!step.multi;
  const has = multi ? Array.isArray(cur) && cur.length > 0 : cur !== undefined;
  const pct = Math.round(((index + 1) / steps.length) * 100);
  const last = index === steps.length - 1;
  return `<div class="card sl-wizard">
    <div class="sl-progress">
      <span class="small"><strong>Step ${index + 1} of ${steps.length}</strong>${multi ? ' <span class="muted">· select all that apply</span>' : ''}</span>
      <div class="meter" role="progressbar" aria-label="Progress" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${index + 1}" aria-valuetext="Step ${index + 1} of ${steps.length}"><span style="width:${pct}%"></span></div>
    </div>
    <h3 class="sl-q" id="sl-${kind}-q" tabindex="-1">${esc(step.question)}</h3>
    <p class="muted small sl-qhint">${esc(step.hint)}</p>
    <div class="sl-options${multi ? ' is-multi' : ''}" role="group" aria-labelledby="sl-${kind}-q">
      ${step.options.map(o => {
        const on = multi ? Array.isArray(cur) && cur.includes(o.value) : cur === o.value;
        return `<button type="button" class="sl-option" data-${kind}-opt="${esc(o.value)}" aria-pressed="${on}">
          <span class="sl-mark" aria-hidden="true"></span>
          <span class="sl-opt-text"><span class="sl-opt-label">${esc(o.label)}</span>${o.sub ? `<span class="sl-opt-sub">${esc(o.sub)}</span>` : ''}</span></button>`;
      }).join('')}
    </div>
    <div class="sl-nav">
      <button type="button" class="btn btn-ghost" data-${kind}-back ${index === 0 ? 'disabled' : ''}>Back</button>
      <span class="spacer"></span>
      ${allDone && !last ? `<button type="button" class="btn btn-ghost" data-${kind}-finish>${esc(finishLabel)}</button>` : ''}
      <button type="button" class="btn btn-primary" data-${kind}-next ${has ? '' : 'disabled'}>${last ? esc(finishLabel) : 'Next'} ${ARROW}</button>
    </div>
  </div>`;
}

const complete = (steps, answers) => steps.every(s => s.multi ? Array.isArray(answers[s.id]) && answers[s.id].length : answers[s.id] !== undefined);

function focusQuestion(kind) {
  requestAnimationFrame(() => $(`#sl-${kind}-q`)?.focus({ preventScroll: false }));
}

// ══ Guide me ═══════════════════════════════════════════════════════════════
function renderGuide({ focus = false } = {}) {
  const g = state.guide;
  const body = $('#sl-guide-body');
  if (g.done) { body.innerHTML = guideResultHTML(); renderConfig('guide', guideCfgInput()); if (focus) focusQuestion('guide-result'); return; }
  body.innerHTML = answersHTML(QA_STEPS, g.answers, g.step, 'guide')
    + wizardHTML({ steps: QA_STEPS, index: g.step, answers: g.answers, kind: 'guide', finishLabel: 'Show my stack', allDone: complete(QA_STEPS, g.answers) });
  if (focus) focusQuestion('guide');
}

function guidePreset() { return PRESETS[getPresetKey(state.guide.answers)]; }
function guideCfgInput() { const p = guidePreset(); return { selected: p.chips, extraRules: p.rules, title: p.name }; }

function guideResultHTML() {
  const p = guidePreset();
  return answersHTML(QA_STEPS, state.guide.answers, -1, 'guide') + `
  <div class="card sl-result-head">
    <p class="eyebrow">Recommended stack</p>
    <h3 class="h2" id="sl-guide-result-q" tabindex="-1">${esc(p.name)}</h3>
    <p class="lead sl-headline">${esc(p.headline)}</p>
    <p class="text-2">${esc(fm(p.why))}</p>
    <div class="chips sl-mini sl-result-stack">${p.chips.map(id => tag(id)).join('')}</div>
    <p class="small muted"><strong>Used by:</strong> ${esc(p.examples)}</p>
    <div class="row sl-actions">
      <button type="button" class="btn btn-primary" data-guide-customize>Customize in Pick mode ${ARROW}</button>
      <button type="button" class="btn btn-ghost" data-guide-goto="0">Edit answers</button>
      <button type="button" class="btn btn-ghost" data-guide-reset>Start over</button>
    </div>
  </div>
  <div data-cfg-slot="guide"></div>`;
}

function initGuide() {
  const root = $('#sl-guide');
  root.addEventListener('click', e => {
    const g = state.guide;
    const step = QA_STEPS[g.step];
    const opt = e.target.closest('[data-guide-opt]');
    if (opt) {
      g.answers[step.id] = opt.dataset.guideOpt;
      for (const b of $$('[data-guide-opt]', root)) b.setAttribute('aria-pressed', String(b === opt));
      const next = $('[data-guide-next]', root); if (next) next.disabled = false;
      return;
    }
    if (e.target.closest('[data-guide-next]')) {
      if (g.step < QA_STEPS.length - 1) g.step++; else g.done = true;
      return renderGuide({ focus: true });
    }
    if (e.target.closest('[data-guide-finish]')) { g.done = true; return renderGuide({ focus: true }); }
    if (e.target.closest('[data-guide-back]')) { g.step = Math.max(0, g.step - 1); return renderGuide({ focus: true }); }
    const go = e.target.closest('[data-guide-goto]');
    if (go) { g.step = +go.dataset.guideGoto; g.done = false; return renderGuide({ focus: true }); }
    if (e.target.closest('[data-guide-reset]')) { state.guide = { step: 0, answers: {}, done: false }; return renderGuide({ focus: true }); }
    if (e.target.closest('[data-guide-customize]')) { loadIntoPicker(guidePreset().chips); goMode('pick'); scrollTo({ top: 0 }); }
  });
}

// ══ Architect my project ═══════════════════════════════════════════════════
function currentInsights() { return evaluateInsights(state.arch.answers); }

function renderInsights() {
  const list = currentInsights();
  $('#sl-insights-count').textContent = String(list.length);
  $('#sl-insights-count').className = list.length ? 'badge badge-brand' : 'badge';
  $('#sl-insight-list').innerHTML = list.length
    ? list.map(i => {
      const fresh = !state.arch.done && !state.arch.seen.has(i.id);
      return `<li class="sl-insight sl-insight-${i.type}">
        <div class="row sl-insight-tags"><span class="badge ${TYPE_BADGE[i.type]}">${esc(INSIGHT_TYPE_LABEL[i.type])}</span>${fresh ? '<span class="badge badge-brand">New</span>' : ''}</div>
        <p>${esc(fm(i.text))}</p></li>`;
    }).join('')
    : '<li class="sl-insight-empty muted small">Answer the questions to see architecture insights as you go: warnings, patterns and tools that fit your answers.</li>';
}

function snapshotSeen() { state.arch.seen = new Set(currentInsights().map(i => i.id)); }

function renderArch({ focus = false } = {}) {
  const a = state.arch;
  const body = $('#sl-arch-body');
  if (a.done) {
    body.innerHTML = archResultHTML();
    renderConfig('arch', archCfgInput());
    renderInsights();
    if (focus) focusQuestion('arch-result');
    return;
  }
  body.innerHTML = answersHTML(ARCH_STEPS, a.answers, a.step, 'arch')
    + wizardHTML({ steps: ARCH_STEPS, index: a.step, answers: a.answers, kind: 'arch', finishLabel: 'Build my blueprint', allDone: complete(ARCH_STEPS, a.answers) });
  renderInsights();
  if (focus) focusQuestion('arch');
}

function archTitle() {
  const step = ARCH_STEPS[0];
  const label = step.options.find(o => o.value === state.arch.answers[step.id])?.label;
  return label ? `Blueprint: ${label}` : 'Your blueprint';
}
function archRec() { return getArchRecommendation(state.arch.answers); }
function archCfgInput() { const r = archRec(); return { selected: r.chips, extraRules: r.rules, title: 'Architecture blueprint' }; }

function archResultHTML() {
  const r = archRec();
  const warnings = r.warnings.filter(w => COMPLIANCE_INSIGHTS.has(w.id));
  const card = (title, inner, cls = '') => `<section class="card sl-bp-card ${cls}"><h4 class="sl-card-h">${title}</h4>${inner}</section>`;
  const stackList = `<ul class="sl-why">${r.chips.map(id => {
    const t = tech(id); if (!t) return '';
    const label = t.category === 'ai' && !t.model ? t.tier : t.label;
    const meta = t.category === 'ai' && t.model ? ` <span class="tiny muted">${esc(modelMeta(t))}</span>` : '';
    return `<li><div class="row sl-why-head"><strong>${esc(label)}</strong><span class="badge">${esc(t.category === 'ai' ? 'AI model' : catLabel(t.category))}</span>${meta}</div><p>${esc(fm(t.why || t.bestFor?.[0] || ''))}</p></li>`;
  }).join('')}</ul>`;

  return answersHTML(ARCH_STEPS, state.arch.answers, -1, 'arch') + `
  <div class="card sl-result-head">
    <p class="eyebrow">Architecture blueprint</p>
    <h3 class="h2" id="sl-arch-result-q" tabindex="-1">${esc(archTitle())}</h3>
    ${r.similar ? `<p class="text-2">Similar to <strong>${esc(r.similar.ex)}</strong>. ${esc(r.similar.note)}</p>` : ''}
    <div class="row sl-actions">
      <button type="button" class="btn btn-primary" data-arch-customize>Customize in Pick mode ${ARROW}</button>
      <button type="button" class="btn btn-ghost" data-arch-goto="${ARCH_STEPS.length - 1}">Edit answers</button>
      <button type="button" class="btn btn-ghost" data-arch-reset>Start over</button>
    </div>
  </div>
  <div class="sl-bp">
    ${card('Core stack, and why', stackList, 'sl-span')}
    ${r.patterns.length ? card('Patterns', `<ul class="sl-list sl-defs">${r.patterns.map(p => `<li><strong>${esc(p.name)}</strong><span>${esc(p.detail)}</span></li>`).join('')}</ul>`) : ''}
    ${card('Startup traps', `<p class="small muted">Common post-mortem causes for what you are building.</p>
      <ul class="sl-traps">${r.traps.map(t => `<li><span class="badge badge-warn">Trap</span><div><strong>${esc(t.title)}</strong><p>${esc(t.text)}</p></div></li>`).join('')}</ul>`)}
    ${card('Compliance and security', warnings.length
      ? `<ul class="sl-traps">${warnings.map(w => `<li><span class="badge badge-warn">Warning</span><p>${esc(fm(w.text))}</p></li>`).join('')}</ul>`
      : '<p class="small text-2">No compliance constraints selected. Revisit before your first enterprise deal: SOC 2 and GDPR are the usual first asks.</p>')}
    ${r.scalingRoadmap.length ? card('Scaling roadmap', `<ol class="sl-roadmap">${r.scalingRoadmap.map(s => {
      const [when, ...rest] = s.split(': ');
      return `<li><strong>${esc(when)}</strong><span>${esc(rest.join(': '))}</span></li>`;
    }).join('')}</ol>`) : ''}
    ${r.alternatives.length ? card('Alternatives', `<ul class="sl-list sl-defs">${r.alternatives.map(al => `<li><strong>${esc(al.name)}</strong><span class="tiny muted">Best when: ${esc(al.when)}</span><span>${esc(al.tradeoff)}</span></li>`).join('')}</ul>`) : ''}
  </div>
  <div data-cfg-slot="arch"></div>`;
}

function initArch() {
  const root = $('#sl-architect');
  root.addEventListener('click', e => {
    const a = state.arch;
    const step = ARCH_STEPS[a.step];
    const opt = e.target.closest('[data-arch-opt]');
    if (opt) {
      const v = opt.dataset.archOpt;
      if (step.multi) {
        const next = toggleMulti(step, a.answers[step.id], v);
        if (next.length) a.answers[step.id] = next; else delete a.answers[step.id];
        for (const b of $$('[data-arch-opt]', root)) b.setAttribute('aria-pressed', String((a.answers[step.id] || []).includes(b.dataset.archOpt)));
      } else {
        a.answers[step.id] = v;
        for (const b of $$('[data-arch-opt]', root)) b.setAttribute('aria-pressed', String(b === opt));
      }
      const has = step.multi ? !!a.answers[step.id]?.length : true;
      const nb = $('[data-arch-next]', root); if (nb) nb.disabled = !has;
      renderInsights();
      return;
    }
    if (e.target.closest('[data-arch-next]')) {
      snapshotSeen();
      if (a.step < ARCH_STEPS.length - 1) a.step++; else a.done = true;
      return renderArch({ focus: true });
    }
    if (e.target.closest('[data-arch-finish]')) { snapshotSeen(); a.done = true; return renderArch({ focus: true }); }
    if (e.target.closest('[data-arch-back]')) { a.step = Math.max(0, a.step - 1); snapshotSeen(); return renderArch({ focus: true }); }
    const go = e.target.closest('[data-arch-goto]');
    if (go) { a.step = +go.dataset.archGoto; a.done = false; snapshotSeen(); return renderArch({ focus: true }); }
    if (e.target.closest('[data-arch-reset]')) { state.arch = { step: 0, answers: {}, done: false, seen: new Set() }; return renderArch({ focus: true }); }
    if (e.target.closest('[data-arch-customize]')) { loadIntoPicker(archRec().chips); goMode('pick'); scrollTo({ top: 0 }); }
  });
  const details = $('#sl-insights');
  const sync = () => { details.open = !narrow.matches; };
  sync();
  narrow.addEventListener?.('change', sync);
}

// ══ .cortex config panel (shared by all modes) ═════════════════════════════
function cfgState(key) {
  return (state.cfg[key] ||= { name: 'my-app', targets: null, file: '.cortex/rules/project.md', input: null });
}

function cfgResult(key) {
  const c = cfgState(key);
  const { selected, extraRules, title } = c.input;
  const targets = c.targets ? [...c.targets] : targetsFromSelection(selected, TARGET_IDS);
  return buildCortexFiles({ selected, catalog: state.catalog, name: c.name, targets, targetIds: TARGET_IDS, stringify, extraRules, title });
}

function setupScript(files) {
  const dirs = [...new Set(Object.keys(files).map(p => p.slice(0, p.lastIndexOf('/'))))];
  return [`mkdir -p ${dirs.join(' ')}`, ...Object.entries(files).map(([p, c]) => `cat > ${p} <<'CORTEX_EOF'\n${c.replace(/\n$/, '')}\nCORTEX_EOF`)].join('\n\n') + '\n';
}

function renderConfig(key, input) {
  const slot = $(`[data-cfg-slot="${key}"]`);
  if (!slot) return;
  const c = cfgState(key);
  c.input = input;
  const res = cfgResult(key);
  if (!res.files[c.file]) c.file = '.cortex/rules/project.md';
  const paths = Object.keys(res.files);
  const enabled = new Set(res.targets);
  const pre = `sl-cfg-${key}`;
  const active = document.activeElement;
  const restore = active && slot.contains(active) ? active.dataset.cfgFocus : null;
  slot.innerHTML = `<section class="card sl-config" aria-labelledby="${pre}-h">
    <div class="sl-config-head">
      <div>
        <h3 class="h3" id="${pre}-h">Your .cortex config</h3>
        <p class="small muted">Real files for the Cortex CLI: one rule set, compiled into each tool’s native format.</p>
      </div>
      <label class="field sl-name">Project name
        <input class="input" type="text" value="${esc(c.name)}" data-cfg-name="${key}" data-cfg-focus="name" autocomplete="off" spellcheck="false"></label>
    </div>
    <div class="sl-targets">
      <span class="tiny muted" id="${pre}-tl">Compile for${c.targets ? '' : ' <span class="sl-hint">(from your coding tools, or the default set)</span>'}</span>
      <div class="chips" role="group" aria-labelledby="${pre}-tl">${TARGET_IDS.map(id => `<button type="button" class="chip sl-chip-sm" data-cfg-target="${id}" data-cfg-focus="t-${id}" aria-pressed="${enabled.has(id)}" title="${esc(TARGETS[id].mainFile)}">${esc(TARGETS[id].name)}</button>`).join('')}</div>
    </div>
    <div class="code sl-code">
      <div class="tabs" role="tablist" aria-label="Generated files">${paths.map((p, i) => `<button type="button" class="tab" role="tab" id="${pre}-tab-${i}" aria-controls="${pre}-pre" aria-selected="${p === c.file}" tabindex="${p === c.file ? 0 : -1}" data-cfg-file="${esc(p)}" data-cfg-focus="f-${i}">${esc(p.replace('.cortex/', ''))}</button>`).join('')}</div>
      <div class="code-head"><span>${esc(c.file)}</span><span class="spacer"></span>
        <button class="copy-btn" type="button" data-copy-target="#${pre}-pre">${COPY_ICON}<span class="copy-label">Copy</span></button></div>
      <pre id="${pre}-pre" role="tabpanel" tabindex="0" aria-label="${esc(c.file)}"><code>${esc(res.files[c.file])}</code></pre>
    </div>
    <div class="row sl-actions">
      <button type="button" class="btn btn-brand" data-cfg-open="${key}" ${enabled.size ? '' : 'disabled'}>Open in Playground ${ARROW}</button>
      <button type="button" class="btn btn-ghost" data-cfg-script="${key}">Copy setup script</button>
      ${enabled.size ? '' : '<span class="small muted">Pick at least one tool to compile for.</span>'}
    </div>
    <details class="sl-cli">
      <summary>Use it with the CLI</summary>
      <div class="code"><div class="code-head"><span>terminal</span><span class="spacer"></span>
        <button class="copy-btn" type="button" data-copy-target="#${pre}-cli">${COPY_ICON}<span class="copy-label">Copy</span></button></div>
<pre id="${pre}-cli"><code>npm install -g github:Phani3108/Cortex
cortex init        # creates .cortex/ in your repo
# replace .cortex/config.yaml and .cortex/rules/ with the files above
# (or paste the "setup script" into your shell)
cortex compile     # writes ${esc(res.targets.map(t => TARGETS[t].mainFile).slice(0, 3).join(', '))}${res.targets.length > 3 ? ', …' : ''}
cortex verify      # optional: fail CI when generated files drift</code></pre></div>
    </details>
  </section>`;
  if (restore) slot.querySelector(`[data-cfg-focus="${restore}"]`)?.focus();
}

function initConfig() {
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-cfg-target]');
    const key = e.target.closest('[data-cfg-slot]')?.dataset.cfgSlot;
    if (!key) return;
    const c = cfgState(key);
    if (t) {
      const cur = new Set(cfgResult(key).targets);
      const id = t.dataset.cfgTarget;
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      c.targets = cur;
      return renderConfig(key, c.input);
    }
    const f = e.target.closest('[data-cfg-file]');
    if (f) { c.file = f.dataset.cfgFile; return renderConfig(key, c.input); }
    if (e.target.closest('[data-cfg-script]')) {
      await copyText(setupScript(cfgResult(key).files));
      return toast('Setup script copied — paste it in your repo root');
    }
    if (e.target.closest('[data-cfg-open]')) {
      const res = cfgResult(key);
      const files = Object.fromEntries(Object.entries(res.files).filter(([p]) => p !== '.cortex/config.yaml'));
      handoff('playground', { files, config: res.config, targets: res.targets });
      location.href = '/#playground';
    }
  });
  document.addEventListener('input', e => {
    const inp = e.target.closest('[data-cfg-name]');
    if (!inp) return;
    const key = inp.dataset.cfgName;
    cfgState(key).name = inp.value;
    // Update the visible file without rebuilding the input (keeps caret position).
    const c = cfgState(key);
    const res = cfgResult(key);
    const pre = $(`#sl-cfg-${key}-pre code`);
    if (pre) pre.textContent = res.files[c.file];
  });
  document.addEventListener('keydown', e => {
    const list = e.target.closest?.('[data-cfg-slot] [role="tablist"]');
    if (!list) return;
    const key = list.closest('[data-cfg-slot]').dataset.cfgSlot;
    const tabs = $$('[role="tab"]', list);
    const i = tabs.indexOf(e.target);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    cfgState(key).file = tabs[n].dataset.cfgFile;
    renderConfig(key, cfgState(key).input);
    $(`[data-cfg-slot="${key}"] [data-cfg-focus="f-${n}"]`)?.focus();
  });
}

// ══ Boot ═══════════════════════════════════════════════════════════════════
function rerender() {
  if (state.mode === 'pick') renderPick();
  if (state.mode === 'guide') renderGuide();
  if (state.mode === 'architect') renderArch();
}

function boot() {
  setCatalog();
  initModes();
  initPick();
  initGuide();
  initArch();
  initConfig();
  setMode(modeFromHash() || 'pick');
  loadRegistry().then(reg => {
    state.registry = reg;
    setCatalog();
    // Keep keyboard focus stable across the refresh.
    const focused = document.activeElement?.dataset?.tech;
    rerender();
    if (focused) $(`#sl-groups [data-tech="${CSS.escape(focused)}"]`)?.focus();
  }).catch(err => {
    state.registryFailed = true;
    if (IS_DEV) console.warn('[stack-lab] registry unavailable:', err);
    rerender();
  });
}

boot();
