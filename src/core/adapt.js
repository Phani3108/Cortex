/**
 * Adaptation Engine — the feedback loop that makes context evolve.
 *
 * The core insight: AI tools are stateless. They don't learn.
 * But WE can learn on their behalf by:
 *
 *   1. Capturing signals (what user did after AI responded)
 *   2. Distilling those into rules (what should change)
 *   3. Evolving the context files (write better instructions)
 *   4. Tracking what works (measure signal quality over time)
 *
 * This creates the illusion of AI that learns, because the INSTRUCTIONS
 * get better every cycle. The model is the same — the prompt improves.
 *
 * ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
 * │ Signals │ ──▶ │ Distill  │ ──▶ │ Evolve   │ ──▶ │ Compile  │
 * └─────────┘     └──────────┘     └──────────┘     └──────────┘
 *      ▲                                                  │
 *      └──────────── user works with AI ──────────────────┘
 */

import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getCortexDir, readFileSafe, writeFileSafe } from '../utils/fs.js';
import { stringify, parse } from '../utils/yaml.js';

const ADAPTATION_FILE = 'adaptations.yaml';
const HISTORY_DIR = 'history';

/**
 * Process captured signals into adaptation actions.
 *
 * @param {object} signalReport - Output from captureSignals()
 * @param {object} currentConfig - Current cortex config
 * @returns {object} Adaptation plan
 */
export function distillSignals(signalReport) {
  const plan = {
    timestamp: new Date().toISOString(),
    newRules: [],        // Rules to add to .cortex/rules/
    modifiedRules: [],   // Existing rules to update
    removedRules: [],    // Rules to remove (user rejected them)
    contextUpdates: [],  // Updates to config.yaml context section
    profileUpdates: [],  // Updates to user profile
    importedRules: [],   // Rules imported from existing provider files
  };

  for (const signal of signalReport.signals) {
    switch (signal.action) {
      case 'add_to_rules':
        if (signal.confidence >= 0.7) {
          plan.newRules.push({
            content: signal.content,
            source: signal.source,
            provider: signal.provider,
            confidence: signal.confidence,
          });
        }
        break;

      case 'remove_from_rules':
        plan.removedRules.push({
          content: signal.content,
          source: signal.source,
          reason: 'User removed from compiled output',
        });
        break;

      case 'add_to_context':
        plan.contextUpdates.push({
          content: signal.content,
          category: signal.category,
          confidence: signal.confidence,
          source: signal.source,
        });
        break;

      case 'import_as_rule':
        plan.importedRules.push({
          content: signal.content,
          source: signal.source,
          provider: signal.provider,
          confidence: signal.confidence,
        });
        break;

      case 'track_evolution':
        // Record that user is actively editing rules (meta-signal)
        plan.profileUpdates.push({
          key: 'active_refinement',
          value: true,
          meta: signal.meta,
        });
        break;
    }
  }

  // Deduplicate new rules
  const seen = new Set();
  plan.newRules = plan.newRules.filter(r => {
    if (seen.has(r.content)) return false;
    seen.add(r.content);
    return true;
  });

  plan.contextUpdates = plan.contextUpdates.filter(r => {
    if (seen.has(r.content)) return false;
    seen.add(r.content);
    return true;
  });

  return plan;
}

/**
 * Parse existing auto-detected.md into a category→items map.
 * Preserves user edits and previously detected rules.
 */
function parseExistingAutoRules(content) {
  const byCategory = {};
  let currentCategory = 'general';
  for (const line of content.split('\n')) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      currentCategory = headerMatch[1].toLowerCase();
      continue;
    }
    const bulletMatch = line.match(/^-\s+(.+)/);
    if (bulletMatch) {
      if (!byCategory[currentCategory]) byCategory[currentCategory] = [];
      byCategory[currentCategory].push(bulletMatch[1]);
    }
  }
  return byCategory;
}

/**
 * Apply an adaptation plan to the .cortex/ directory.
 * This is the "evolution" step — actually changing the source of truth.
 */
