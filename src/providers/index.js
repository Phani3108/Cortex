/**
 * Provider registry — maps provider names to compile functions.
 */

import * as claude from './claude.js';
import * as cursor from './cursor.js';
import * as copilot from './copilot.js';
import * as windsurf from './windsurf.js';
import * as antigravity from './antigravity.js';
import * as codex from './codex.js';
import * as gemini from './gemini.js';
import * as openai from './openai.js';
import * as kiro from './kiro.js';

const providers = {
  claude,
  cursor,
  copilot,
  windsurf,
  antigravity,
  codex,
  gemini,
  openai,
  kiro,
};

export function getProvider(name) {
  return providers[name] || null;
}

export function getAllProviders() {
  return { ...providers };
}

export function getEnabledProviders(config) {
  const enabled = {};
  for (const [name, provider] of Object.entries(providers)) {
    if (config.providers?.[name]) {
      enabled[name] = provider;
    }
  }
  return enabled;
}
