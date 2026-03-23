/**
 * Conversational Assistant — the friendly guide that makes cortex approachable.
 *
 * This isn't a chatbot. It's a structured conversation engine that:
 * 1. Asks the right questions to understand the user's situation
 * 2. Assesses what they need vs what cortex can do
 * 3. Suggests the best path forward
 * 4. Lets them choose, then recalibrates
 * 5. Remembers everything via session persistence
 * 6. Quantifies impact at the end
 *
 * The key insight: users don't want to read docs. They want to be *guided*.
 * A million use cases → one conversation flow that adapts.
 */

import { createInterface } from 'node:readline';
import { PROVIDER_SPECS, MODEL_STRATEGIES } from './specs.js';
import { loadConfig, saveConfig } from './config.js';
import { loadProfile, saveProfile } from './profile.js';
import {
  loadSession, saveSession,
  recordAction, recordDecision, recordRecommendation,
} from './session.js';
import { calculateSavings, generateSummary } from './metrics.js';
import { existsSync, readdirSync } from 'node:fs';
import { getCortexDir, findProjectRoot } from '../utils/fs.js';

// ── Terminal I/O ────────────────────────────────────────────────────────────

let rl = null;

function initReadline() {
  if (rl) return rl;
  rl = createInterface({ input: process.stdin, output: process.stdout });
  return rl;
}

function closeReadline() {
  if (rl) { rl.close(); rl = null; }
}

async function ask(question) {
  const r = initReadline();
  return new Promise(resolve => {
    r.question(question, answer => resolve(answer.trim()));
  });
}

async function askChoice(question, options) {
  const r = initReadline();
  console.log();
  console.log(`  ${question}`);
  options.forEach((opt, i) => {
    console.log(`    ${i + 1}) ${opt.label}${opt.hint ? ` — ${opt.hint}` : ''}`);
  });
  console.log();

  return new Promise(resolve => {
    const prompt = () => {
      r.question(`  Choose (1-${options.length}): `, answer => {
        const idx = parseInt(answer, 10) - 1;
        if (idx >= 0 && idx < options.length) {
          resolve(options[idx]);
        } else {
          prompt();
        }
      });
    };
    prompt();
  });
}

