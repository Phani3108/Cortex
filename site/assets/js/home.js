// Landing page: live playground (real engine), tool matrix, latest models.
import { compile, TARGETS, TARGET_IDS, measure, formatTokens, VERIFIED_ON, tokenizerFor } from '/engine/src/engine/index.js';
import { stringify } from '/engine/src/utils/yaml.js';
import { $, $$, esc, money, compact, loadRegistry, relTime, copyText, toast, takeHandoff } from './util.js';
import { PRESETS } from './presets.js';
import { makeZip, download } from './zip.js';

const TOOL_COLORS = {
  claude: '#d97757', codex: '#10a37f', cursor: '#7c7c86', copilot: '#6e40c9', gemini: '#4285f4',
  windsurf: '#09b6a2', kiro: '#ff9900', antigravity: '#34a853', 'gemini-review': '#1a73e8', openai: '#10a37f',
};
const DEFAULT_ON = ['claude', 'codex', 'cursor', 'copilot', 'gemini', 'windsurf'];
const STORE_KEY = 'cortex-playground-v2';

const state = {
  preset: 'next',
  files: {},
  config: {},
  active: '.cortex/rules/project.md',
  targets: new Set(DEFAULT_ON),
  shared: true,
  outFile: null,
  result: null,
};

// ── Persistence (per-viewer convenience only) ───────────────────────────────
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ preset: state.preset, files: state.files, config: state.config, targets: [...state.targets], shared: state.shared, active: state.active }));
  } catch { /* storage unavailable */ }
}
function restore() {
  const handed = takeHandoff('playground');
  if (handed?.files) {
    Object.assign(state, { preset: 'custom', files: handed.files, config: handed.config || {}, active: Object.keys(handed.files)[0] });
    if (handed.targets) state.targets = new Set(handed.targets);
    toast('Loaded your Stack Lab config');
    return true;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved?.files && Object.keys(saved.files).length) {
      Object.assign(state, { ...saved, targets: new Set(saved.targets || DEFAULT_ON) });
      return true;
    }
  } catch { /* ignore */ }
  return false;
}
function loadPreset(key) {
  const p = PRESETS[key] || PRESETS.next;
  state.preset = key;
  state.files = { ...p.files };
  state.config = structuredClone(p.config);
  state.active = Object.keys(state.files)[0];
  state.outFile = null;
}

// ── Compile ─────────────────────────────────────────────────────────────────
function run() {
  const ruleFiles = [];
  const skillFiles = [];
  for (const [path, content] of Object.entries(state.files)) {
    if (path.startsWith('.cortex/skills/')) skillFiles.push({ path, content });
    else ruleFiles.push({ path, content });
  }
  const providers = Object.fromEntries(TARGET_IDS.map(id => [id, state.targets.has(id)]));
  const config = { ...state.config, providers, output: { agentsMd: state.shared ? 'shared' : 'duplicate', skills: true } };
  try {
    state.result = compile({ ruleFiles, skillFiles, config });
  } catch (err) {
    state.result = { outputs: [], report: {}, warnings: [`Compile error: ${err.message}`], rules: [], skills: [] };
  }
  if (!state.result.outputs.some(o => o.path === state.outFile)) state.outFile = state.result.outputs[0]?.path || null;
  renderOutputs();
  save();
}

// ── Rendering ───────────────────────────────────────────────────────────────
function renderSources() {
  $('#pg-src-files').innerHTML = Object.keys(state.files).map(p =>
    `<button class="pg-file" type="button" data-file="${esc(p)}" aria-pressed="${p === state.active}">${esc(p.replace('.cortex/', ''))}</button>`).join('');
  $('#pg-editor').value = state.files[state.active] ?? '';
  $('#pg-preset').value = PRESETS[state.preset] ? state.preset : 'next';
}

function renderTargets() {
  $('#pg-targets').innerHTML = TARGET_IDS.map(id => {
    const t = TARGETS[id];
    return `<button class="chip" type="button" data-target="${id}" aria-pressed="${state.targets.has(id)}" title="${esc(t.mainFile)}">
      <span class="tool-dot" style="background:${TOOL_COLORS[id]}"></span>${esc(t.name)}</button>`;
  }).join('');
  $('#pg-shared').checked = state.shared;
}

function budgetFor(out) {
  const b = out.budget || {};
  if (out.kind === 'skill') return null;
  const limit = b.hard || b.soft;
  if (!limit) return null;
  const tokenizer = tokenizerFor(TARGETS[out.target]?.id === 'claude' ? 'anthropic' : 'default');
  const size = measure(out.content, b.unit, tokenizer);
  return { size, limit, unit: b.unit, hard: !!b.hard, note: b.note };
}

