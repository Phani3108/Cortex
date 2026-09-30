// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex sync — Sync skills/rules from upstream sources.
 *
 * Supports:
 * - local: No-op (already on disk)
 * - https://github.com/org/repo (or any https://….git): shallow git clone into
 *   a cache, copy its rules/ or skills/ markdown files
 * - any other https:// URL: fetch a single markdown file
 *
 * Only https: URLs are accepted. Nothing is ever passed through a shell.
 * Synced files are namespaced as `synced-<source>-<name>.md` and carry a
 * marker comment; files without the marker (hand-written) are never overwritten.
 */

import { join, resolve, sep } from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { findProjectRoot, getCortexDir, writeFileSafe, readFileSafe } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { heading, info, warn, success, error, dim, fileCreated } from '../utils/log.js';

const CACHE_DIR_NAME = '.sync-cache';
const SYNC_MARKER = '<!-- cortex:synced';
const MAX_FILE_BYTES = 512 * 1024;
const SAFE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

export default async function sync({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = values.dry;

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exitCode = 1;
    return;
  }

  heading('Syncing from upstream sources');

  const config = loadConfig(projectRoot);
  const cacheDir = join(cortexDir, CACHE_DIR_NAME);

  let synced = 0;
  let failed = 0;
  let remote = 0;

  for (const type of ['rules', 'skills']) {
    const sources = asList(config[type]?.sources);
    info(`${type === 'rules' ? 'Rule' : 'Skill'} sources: ${sources.join(', ') || 'local'}`);

    for (const source of sources) {
      const parsed = validateSource(source);
      if (parsed.kind === 'local') {
        dim(`  Local ${type} — nothing to sync`);
        continue;
      }
      remote++;
      if (parsed.kind === 'invalid') {
        warn(`Skipped ${JSON.stringify(String(source))}: ${parsed.reason}`);
        failed++;
        continue;
      }

      try {
        const files = parsed.kind === 'git'
          ? fetchGitSource(parsed.url, cacheDir, type, dry)
          : await fetchHttpFile(parsed.url, dry);
        const destDir = join(cortexDir, type);
        const written = writeSyncedFiles(destDir, sourceSlug(parsed.url), files, parsed.url, { dry });
        for (const w of written) {
          if (w.status === 'skipped') {
            warn(`Skipped ${w.path}: ${w.reason}`);
          } else {
            fileCreated(w.path);
            synced++;
          }
        }
      } catch (err) {
        warn(`Failed to sync ${parsed.url}: ${err.message}`);
        failed++;
      }
    }
  }

  console.log();
  if (failed > 0) process.exitCode = 1;

  if (synced > 0) {
    success(`Synced ${synced} file(s)${failed > 0 ? `, ${failed} source(s) failed` : ''}`);
    dim('Run `cortex compile` to propagate synced rules to all providers.');
  } else if (failed > 0) {
    error(`${failed} source(s) failed to sync. Check URLs and network connectivity.`);
  } else if (remote > 0) {
    info(dry ? 'Dry run — nothing written.' : 'Remote sources had no new files.');
  } else {
    info('All sources are local. Add https:// URLs to config.yaml to sync.');
    dim('Example in .cortex/config.yaml:');
    dim('  rules:');
    dim('    sources:');
    dim('      - local');
    dim('      - https://github.com/org/ai-rules');
  }
}

// ── Source validation ──────────────────────────────────────────────────────

/**
 * Classify a configured source. Only `local` and https: URLs are allowed.
 * @returns {{kind:'local'} | {kind:'git'|'http', url:string} | {kind:'invalid', reason:string}}
 */
export function validateSource(source) {
  if (source === null || source === undefined || source === 'local') return { kind: 'local' };
  if (typeof source !== 'string') return { kind: 'invalid', reason: 'source must be a string' };
  const s = source.trim();
  if (!s || s === 'local') return { kind: 'local' };

  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    return { kind: 'invalid', reason: "only 'local' and https:// URLs are supported" };
  }

  let url;
  try { url = new URL(s); } catch { return { kind: 'invalid', reason: 'not a valid URL' }; }
  if (url.protocol !== 'https:') return { kind: 'invalid', reason: 'only https:// URLs are allowed' };
  if (url.username || url.password) return { kind: 'invalid', reason: 'credentials in URLs are not allowed' };
  if (/[\s\0]/.test(s)) return { kind: 'invalid', reason: 'URL contains whitespace' };

  return { kind: isGitUrl(url) ? 'git' : 'http', url: url.href };
}

function isGitUrl(url) {
  if (url.pathname.endsWith('.git')) return true;
  return /^(www\.)?(github|gitlab|bitbucket)\.(com|org)$/.test(url.hostname) &&
    /^\/[^/]+\/[^/]+\/?$/.test(url.pathname);
}