export function applyAdaptation(projectRoot, plan, { dry = false } = {}) {
  const cortexDir = getCortexDir(projectRoot);
  const results = { applied: [], skipped: [], errors: [] };

  // 1. Write auto-detected context rules
  if (plan.contextUpdates.length > 0) {
    const autoRulesPath = join(cortexDir, 'rules', 'auto-detected.md');
    const existingContent = readFileSafe(autoRulesPath) || '';
    const existingLines = new Set(existingContent.split('\n').map(l => l.trim()));

    const newLines = plan.contextUpdates
      .filter(u => !existingLines.has(`- ${u.content}`))
      .map(u => `- ${u.content}`);

    if (newLines.length > 0) {
      // Merge: parse existing rules by category, then add new ones
      const byCategory = parseExistingAutoRules(existingContent);

      for (const update of plan.contextUpdates) {
        if (!existingLines.has(`- ${update.content}`)) {
          const cat = update.category || 'general';
          if (!byCategory[cat]) byCategory[cat] = [];
          byCategory[cat].push(update.content);
        }
      }

      let content = '# Auto-Detected Project Rules\n';
      content += '# Generated by `cortex learn` — edit or remove lines as needed.\n\n';

      for (const [category, items] of Object.entries(byCategory)) {
        content += `## ${capitalize(category)}\n`;
        for (const item of items) {
          content += `- ${item}\n`;
        }
        content += '\n';
      }

      if (!dry) {
        writeFileSafe(autoRulesPath, content, { force: true });
      }
      results.applied.push({ type: 'auto-detected rules', count: newLines.length, path: autoRulesPath });
    }
  }

  // 2. Import rules from existing provider files
  if (plan.importedRules.length > 0) {
    const importedPath = join(cortexDir, 'rules', 'imported.md');
    const existingContent = readFileSafe(importedPath) || '';
    const existingLines = new Set(existingContent.split('\n').map(l => l.trim()));

    const newRules = plan.importedRules
      .filter(r => !existingLines.has(`- ${r.content}`));

    if (newRules.length > 0) {
      const byProvider = {};
      for (const rule of newRules) {
        const key = rule.provider || 'unknown';
        if (!byProvider[key]) byProvider[key] = [];
        byProvider[key].push(rule.content);
      }

      let content = '# Imported Rules\n';
      content += '# Imported from existing provider config files by `cortex learn`.\n\n';

      for (const [provider, items] of Object.entries(byProvider)) {
        content += `## From ${provider}\n`;
        for (const item of items) {
          content += `- ${item}\n`;
        }
        content += '\n';
      }

      if (!dry) {
        writeFileSafe(importedPath, content, { force: true });
      }
      results.applied.push({ type: 'imported rules', count: newRules.length, path: importedPath });
    }
  }

  // 3. Handle user edits (highest confidence — add to corrections)
  if (plan.newRules.length > 0) {
    const correctionsPath = join(cortexDir, 'rules', 'corrections.md');
    const existingContent = readFileSafe(correctionsPath) || '';
    const existingLines = new Set(existingContent.split('\n').map(l => l.trim()));

    const newItems = plan.newRules.filter(r => !existingLines.has(`- ${r.content}`));

    if (newItems.length > 0) {
      let content = '# User Corrections\n';
      content += '# Rules added because you edited compiled output. Highest priority.\n\n';

      for (const rule of newItems) {
        content += `- ${rule.content}\n`;
      }
      content += '\n';

      if (!dry) {
        writeFileSafe(correctionsPath, content, { force: true });
      }
      results.applied.push({ type: 'user corrections', count: newItems.length, path: correctionsPath });
    }
  }

  // 4. Save adaptation history
  if (!dry) {
    saveHistory(cortexDir, plan, results);
  }

  return results;
}

/**
 * Load the adaptation state for a project.
 */
export function loadAdaptationState(projectRoot) {
  const cortexDir = getCortexDir(projectRoot);
  const statePath = join(cortexDir, ADAPTATION_FILE);
  const raw = readFileSafe(statePath);

  if (!raw) {
    return {
      version: 1,
      lastAdapted: null,
      totalCycles: 0,
      signalCounts: {},
    };
  }

  return parse(raw);
}

/**
 * Save adaptation state.
 */
export function saveAdaptationState(projectRoot, state) {
  const cortexDir = getCortexDir(projectRoot);
  const statePath = join(cortexDir, ADAPTATION_FILE);
  writeFileSafe(statePath, `# cortex adaptation state\n${stringify(state)}\n`, { force: true });
}

// ── History ─────────────────────────────────────────────────────────────────

function saveHistory(cortexDir, plan, results) {
  const historyDir = join(cortexDir, HISTORY_DIR);
  mkdirSync(historyDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const entry = {
    timestamp: plan.timestamp,
    newRules: plan.newRules.length,
    contextUpdates: plan.contextUpdates.length,
    importedRules: plan.importedRules.length,
    applied: results.applied,
  };

  writeFileSync(
    join(historyDir, `${timestamp}.json`),
    JSON.stringify(entry, null, 2) + '\n',
    'utf-8'
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
