// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Session persistence — remembers context across invocations.
 *
 * Think of it like a conversation memory for the CLI:
 * - What the user has done so far
 * - What was recommended and accepted/rejected
 * - Metrics accumulated over time (files compiled, signals captured, etc.)
 * - Current project state and goals
 *
 * Stored in .cortex/session.json (project-level) and ~/.cortex/session.json (global).
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFileSafe, writeFileSafe, getCortexDir } from '../utils/fs.js';

const SESSION_FILE = 'session.json';

const EMPTY_SESSION = {
  version: 1,
  startedAt: null,
  lastActivity: null,
  interactions: 0,
  goals: [],           // What the user said they want to achieve
  decisions: [],       // Choices made (provider selection, rule preferences, etc.)
  metrics: {
    compilations: 0,
    filesGenerated: 0,
    signalsCaptured: 0,
    rulesEvolved: 0,
    rulesAdded: 0,
    rulesRemoved: 0,
    providersUsed: [],
    skillsApplied: [],
    tokensOptimized: 0,     // Total tokens saved via budget-aware compilation
    contextRotPrevented: 0, // Times we suggested fresh chat
  },
  timeline: [],        // Chronological log of actions taken
  userNeeds: null,     // Assessed needs from onboarding
  recommendations: [], // What we suggested and their outcomes
};

/**
 * Load session from .cortex/session.json.
 */
export function loadSession(projectRoot) {
  const dir = getCortexDir(projectRoot);
  const sessionPath = join(dir, SESSION_FILE);
  const raw = readFileSafe(sessionPath);

  if (!raw) {
    return {
      ...structuredClone(EMPTY_SESSION),
      startedAt: new Date().toISOString(),
      _path: sessionPath,
      _isNew: true,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...structuredClone(EMPTY_SESSION), ...parsed, _path: sessionPath, _isNew: false };
  } catch {
    return { ...structuredClone(EMPTY_SESSION), _path: sessionPath, _isNew: true };
  }
}

/**
 * Save session state.
 */
export function saveSession(session) {
  const { _path, _isNew, ...data } = session;
  data.lastActivity = new Date().toISOString();
  writeFileSafe(_path, JSON.stringify(data, null, 2) + '\n', { force: true });
}

/**
 * Record an action in the session timeline.
 */
export function recordAction(session, action, detail = {}) {
  session.interactions++;
  session.timeline.push({
    at: new Date().toISOString(),
    action,
    ...detail,
  });
  // Keep timeline bounded to last 500 events
  if (session.timeline.length > 500) {
    session.timeline = session.timeline.slice(-500);
  }
}

/**
 * Record a decision the user made.
 */
export function recordDecision(session, question, choice, context = null) {
  session.decisions.push({
    at: new Date().toISOString(),
    question,
    choice,
    context,
  });
}

/**
 * Record a recommendation and its outcome.
 */
export function recordRecommendation(session, recommendation, accepted = null) {
  session.recommendations.push({
    at: new Date().toISOString(),
    recommendation,
    accepted,
  });
}

/**
 * Update metrics counters.
 */
export function updateMetrics(session, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && typeof session.metrics[key] === 'number') {
      session.metrics[key] += value;
    } else if (Array.isArray(value) && Array.isArray(session.metrics[key])) {
      for (const item of value) {
        if (!session.metrics[key].includes(item)) {
          session.metrics[key].push(item);
        }
      }
    }
  }
}

/**
 * Load the global session (user-level, spans all projects).
 */
export function loadGlobalSession() {
  const dir = getCortexDir(null, true);
  const sessionPath = join(dir, SESSION_FILE);
  const raw = readFileSafe(sessionPath);

  if (!raw) {
    return {
      ...structuredClone(EMPTY_SESSION),
      startedAt: new Date().toISOString(),
      _path: sessionPath,
      _isNew: true,
      projectSessions: {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return { ...structuredClone(EMPTY_SESSION), projectSessions: {}, ...parsed, _path: sessionPath, _isNew: false };
  } catch {
    return { ...structuredClone(EMPTY_SESSION), _path: sessionPath, _isNew: true, projectSessions: {} };
  }
}

export { EMPTY_SESSION };
