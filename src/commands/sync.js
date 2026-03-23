/**
 * cortex sync — Sync skills/rules from upstream sources.
 *
 * Supports:
 * - local: No-op (already on disk)
 * - https://github.com/... : Git clone/pull into a cache, copy rules/skills
 * - https://raw.githubusercontent.com/... or any URL: HTTP fetch single file
 */

import { join, basename } from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { findProjectRoot, getCortexDir, writeFileSafe, readFileSafe } from '../utils/fs.js';
import { loadConfig } from '../core/config.js';
import { heading, info, warn, success, error, dim, fileCreated } from '../utils/log.js';

const CACHE_DIR_NAME = '.sync-cache';

export default async function sync({ values }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);
  const dry = values.dry;

  if (!existsSync(cortexDir)) {
    error('.cortex/ not found. Run `cortex init` first.');
    process.exit(1);
  }

  heading('Syncing from upstream sources');

  const config = loadConfig(projectRoot);
  const cacheDir = join(cortexDir, CACHE_DIR_NAME);

  let synced = 0;
  let failed = 0;

  // Sync rules
  const ruleSources = config.rules?.sources || ['local'];
  info(`Rule sources: ${ruleSources.join(', ')}`);

  for (const source of ruleSources) {
    if (source === 'local') {
      dim('  Local rules — nothing to sync');
      continue;
    }

    try {
      const files = await fetchSource(source, cacheDir, 'rules', dry);
      if (files.length > 0) {
        const destDir = join(cortexDir, 'rules');
        for (const file of files) {
          if (!dry) {
            writeFileSafe(join(destDir, file.name), file.content, { force: true });
          }
          fileCreated(join(destDir, file.name));
        }
        synced += files.length;
      }
    } catch (err) {
      warn(`Failed to sync ${source}: ${err.message}`);
      failed++;
    }
  }

  // Sync skills
  const skillSources = config.skills?.sources || ['local'];
  info(`Skill sources: ${skillSources.join(', ')}`);

  for (const source of skillSources) {
    if (source === 'local') {
      dim('  Local skills — nothing to sync');
      continue;
    }

    try {
      const files = await fetchSource(source, cacheDir, 'skills', dry);
      if (files.length > 0) {
        const destDir = join(cortexDir, 'skills');
        for (const file of files) {
          if (!dry) {
            writeFileSafe(join(destDir, file.name), file.content, { force: true });
          }
          fileCreated(join(destDir, file.name));
        }
        synced += files.length;
      }
    } catch (err) {
      warn(`Failed to sync ${source}: ${err.message}`);
      failed++;
    }
  }

  console.log();
  if (synced > 0) {
    success(`Synced ${synced} file(s)${failed > 0 ? `, ${failed} failed` : ''}`);
    dim('Run `cortex compile` to propagate synced rules to all providers.');
  } else if (failed > 0) {
    error(`${failed} source(s) failed to sync. Check URLs and network connectivity.`);
  } else {
    info('All sources are local. Add remote URLs to config.yaml to sync.');
    dim('Example in .cortex/config.yaml:');
    dim('  rules:');
    dim('    sources:');
    dim('      - local');
    dim('      - https://github.com/org/ai-rules');
  }
}

/**
 * Fetch files from a source URL.
 * Handles GitHub repos (git clone) and direct file URLs (HTTP fetch).
 */
async function fetchSource(source, cacheDir, type, dry) {
  if (isGitUrl(source)) {
    return fetchGitSource(source, cacheDir, type, dry);
  }
  return fetchHttpFile(source, type, dry);
}

/**
 * Clone or pull a Git repo into cache, then extract rules/ or skills/ files.
 */
function fetchGitSource(url, cacheDir, type, dry) {
  if (dry) {
    dim(`  Would clone ${url} and sync ${type}/`);
    return [];
  }

  mkdirSync(cacheDir, { recursive: true });

  // Derive a safe cache directory name from URL
  const repoName = url
    .replace(/\.git$/, '')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_');
  const repoDir = join(cacheDir, repoName);

  try {
    if (existsSync(join(repoDir, '.git'))) {
      // Already cloned — pull latest
      dim(`  Updating cached repo: ${repoName}`);
      execSync('git pull --ff-only 2>/dev/null', {
        cwd: repoDir,
        timeout: 30000,
        stdio: 'pipe',
      });
    } else {
      // Fresh clone (shallow for speed)
      dim(`  Cloning ${url}...`);
      execSync(`git clone --depth 1 ${JSON.stringify(url)} ${JSON.stringify(repoDir)} 2>/dev/null`, {
        timeout: 60000,
        stdio: 'pipe',
      });
    }
  } catch (err) {
    throw new Error(`Git operation failed: ${err.message}`);
  }

  // Look for rules/ or skills/ directory in the cloned repo
  const files = [];
  const sourceDir = join(repoDir, type);

  if (!existsSync(sourceDir)) {
    // Also look inside .cortex/ if the repo has that structure
    const altDir = join(repoDir, '.cortex', type);
    if (!existsSync(altDir)) {
      dim(`  No ${type}/ directory found in ${url}`);
      return files;
    }
    return readDirFiles(altDir);
  }

  return readDirFiles(sourceDir);
}

/**
 * Fetch a single file via HTTP (using Node's built-in fetch).
 */
async function fetchHttpFile(url, type, dry) {
  if (dry) {
    dim(`  Would fetch ${url}`);
    return [];
  }

  dim(`  Fetching ${url}...`);

  try {
    // Use child_process curl as a reliable fallback for older Node versions
    const content = execSync(`curl -fsSL ${JSON.stringify(url)} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 15000,
    });

    const name = basename(new URL(url).pathname) || `${type}-synced.md`;
    return [{ name, content }];
  } catch {
    throw new Error(`HTTP fetch failed for ${url}`);
  }
}

function isGitUrl(url) {
  return (url.endsWith('.git') ||
    url.match(/^https?:\/\/(github|gitlab|bitbucket)\.[a-z]+\/[^/]+\/[^/]+\/?$/));
}

function readDirFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.yaml'))) {
      files.push({
        name: entry.name,
        content: readFileSync(join(dir, entry.name), 'utf-8'),
      });
    }
  }
  return files;
}
