// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex tutorial — stepwise Cortex Academy guide and sample scaffolder.
 */

import { existsSync, cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { findProjectRoot } from '../utils/fs.js';
import { heading, info, success, warn, error, dim, table } from '../utils/log.js';

const LANES = {
  'lane-a': {
    key: 'lane-a',
    name: 'Lane A — Assistant App + API',
    sampleDir: 'lane-a-assistant-app',
    summary: 'Single-assistant app with typed API, contracts, and safe defaults.',
  },
  'lane-b': {
    key: 'lane-b',
    name: 'Lane B — Workflow Agent',
    sampleDir: 'lane-b-workflow-agent',
    summary: 'Tool-using workflow agent with planner/executor separation.',
  },
  'lane-c': {
    key: 'lane-c',
    name: 'Lane C — MCP Server',
    sampleDir: 'lane-c-mcp-server',
    summary: 'Contract-first MCP server with validated tools and audit-safe mutation path.',
  },
};

const PHASES = [
  {
    id: 0,
    title: 'Pick Build Lane',
    goal: 'Choose lane and constraints (budget, latency, team, compliance).',
    validation: 'Primary lane selected and stack constraints documented.',
  },
  {
    id: 1,
    title: 'Define Contracts',
    goal: 'Define API, agent, and tool schemas before implementation.',
    validation: 'OpenAPI + JSON schemas exist for critical endpoints/tools.',
  },
  {
    id: 2,
    title: 'Build Safe Core',
    goal: 'Ship first end-to-end path with guardrails and fallback behavior.',
    validation: 'Timeouts, retries, token limits, and error schema implemented.',
  },
  {
    id: 3,
    title: 'Add MCP / Tooling',
    goal: 'Expose capabilities with strict contract validation and auth checks.',
    validation: 'Each tool has input/output schema + auditable execution path.',
  },
  {
    id: 4,
    title: 'Harden Quality',
    goal: 'Add contract tests, evals, telemetry, and migration policy.',
    validation: 'Golden tests and compatibility checks run in CI.',
  },
  {
    id: 5,
    title: 'Scale Deliberately',
    goal: 'Scale after bottlenecks are measured, not assumed.',
    validation: 'Top cost drivers, failover path, and request tracing are in place.',
  },
];

const VIDEO_PLACEHOLDERS = [
  { phase: 'Episode 1', topic: 'Pick stack, model, and DB with constraints', url: 'https://www.youtube.com/embed/VIDEO_ID_1' },
  { phase: 'Episode 2', topic: 'Contract-first API and tool schemas', url: 'https://www.youtube.com/embed/VIDEO_ID_2' },
  { phase: 'Episode 3', topic: 'Build your first safe single-task agent', url: 'https://www.youtube.com/embed/VIDEO_ID_3' },
  { phase: 'Episode 4', topic: 'Convert tools into MCP capabilities', url: 'https://www.youtube.com/embed/VIDEO_ID_4' },
  { phase: 'Episode 5', topic: 'Add evals, telemetry, and fallback models', url: 'https://www.youtube.com/embed/VIDEO_ID_5' },
];

export default async function tutorial({ values, positionals }) {
  const subcommand = (positionals[0] || 'start').toLowerCase();

  if (subcommand === 'lanes') return showLanes();
  if (subcommand === 'phases') return showPhases();
  if (subcommand === 'videos') return showVideos();
  if (subcommand === 'start') return startFlow();
  if (subcommand === 'scaffold') return scaffoldLane(positionals[1], positionals[2], values);

  warn(`Unknown tutorial subcommand: ${subcommand}`);
  dim('Use: cortex tutorial lanes|phases|videos|start|scaffold');
}

function showLanes() {
  heading('Cortex Academy Lanes');
  const rows = Object.values(LANES).map(l => [l.key, l.name, l.summary]);
  table(rows);
  console.log();
  dim('Scaffold a lane: cortex tutorial scaffold lane-a ./my-project');
}

function showPhases() {
  heading('Cortex Academy Phases');
  const rows = PHASES.map(p => [`${p.id}`, p.title, p.goal]);
  table(rows);
  console.log();
  dim('Validation checkpoints are included in content/cortex-academy-playbook.md');
}

function showVideos() {
  heading('Video Module Placeholders');
  const rows = VIDEO_PLACEHOLDERS.map(v => [v.phase, v.topic, v.url]);
  table(rows);
}

async function startFlow() {
  heading('Cortex Academy — Guided Start');
  info('Choose a lane, then start from Phase 0 and move sequentially.');
  console.log();

  const lane = await chooseLane();
  if (!lane) return;

  success(`Selected ${lane.name}`);
  info(lane.summary);
  console.log();

  info('Recommended next steps:');
  dim('1) cortex tutorial phases');
  dim(`2) cortex tutorial scaffold ${lane.key} ./my-${lane.key}-project`);
  dim('3) cd <project> && npm install && npm run dev');
}

function getSamplesRoot() {
  const projectRoot = findProjectRoot();
  return join(projectRoot, 'samples');
}

function ensureLane(laneKey) {
  const lane = LANES[(laneKey || '').toLowerCase()];
  if (!lane) {
    error('Usage: cortex tutorial scaffold <lane-a|lane-b|lane-c> [target-dir]');
    process.exit(1);
  }
  return lane;
}

function scaffoldLane(laneKey, targetDirArg, values) {
  const lane = ensureLane(laneKey);
  const dry = !!values.dry;
  const force = !!values.force;

  const samplesRoot = getSamplesRoot();
  const sourceDir = join(samplesRoot, lane.sampleDir);
  if (!existsSync(sourceDir)) {
    error(`Sample not found for ${lane.key}. Expected: ${sourceDir}`);
    process.exit(1);
  }

  const targetDir = resolve(targetDirArg || `./${lane.sampleDir}`);

  if (existsSync(targetDir)) {
    const entries = readdirSync(targetDir).filter(name => !name.startsWith('.DS_Store'));
    if (entries.length > 0 && !force) {
      error(`Target directory is not empty: ${targetDir}`);
      dim('Use --force to allow writing into a non-empty directory.');
      process.exit(1);
    }
  }

  heading(`Scaffold ${lane.name}`);
  info(`Source: ${sourceDir}`);
  info(`Target: ${targetDir}`);

  if (dry) {
    warn('Dry run — no files were written.');
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true, force: true });

  success('Scaffold created.');
  console.log();
  dim(`cd ${targetDir}`);
  dim('npm install');
  dim('npm run dev');
  dim('cortex compile');
}

async function chooseLane() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const options = Object.values(LANES);

  options.forEach((lane, idx) => {
    console.log(`  ${idx + 1}) ${lane.name}`);
  });
  console.log();

  const answer = await new Promise(resolve => {
    rl.question(`  Choose lane (1-${options.length}): `, value => resolve(value.trim()));
  });
  rl.close();

  const idx = Number.parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
    warn('No valid lane selected.');
    return null;
  }
  return options[idx];
}