function renderOutputs() {
  const { outputs, report, warnings } = state.result;
  const tabs = $('#pg-out-tabs');
  if (!outputs.length) {
    tabs.innerHTML = '';
    $('#pg-meta').innerHTML = '';
    $('#pg-out').innerHTML = '<div class="pg-empty">Pick at least one tool below the editor.</div>';
    $('#pg-notes').innerHTML = warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join('');
    $('#pg-summary').textContent = '';
    return;
  }
  tabs.innerHTML = outputs.map(o => `<button class="tab" role="tab" type="button" data-out="${esc(o.path)}" aria-selected="${o.path === state.outFile}">
    <span class="tool-dot" style="background:${TOOL_COLORS[o.targets[0]]}"></span>${esc(shortPath(o.path))}</button>`).join('');

  const out = outputs.find(o => o.path === state.outFile) || outputs[0];
  const names = out.targets.map(t => TARGETS[t]?.name || t);
  const b = budgetFor(out);
  let meter = '';
  if (b) {
    const pct = Math.min(100, Math.round((b.size / b.limit) * 100));
    const cls = b.size > b.limit ? (b.hard ? 'is-over' : 'is-warn') : '';
    meter = `<span class="meter ${cls}" role="img" aria-label="${b.size} of ${b.limit} ${b.unit}"><span style="width:${pct}%"></span></span>
      <span>${b.size.toLocaleString()} / ${b.limit.toLocaleString()} ${b.unit} ${b.hard ? '<span class="badge">hard limit</span>' : '<span class="badge">guidance</span>'}</span>`;
  }
  $('#pg-meta').innerHTML = `<strong class="mono" style="color:var(--text)">${esc(out.path)}</strong>
    <span class="badge">${esc(kindLabel(out.kind))}</span>
    <span>for ${esc(names.join(', '))}</span>
    <span>≈ ${formatTokens(out.tokens)} tokens</span>${meter}`;
  $('#pg-out').textContent = out.content;

  // Notes: delegation, drops, warnings for the targets that own this file
  const notes = [];
  const delegated = Object.values(report).filter(r => r.viaAgentsMd).map(r => r.name);
  if (out.path === 'AGENTS.md' && delegated.length) notes.push(`↳ Also the always-on rules for ${delegated.join(', ')} — they read AGENTS.md natively, so Cortex doesn't write a duplicate copy.`);
  for (const id of out.targets) {
    const r = report[id];
    if (!r) continue;
    for (const w of r.warnings) notes.push(`⚠ ${r.name}: ${w}`);
    if (r.dropped.length) notes.push(`− Left out for ${r.name}: ${r.dropped.slice(0, 4).map(d => `“${d.text.slice(0, 60)}”`).join(', ')}${r.dropped.length > 4 ? ` +${r.dropped.length - 4} more` : ''}`);
  }
  for (const w of warnings) notes.push(`⚠ ${w}`);
  if (TARGETS[out.targets[0]]?.notes && out.kind === 'instructions') notes.push(`ℹ ${TARGETS[out.targets[0]].notes}`);
  $('#pg-notes').innerHTML = notes.map(n => `<div>${esc(n)}</div>`).join('');
  $('#pg-notes').hidden = !notes.length;

  const files = outputs.length;
  const tools = Object.keys(report).length;
  $('#pg-summary').textContent = `${plural(state.result.rules.length, 'rule')} · ${plural(state.result.skills.length, 'skill')} → ${plural(files, 'file')} for ${plural(tools, 'tool')}`;
}

function plural(n, w) { return `${n} ${w}${n === 1 ? '' : 's'}`; }

function shortPath(p) {
  if (p.endsWith('/SKILL.md')) return p.split('/').slice(-3).join('/');
  return p.replace('.github/instructions/', '.github/…/');
}
function kindLabel(kind) {
  return { instructions: 'always on', scoped: 'path-scoped', skill: 'skill (on demand)' }[kind] || kind;
}

// ── Events ──────────────────────────────────────────────────────────────────
let timer;
function bindPlayground() {
  $('#pg-editor').addEventListener('input', e => {
    state.files[state.active] = e.target.value;
    state.preset = 'custom';
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  $('#pg-src-files').addEventListener('click', e => {
    const btn = e.target.closest('[data-file]');
    if (!btn) return;
    state.active = btn.dataset.file;
    renderSources();
  });
  $('#pg-preset').addEventListener('change', e => { loadPreset(e.target.value); renderSources(); run(); });
  $('#pg-targets').addEventListener('click', e => {
    const btn = e.target.closest('[data-target]');
    if (!btn) return;
    const id = btn.dataset.target;
    state.targets.has(id) ? state.targets.delete(id) : state.targets.add(id);
    btn.setAttribute('aria-pressed', String(state.targets.has(id)));
    run();
  });
  $('#pg-shared').addEventListener('change', e => { state.shared = e.target.checked; run(); });
  $('#pg-out-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-out]');
    if (!btn) return;
    state.outFile = btn.dataset.out;
    renderOutputs();
  });
  $('#pg-out-tabs').addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const tabs = $$('#pg-out-tabs .tab');
    const i = tabs.findIndex(t => t.dataset.out === state.outFile);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    state.outFile = next.dataset.out;
    renderOutputs();
    $(`#pg-out-tabs [data-out="${CSS.escape(state.outFile)}"]`)?.focus();
  });
  $('#pg-copy').addEventListener('click', async () => {
    const out = state.result.outputs.find(o => o.path === state.outFile);
    if (!out) return;
    await copyText(out.content);
    toast(`Copied ${out.path}`);
  });
  $('#pg-download').addEventListener('click', () => {
    const providers = Object.fromEntries(TARGET_IDS.map(id => [id, state.targets.has(id)]));
    const configYaml = `# Cortex configuration — https://github.com/Phani3108/Cortex\n\n${stringify({ version: 2, project: state.config.project || {}, providers, output: { agentsMd: state.shared ? 'shared' : 'duplicate', skills: true } })}\n`;
    const files = [
      { name: '.cortex/config.yaml', content: configYaml },
      ...Object.entries(state.files).map(([name, content]) => ({ name, content })),
      ...state.result.outputs.map(o => ({ name: o.path, content: o.content })),
    ];
    download(makeZip(files), 'cortex-starter.zip');
    toast(`Downloaded ${files.length} files`);
  });
}