async function askYesNo(question, defaultYes = true) {
  const suffix = defaultYes ? '(Y/n)' : '(y/N)';
  const answer = await ask(`  ${question} ${suffix}: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

function say(msg) { console.log(`  ${msg}`); }
function sayBold(msg) { console.log(`\n  \x1b[1m${msg}\x1b[0m`); }
function sayDim(msg) { console.log(`  \x1b[90m${msg}\x1b[0m`); }
function sayGreen(msg) { console.log(`  \x1b[32m${msg}\x1b[0m`); }
function sayYellow(msg) { console.log(`  \x1b[33m${msg}\x1b[0m`); }
function sayCyan(msg) { console.log(`  \x1b[36m${msg}\x1b[0m`); }
function divider() { console.log(`  ${'─'.repeat(50)}`); }

// ── Conversation Flows ──────────────────────────────────────────────────────

/**
 * Determine what the user needs and which flow to run.
 */
export async function startConversation(projectRoot) {
  const session = loadSession(projectRoot);
  const cortexDir = getCortexDir(projectRoot);
  const isInitialized = existsSync(cortexDir);

  try {
    if (session._isNew && !isInitialized) {
      // Brand new user, project not set up
      return await flowFirstTime(projectRoot, session);
    } else if (session._isNew && isInitialized) {
      // Project exists but no session — returning or first assist run
      return await flowReturning(projectRoot, session);
    } else {
      // Ongoing session — context-aware guidance
      return await flowOngoing(projectRoot, session);
    }
  } finally {
    saveSession(session);
    closeReadline();
  }
}

// ── Flow: First Time ────────────────────────────────────────────────────────
// User has never used cortex on this project. Full onboarding.

async function flowFirstTime(projectRoot, session) {
  console.log();
  sayBold('👋 Welcome to cortex — your AI context engine.');
  say('');
  say("I'll help you set this up. Let me ask a few questions to");
  say('figure out the best configuration for your project.');
  divider();

  // Step 1: What AI tools do you use?
  sayBold('Which AI coding tools do you use?');
  sayDim('(Select all that apply — we\'ll configure them all at once)');
  console.log();

  const toolChoices = Object.entries(PROVIDER_SPECS).map(([key, spec]) => ({
    key,
    label: spec.name,
    selected: false,
  }));

  const selectedTools = await askMultiSelect(toolChoices);
  recordDecision(session, 'ai_tools_used', selectedTools.map(t => t.key));
  recordAction(session, 'onboarding_tools_selected', { tools: selectedTools.map(t => t.key) });

  if (selectedTools.length === 0) {
    say('');
    sayYellow("No tools selected. That's fine — you can enable them later.");
    sayDim('Run `cortex assist` again anytime.');
    return;
  }

  // Step 2: What's your main goal?
  const goal = await askChoice('What are you mainly trying to solve?', [
    { key: 'consistency',  label: 'Consistent AI behavior across tools', hint: 'same rules everywhere' },
    { key: 'quality',      label: 'Higher quality AI output', hint: 'better code suggestions' },
    { key: 'team',         label: 'Team-wide AI standards', hint: 'everyone gets the same context' },
    { key: 'learning',     label: 'AI that gets smarter over time', hint: 'feedback loop' },
    { key: 'exploration',  label: 'Just exploring what this can do', hint: 'show me everything' },
  ]);
  recordDecision(session, 'primary_goal', goal.key);
  session.goals.push(goal.key);

  // Step 3: Profile quick-setup
  sayBold('Quick style preferences:');

  const tone = await askChoice('How should AI respond to you?', [
    { key: 'concise',   label: 'Concise', hint: 'short, direct answers' },
    { key: 'detailed',  label: 'Detailed', hint: 'thorough explanations' },
    { key: 'balanced',  label: 'Balanced', hint: 'somewhere in between' },
  ]);
  recordDecision(session, 'tone_preference', tone.key);

  const comments = await askChoice('Code comments?', [
    { key: 'minimal', label: 'Minimal', hint: 'only where logic isn\'t obvious' },
    { key: 'moderate', label: 'Moderate', hint: 'key functions and complex logic' },
    { key: 'verbose', label: 'Verbose', hint: 'document everything' },
  ]);
  recordDecision(session, 'comment_preference', comments.key);

  // Step 4: Show what we'll do
  console.log();
  divider();
  sayBold('📋 Here\'s the plan:');
  say('');
  say(`  1. Initialize .cortex/ in your project`);
  say(`  2. Configure ${selectedTools.length} provider(s): ${selectedTools.map(t => t.label).join(', ')}`);
  say(`  3. Set tone to "${tone.key}", comments to "${comments.key}"`);
  say(`  4. Generate all provider-specific files`);

  // Savings preview
  const manualMinutes = selectedTools.length * 15;
  say('');
  sayGreen(`  ⏱  Manual setup would take ~${manualMinutes} min. This takes ~10 sec.`);

  if (goal.key === 'learning') {
    say('');
    sayCyan('  💡 Tip: After compile, run `cortex watch` to auto-learn from your edits.');
  }
  if (goal.key === 'team') {
    say('');
    sayCyan('  💡 Tip: Commit .cortex/ to git so your team gets the same AI config.');
  }

  const proceed = await askYesNo('Proceed?');
  if (!proceed) {
    sayDim('No problem. Run `cortex assist` again when ready.');
    return;
  }

  // Execute!
  recordAction(session, 'onboarding_complete', {
    tools: selectedTools.map(t => t.key),
    goal: goal.key,
    tone: tone.key,
    comments: comments.key,
  });

  session.userNeeds = {
    tools: selectedTools.map(t => t.key),
    goal: goal.key,
    tone: tone.key,
    comments: comments.key,
    assessedAt: new Date().toISOString(),
  };

  // Return the plan for the CLI command to execute
  return {
    action: 'setup',
    providers: Object.fromEntries(
      Object.keys(PROVIDER_SPECS).map(k => [k, selectedTools.some(t => t.key === k)])
    ),
    profile: { tone: tone.key, comments: comments.key },
    goal: goal.key,
  };
}

// ── Flow: Returning User ────────────────────────────────────────────────────
// Project is initialized but this is first assist run. Assess current state.

async function flowReturning(projectRoot, session) {
  const config = loadConfig(projectRoot);
  const enabledProviders = Object.entries(config.providers || {})
    .filter(([, v]) => v).map(([k]) => k);

  console.log();
  sayBold('👋 Welcome back. Let me see what we\'re working with...');
  divider();

  // Show current state
  say(`Project: ${config.project?.name || projectRoot}`);
  say(`Providers: ${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'none enabled'}`);
  say(`Language: ${config.project?.language || 'not set'}`);
  say(`Framework: ${config.project?.framework || 'not set'}`);

  // Suggest improvements
  const suggestions = assessProject(projectRoot, config);

  if (suggestions.length > 0) {
    console.log();
    sayBold('💡 I have some suggestions:');
    suggestions.forEach((s, i) => {
      say(`  ${i + 1}. ${s.message}`);
      sayDim(`     ${s.detail}`);
    });

    const choice = await askChoice('What would you like to do?', [
      ...suggestions.map(s => ({ key: s.key, label: s.message, hint: s.action })),
      { key: 'skip', label: 'Skip for now', hint: 'I\'ll figure it out' },
      { key: 'summary', label: 'Show me my impact numbers', hint: 'what has cortex done so far?' },
    ]);

    recordDecision(session, 'returning_action', choice.key);
    recordAction(session, 'returning_flow', { choice: choice.key });

    if (choice.key === 'summary') {
      return { action: 'summary' };
    }
    if (choice.key === 'skip') {
      sayDim('No problem. Run `cortex assist` anytime.');
      return null;
    }

    recordRecommendation(session, choice.label, true);
    return { action: choice.key, suggestion: choice };
  }

  // No suggestions — project looks good
  sayGreen('✓ Project looks well-configured!');
  const whatNext = await askChoice('What would you like to do?', [
    { key: 'compile',  label: 'Recompile provider files', hint: 'regenerate all outputs' },
    { key: 'learn',    label: 'Capture new signals', hint: 'learn from recent changes' },
    { key: 'summary',  label: 'Show impact summary', hint: 'numbers on what cortex saved you' },
    { key: 'explore',  label: 'What else can cortex do?', hint: 'show me capabilities' },
  ]);

  recordDecision(session, 'returning_action', whatNext.key);
  recordAction(session, 'returning_flow', { choice: whatNext.key });

  if (whatNext.key === 'explore') {
    await showCapabilities(session);
    return null;
  }

  return { action: whatNext.key };
}

// ── Flow: Ongoing ───────────────────────────────────────────────────────────
// User has an active session. Context-aware, remembers previous interactions.

async function flowOngoing(projectRoot, session) {
  const config = loadConfig(projectRoot);
  const savings = calculateSavings(projectRoot);

  console.log();
  sayBold(`Session #${session.interactions + 1}`);
  sayDim(`Active for ${savings.activity.daysSinceStart} day(s) · ${savings.activity.compilations} compiles · ${savings.quality.signalsCaptured} signals`);
  divider();

  // Context-aware suggestions based on session history
  const recentActions = session.timeline.slice(-5).map(t => t.action);
  const suggestions = [];

  if (!recentActions.includes('compile') && session.metrics.compilations === 0) {
    suggestions.push({ key: 'compile', msg: "You haven't compiled yet — let's generate your provider files." });
  }
  if (session.metrics.compilations > 0 && session.metrics.signalsCaptured === 0) {
    suggestions.push({ key: 'learn', msg: 'You\'ve compiled but haven\'t captured signals yet. Run learn to start the feedback loop.' });
  }
  if (session.metrics.signalsCaptured > 5 && session.metrics.rulesEvolved === 0) {
    suggestions.push({ key: 'adapt', msg: `${session.metrics.signalsCaptured} signals captured but no rules evolved yet. Time to adapt.` });
  }
  if (savings.quality.consistencyScore < 50) {
    suggestions.push({ key: 'add_providers', msg: `Consistency score is ${savings.quality.consistencyScore}/100. Adding more providers would help.` });
  }

  if (suggestions.length > 0) {
    sayBold('Based on your progress:');
    suggestions.forEach(s => sayCyan(`  → ${s.msg}`));
    console.log();
  }

  const choice = await askChoice('What would you like to do?', [
    { key: 'compile',  label: 'Compile', hint: 'regenerate all provider files' },
    { key: 'learn',    label: 'Learn', hint: 'capture signals from your work' },
    { key: 'summary',  label: 'Show summary', hint: `${savings.time.totalSavedMinutes} min saved so far` },
    { key: 'add',      label: 'Add rule or skill', hint: 'expand your AI context' },
    { key: 'explore',  label: 'What can I do next?', hint: 'show capabilities' },
    { key: 'report',   label: 'Full project report', hint: 'complete impact analysis' },
  ]);

  recordAction(session, 'ongoing_choice', { choice: choice.key });

  if (choice.key === 'explore') {
    await showCapabilities(session);
    return null;
  }
  if (choice.key === 'report') {
    return { action: 'report' };
  }

  return { action: choice.key };
}

// ── Project Assessment ──────────────────────────────────────────────────────

function assessProject(projectRoot, config) {
  const suggestions = [];
  const enabledProviders = Object.entries(config.providers || {})
    .filter(([, v]) => v).map(([k]) => k);

  // Low provider coverage
  if (enabledProviders.length < 3) {
    const disabled = Object.keys(PROVIDER_SPECS).filter(k => !enabledProviders.includes(k));
    suggestions.push({
      key: 'add_providers',
      message: `Only ${enabledProviders.length} provider(s) enabled — you're missing ${disabled.slice(0, 3).join(', ')}`,
      detail: 'More providers = more consistent AI experience across tools',
      action: 'Enable additional providers',
    });
  }

  // No language detected
  if (!config.project?.language) {
    suggestions.push({
      key: 'set_language',
      message: 'No language/framework set in config',
      detail: 'Setting this gives AI tools better context about your project',
      action: 'Auto-detect and set project language',
    });
  }

  // No rules beyond defaults
  const cortexDir = getCortexDir(projectRoot);
  const rulesDir = `${cortexDir}/rules`;
  if (existsSync(rulesDir)) {
    const ruleFiles = readdirSync(rulesDir).filter(f => !f.startsWith('.'));
    if (ruleFiles.length <= 1) {
      suggestions.push({
        key: 'add_rules',
        message: 'Only default rules — add project-specific rules for better output',
        detail: 'Custom rules make AI follow your exact coding style and patterns',
        action: 'Add custom rules',
      });
    }
  }

  // No skills
  const skillsDir = `${cortexDir}/skills`;
  if (existsSync(skillsDir)) {
    const skillFiles = readdirSync(skillsDir).filter(f => !f.startsWith('.'));
    if (skillFiles.length === 0) {
      suggestions.push({
        key: 'add_skills',
        message: 'No skills loaded — skills give AI specialized capabilities',
        detail: 'Try: code-review, security-audit, debugging, tdd',
        action: 'Add skills from templates',
      });
    }
  }

  return suggestions;
}

// ── Capability Explorer ─────────────────────────────────────────────────────

async function showCapabilities(session) {
  console.log();
  sayBold('🛠  What cortex can do:');
  console.log();

  const capabilities = [
    ['compile',  'Generate config files for 9 AI tools from one source',     'cortex compile'],
    ['learn',    'Capture feedback signals from your work with AI',          'cortex learn'],
    ['watch',    'Auto-recompile and auto-learn as you work',               'cortex watch'],
    ['import',   'Reverse-import existing .cursorrules, CLAUDE.md, etc.',   'cortex import'],
    ['diff',     'See what changed since last compile',                     'cortex diff'],
    ['cost',     'Token cost analysis across all providers',                'cortex cost'],
    ['hooks',    'Install git hooks for automatic learning on commit',      'cortex hooks install'],
    ['export',   'Export your context for sharing or backup',               'cortex export'],
    ['add',      'Add new rules, skills, or sources interactively',        'cortex add skill <name>'],
    ['sync',     'Pull skills and rules from upstream registries',          'cortex sync'],
    ['profile',  'Manage your personal AI style (global, follows you)',     'cortex profile'],
    ['status',   'See current configuration status',                        'cortex status'],
    ['assist',   'This guided conversation mode',                           'cortex assist'],
  ];

  for (const [cmd, desc, usage] of capabilities) {
    say(`  ${cmd.padEnd(10)} ${desc}`);
    sayDim(`${''.padEnd(12)} ${usage}`);
  }

  recordAction(session, 'explored_capabilities');
}

// ── Multi-Select Helper ─────────────────────────────────────────────────────

async function askMultiSelect(choices) {
  choices.forEach((c, i) => {
    say(`  ${i + 1}) ${c.label}`);
  });
  console.log();
  say('Enter numbers separated by commas (e.g., 1,2,5), or "all":');
  const answer = await ask('  > ');

  if (answer.toLowerCase() === 'all') {
    choices.forEach(c => c.selected = true);
    return choices;
  }

  const indices = answer.split(',')
    .map(s => parseInt(s.trim(), 10) - 1)
    .filter(i => i >= 0 && i < choices.length);

  for (const i of indices) {
    choices[i].selected = true;
  }

  return choices.filter(c => c.selected);
}

export { closeReadline };
