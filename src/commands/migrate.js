// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex migrate — Show what changes when switching between AI coding tools.
 *
 * Usage:
 *   cortex migrate copilot cursor
 *   cortex migrate cursor claude
 *   cortex migrate windsurf copilot
 */

import { compareProviders } from '../core/compare.js';
import { PROVIDER_SPECS } from '../core/specs.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

export default async function migrate({ positionals }) {
  const fromSlug = positionals[0];
  const toSlug = positionals[1];

  if (!fromSlug || !toSlug) {
    error('Usage: cortex migrate <from-provider> <to-provider>');
    dim('  Example: cortex migrate copilot cursor');
    dim('  Example: cortex migrate cursor claude');
    console.log();
    dim('Available providers:');
    for (const [key, spec] of Object.entries(PROVIDER_SPECS)) {
      dim(`  ${key.padEnd(14)} ${spec.name}`);
    }
    process.exit(1);
  }

  if (!PROVIDER_SPECS[fromSlug]) {
    error(`Unknown provider: '${fromSlug}'`);
    process.exit(1);
  }
  if (!PROVIDER_SPECS[toSlug]) {
    error(`Unknown provider: '${toSlug}'`);
    process.exit(1);
  }

  const result = compareProviders(fromSlug, toSlug);

  if (result.error) {
    error(result.error);
    process.exit(1);
  }

  heading(`Migration Report: ${result.from.name} → ${result.to.name}`);
  console.log();

  // File changes
  info('File Changes:');
  if (result.files.removed.length > 0) {
    for (const f of result.files.removed) {
      warn(`  - Remove: ${f}`);
    }
  }
  if (result.files.added.length > 0) {
    for (const f of result.files.added) {
      success(`  + Create: ${f}`);
    }
  }
  if (result.files.description) {
    dim(`  ${result.files.description}`);
  }
  console.log();

  // Features gained/lost
  if (result.features.gained.length > 0) {
    info('Features Gained:');
    for (const f of result.features.gained) {
      success(`  ✓ ${formatFeature(f)}`);
    }
    console.log();
  }

  if (result.features.lost.length > 0) {
    info('Features Lost:');
    for (const f of result.features.lost) {
      warn(`  ✗ ${formatFeature(f)}`);
    }
    console.log();
  }

  // Token budget
  info('Token Budget:');
  table([
    ['From', result.tokenBudget.fromLabel],
    ['To', result.tokenBudget.toLabel],
    ['Change', result.tokenBudget.change],
  ]);
  console.log();

  // Context window
  if (result.contextWindow.from !== result.contextWindow.to) {
    info('Context Window:');
    table([
      ['From', `${(result.contextWindow.from).toLocaleString()} tokens`],
      ['To', `${(result.contextWindow.to).toLocaleString()} tokens`],
    ]);
    console.log();
  }

  // Models
  if (result.models.gained.length > 0 || result.models.lost.length > 0) {
    info('Model Availability:');
    if (result.models.gained.length > 0) {
      success(`  Gained: ${result.models.gained.join(', ')}`);
    }
    if (result.models.lost.length > 0) {
      warn(`  Lost:   ${result.models.lost.join(', ')}`);
    }
    console.log();
  }

  // Format change
  if (result.formatChange.changed) {
    info('Format Change:');
    dim(`  ${result.formatChange.from} → ${result.formatChange.to}`);
    console.log();
  }

  // Best practices for target
  if (Object.keys(result.bestPractices).length > 0) {
    info(`Best Practices for ${result.to.name}:`);
    if (result.bestPractices.freshChatThreshold) {
      dim(`  • Start new chat after ~${result.bestPractices.freshChatThreshold} messages (context rot)`);
    }
    if (result.bestPractices.defensiveCommits) {
      dim('  • Commit before major AI changes (defensive commits)');
    }
    if (result.bestPractices.antiLazyPrompt) {
      dim('  • Include explicit instruction depth reminders');
    }
    console.log();
  }

  // Migration steps
  info('Migration Steps:');
  result.migrationSteps.forEach((step, i) => {
    dim(`  ${i + 1}. ${step}`);
  });
  console.log();
}

function formatFeature(key) {
  const labels = {
    memory: 'Persistent memory across sessions',
    projectContext: 'Project file awareness',
    customInstructions: 'Custom instruction files',
    mdcFormat: 'MDC format (YAML frontmatter + glob matching)',
    yamlFrontmatter: 'YAML frontmatter in rules',
    globMatching: 'Glob-based file targeting for rules',
    composers: 'Agent/Composer modes',
    planMode: 'Plan-before-execute mode',
    subAgents: 'Parallel sub-agents',
    automations: 'Event-driven automations',
    backgroundAgents: 'Long-running background agents',
    contextRot: 'Context rot (quality degrades over long chats)',
    hooks: 'Pre/post command hooks',
    customSlashCommands: 'Custom slash commands',
    githubActions: 'GitHub Actions CI integration',
    worktrees: 'Parallel sessions via git worktrees',
    mcpServers: 'MCP server support',
    codeReview: 'Code review instructions',
    scopedInstructions: 'Scoped instruction files',
    agentMode: 'Full agent mode',
    customAgents: 'Custom chat participants',
    cascade: 'Cascade multi-step agent mode',
    flows: 'Structured workflow flows',
    knowledgeGraph: 'Indexed codebase knowledge graph',
    skills: 'SKILL.md format support',
    skillBundles: 'Organized skill collections',
    sandboxed: 'Sandboxed execution',
    networkDisabled: 'Network-disabled sandbox',
    multiModel: 'Multi-model switching',
    largeContext: 'Large context window (1M+)',
    extensions: 'Extension/plugin support',
    checkpointing: 'Auto-checkpoints for undo',
    compress: 'Context compression commands',
    yoloMode: 'Auto-approve all tool calls',
    ideIntegration: 'IDE integration (VS Code, JetBrains)',
    specDriven: 'Spec-driven development workflow',
    steeringHooks: 'Event-driven steering hooks',
    vibeToSpec: 'Vibe prompt → formal spec conversion',
    canvasMode: 'Canvas mode for code editing',
  };
  return labels[key] || key;
}