// ── Tool matrix ─────────────────────────────────────────────────────────────
function renderMatrix() {
  const rows = TARGET_IDS.map(id => {
    const t = TARGETS[id];
    const scoped = t.scopedPattern ? `<code>${esc(t.scopedPattern.replace('{slug}', '*'))}</code>` : `<span class="muted">${esc(t.scoping)}</span>`;
    const skills = t.skillsDir ? `<code>${esc(t.skillsDir)}/</code>` : '<span class="muted">—</span>';
    const b = t.budget;
    const limit = b.hard ? `<span class="badge badge-warn">${b.hard.toLocaleString()} ${b.unit}</span>` : `<span class="muted small">≤ ${b.soft} ${b.unit} guidance</span>`;
    const docs = t.docs.map((u, i) => `<a href="${esc(u)}" rel="noopener">${i ? 'more' : 'docs'}</a>`).join(' · ');
    const agents = t.readsAgentsMd ? ' <span class="badge" title="Reads AGENTS.md natively">AGENTS.md</span>' : '';
    return `<tr>
      <td><div class="tool-name"><span class="tool-dot" style="background:${TOOL_COLORS[id]}"></span>${esc(t.name)}</div><div class="tiny muted" style="margin-top:3px">${esc(t.vendor)}${agents}</div></td>
      <td><code>${esc(t.mainFile)}</code></td>
      <td>${scoped}</td>
      <td>${skills}</td>
      <td>${limit}</td>
      <td class="small">${docs}</td>
    </tr>`;
  }).join('');
  $('#tool-matrix tbody').innerHTML = rows;
  $('#tools-verified').textContent = `Conventions verified against vendor documentation on ${VERIFIED_ON}. Found something out of date? Open an issue — it's a one-line fix in src/engine/targets.js.`;
}

// ── Latest models ───────────────────────────────────────────────────────────
async function renderModels() {
  let reg;
  try { reg = await loadRegistry(); } catch { $('#latest-models').innerHTML = '<div class="empty">Model data unavailable.</div>'; return; }
  const h = reg.highlights || {};
  const picks = [
    h.anthropic?.sonnet, h.openai?.sol || h.openai?.default, h.google?.pro || h.google?.flash, h['x-ai']?.default || h.deepseek?.pro,
  ].filter(Boolean).map(id => reg.models[id]).filter(Boolean);
  $('#latest-models').innerHTML = picks.map(m => `
    <a class="card card-hover" href="/models.html?q=${encodeURIComponent(m.id)}" style="color:inherit;text-decoration:none">
      <div class="row" style="gap:8px"><span class="badge">${esc(reg.vendors?.[m.vendor] || m.vendor)}</span>${m.status === 'preview' ? '<span class="badge badge-warn">preview</span>' : ''}</div>
      <h3 class="h3" style="margin-top:12px">${esc(m.name || m.id)}</h3>
      <p class="mono" style="margin-top:2px">${esc(m.id)}</p>
      <div class="grid grid-2" style="gap:8px;margin-top:14px">
        <div><div class="stat-label">Input / 1M</div><div style="font-weight:700">${money(m.costPer1M.input)}</div></div>
        <div><div class="stat-label">Output / 1M</div><div style="font-weight:700">${money(m.costPer1M.output)}</div></div>
        <div><div class="stat-label">Context</div><div style="font-weight:700">${compact(m.contextWindow)}</div></div>
        <div><div class="stat-label">Released</div><div style="font-weight:700">${esc(relTime(m.released))}</div></div>
      </div>
    </a>`).join('');

  const newest = Object.values(reg.models).filter(m => m.status === 'active' && ['anthropic', 'openai', 'google'].includes(m.vendor))
    .sort((a, b) => (b.released || '').localeCompare(a.released || ''))[0];
  if (newest) $('[data-hero-news]').textContent = `New in the registry: ${newest.name || newest.id} (${relTime(newest.released)})`;
}

// ── Boot ────────────────────────────────────────────────────────────────────
if (!restore()) loadPreset('next');
renderSources();
renderTargets();
bindPlayground();
run();
renderMatrix();
renderModels();
