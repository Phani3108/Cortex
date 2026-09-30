// Docs page: render the tool table and CLI reference from the engine's data.
import { TARGETS, TARGET_IDS, VERIFIED_ON } from '/engine/src/engine/index.js';
import { COMMANDS, COMMAND_GROUPS, OPTIONS_HELP } from '/engine/src/engine/commands.js';
import { $, esc } from './util.js';

function limit(b) {
  if (b.hard) return `${b.hard.toLocaleString()} ${b.unit} (hard)`;
  if (b.soft) return `≈ ${b.soft} ${b.unit} (guidance)`;
  return '—';
}

$('#targets-table').innerHTML = `<thead><tr><th>Id</th><th>Tool</th><th>Always-on file</th><th>Scoped rules</th><th>Skills</th><th>Limit</th></tr></thead><tbody>${
  TARGET_IDS.map(id => {
    const t = TARGETS[id];
    return `<tr><td><code>${esc(id)}</code></td><td>${esc(t.name)}<div class="tiny muted">${esc(t.notes)}</div></td><td><code>${esc(t.mainFile)}</code></td>
      <td>${t.scopedPattern ? `<code>${esc(t.scopedPattern.replace('{slug}', '*'))}</code>` : '<span class="muted">sections</span>'}</td>
      <td>${t.skillsDir ? `<code>${esc(t.skillsDir)}/</code>` : '—'}</td><td class="small">${esc(limit(t.budget))}</td></tr>`;
  }).join('')}</tbody>`;
$('#targets-table').insertAdjacentHTML('afterend', `<p class="tiny muted">Verified against vendor docs on ${esc(VERIFIED_ON)}.</p>`);

$('#commands-list').innerHTML = COMMAND_GROUPS.map(g => `
  <h3>${esc(g.title)}</h3>
  ${COMMANDS.filter(c => c.group === g.id).map(c => `
    <div class="cmd-row" id="cmd-${esc(c.name)}">
      <div><code>cortex ${esc(c.name)}</code></div>
      <div><div class="text-2" style="font-size:15px">${esc(c.summary)}</div>
        <div class="row" style="gap:6px;margin-top:8px">${c.examples.map(e => `<code>${esc(e)}</code>`).join('')}</div></div>
    </div>`).join('')}`).join('');

$('#options-list').innerHTML = OPTIONS_HELP.map(([flag, desc]) => `<div class="cmd-row"><div><code>${esc(flag)}</code></div><div class="text-2">${esc(desc)}</div></div>`).join('');