/** Short, filesystem-safe slug for a source URL (e.g. org-repo). */
export function sourceSlug(href) {
  const url = new URL(href);
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map(p => p.replace(/\.(git|md|markdown|txt)$/i, ''));
  const tail = segments.length ? segments.slice(-2).join('-') : url.hostname;
  const slug = tail.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return slug || 'remote';
}

/** Turn a remote file name into a safe local base name, or null if unusable. */
export function safeBaseName(name) {
  const base = String(name || '').split(/[\\/]/).pop().toLowerCase()
    .replace(/\.(md|markdown|txt)$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-.]+$/g, '')
    .slice(0, 80);
  if (!base || base.includes('..') || !SAFE_NAME.test(base)) return null;
  return base;
}

// ── Writing ────────────────────────────────────────────────────────────────

/**
 * Write synced files into destDir as synced-<slug>-<name>.md.
 * Never writes outside destDir and never overwrites a file lacking the sync marker.
 */
export function writeSyncedFiles(destDir, slug, files, sourceUrl, { dry = false } = {}) {
  const results = [];
  const root = resolve(destDir);

  for (const file of files) {
    const base = safeBaseName(file.name);
    if (!base) {
      results.push({ status: 'skipped', path: String(file.name), reason: 'unsafe file name' });
      continue;
    }
    const fileName = `synced-${slug}-${base}.md`;
    const dest = resolve(root, fileName);
    if (!dest.startsWith(root + sep)) {
      results.push({ status: 'skipped', path: fileName, reason: 'path escapes destination' });
      continue;
    }

    const existing = readFileSafe(dest);
    if (existing !== null && !existing.includes(SYNC_MARKER)) {
      results.push({ status: 'skipped', path: dest, reason: 'exists and was not created by sync — left untouched' });
      continue;
    }

    const content = withMarker(file.content, sourceUrl);
    if (existing === content) continue;
    if (!dry) writeFileSafe(dest, content, { force: true });
    results.push({ status: 'written', path: dest });
  }
  return results;
}

/** Add the sync marker after any frontmatter so rule parsing is unaffected. */
function withMarker(content, sourceUrl) {
  const marker = `${SYNC_MARKER} from ${sourceUrl.replace(/--/g, '%2D%2D')} — edits will be overwritten by \`cortex sync\` -->`;
  const text = String(content).replace(/\r\n?/g, '\n');
  const fm = text.match(/^---\n[\s\S]*?\n---[ \t]*\n/);
  if (fm) return `${fm[0]}${marker}\n${text.slice(fm[0].length)}`;
  return `${marker}\n${text}`;
}

// ── Fetching ───────────────────────────────────────────────────────────────

/**
 * Shallow-clone (or fast-forward) a repo into the cache, then read its
 * rules/ or skills/ (or .cortex/rules/ …) markdown files.
 */
function fetchGitSource(url, cacheDir, type, dry) {
  if (dry) {
    dim(`  Would clone ${url} and sync ${type}/`);
    return [];
  }

  mkdirSync(cacheDir, { recursive: true });
  const repoDir = join(cacheDir, sourceSlug(url));
  const gitOpts = {
    timeout: 60000,
    stdio: 'pipe',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  };

  try {
    if (existsSync(join(repoDir, '.git'))) {
      dim(`  Updating cached repo: ${sourceSlug(url)}`);
      try {
        execFileSync('git', ['-C', repoDir, 'pull', '--ff-only', '--depth', '1'], gitOpts);
      } catch {
        rmSync(repoDir, { recursive: true, force: true });
      }
    }
    if (!existsSync(join(repoDir, '.git'))) {
      dim(`  Cloning ${url}...`);
      execFileSync('git', ['clone', '--depth', '1', '--', url, repoDir], gitOpts);
    }
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('git is not installed');
    const detail = String(err.stderr || '').trim().split('\n').pop();
    throw new Error(`git clone failed${detail ? `: ${detail}` : ''}`);
  }

  for (const dir of [join(repoDir, type), join(repoDir, '.cortex', type)]) {
    if (existsSync(dir)) return readDirFiles(dir);
  }
  dim(`  No ${type}/ directory found in ${url}`);
  return [];
}

/** Fetch a single markdown file over https. */
async function fetchHttpFile(url, dry) {
  if (dry) {
    dim(`  Would fetch ${url}`);
    return [];
  }

  dim(`  Fetching ${url}...`);
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(`request failed (${err.cause?.code || err.name || 'network error'})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.url && !res.url.startsWith('https:')) throw new Error('redirected to a non-https URL');

  const content = await res.text();
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('file is too large');

  const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  return [{ name: name || 'remote', content }];
}

function readDirFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Regular files only — symlinks could point outside the clone
    if (!entry.isFile() || !/\.(md|markdown|txt)$/i.test(entry.name)) continue;
    const content = readFileSync(join(dir, entry.name), 'utf-8');
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) continue;
    files.push({ name: entry.name, content });
  }
  return files;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return ['local'];
  return [value];
}
