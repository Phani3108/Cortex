// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex init — Initialize .cortex/ in the current project or globally.
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getCortexDir, writeFileSafe, findProjectRoot } from '../utils/fs.js';
import { heading, success, info, warn, fileCreated, fileSkipped, dryRun, dim } from '../utils/log.js';
import { getDefaultConfigString } from '../core/config.js';
import { getDefaultProfileString } from '../core/profile.js';

export default async function init({ values, positionals }) {
  const isGlobal = values.global;
  const force = values.force;
  const dry = values.dry;

  if (isGlobal) {
    await initGlobal({ force, dry });
  } else {
    await initProject({ force, dry });
  }
}

async function initProject({ force, dry }) {
  const projectRoot = findProjectRoot();
  const cortexDir = getCortexDir(projectRoot);

  heading('Initializing cortex for project');
  info(`Project root: ${projectRoot}`);

  // Detect project info
  const detected = detectProject(projectRoot);
  if (detected.language) {
    info(`Detected: ${detected.language}${detected.framework ? ` / ${detected.framework}` : ''}`);
  }

  const files = [
    {
      path: join(cortexDir, 'config.yaml'),
      content: getDefaultConfigString({
        project: {
          name: detected.name || null,
          language: detected.language || null,
          framework: detected.framework || null,
        },
      }),
    },
    {
      path: join(cortexDir, 'rules', 'project.md'),
      content: readTemplate('rules/default.md'),
    },
    {
      path: join(cortexDir, 'skills', '.gitkeep'),
      content: '',
    },
  ];

  let created = 0;
  for (const file of files) {
    if (dry) {
      dryRun(`Would create ${file.path}`);
      created++;
    } else {
      const result = writeFileSafe(file.path, file.content, { force });
      if (result) {
        fileCreated(file.path);
        created++;
      } else {
        fileSkipped(file.path);
      }
    }
  }

  console.log();
  if (created > 0) {
    success(`Initialized .cortex/ with ${created} files`);
  } else {
    warn('All files already exist. Use --force to overwrite.');
  }

  // Manage .gitignore — offer to add generated provider files
  if (!dry) {
    updateGitignore(projectRoot);
  }

  dim('Next: edit .cortex/config.yaml, then run `cortex compile`');
}

async function initGlobal({ force, dry }) {
  const cortexDir = getCortexDir(null, true);

  heading('Initializing global cortex profile');
  info(`Directory: ${cortexDir}`);

  const files = [
    {
      path: join(cortexDir, 'profile.yaml'),
      content: getDefaultProfileString(),
    },
    {
      path: join(cortexDir, 'rules', '.gitkeep'),
      content: '',
    },
    {
      path: join(cortexDir, 'skills', '.gitkeep'),
      content: '',
    },
  ];

  let created = 0;
  for (const file of files) {
    if (dry) {
      dryRun(`Would create ${file.path}`);
      created++;
    } else {
      const result = writeFileSafe(file.path, file.content, { force });
      if (result) {
        fileCreated(file.path);
        created++;
      } else {
        fileSkipped(file.path);
      }
    }
  }

  console.log();
  if (created > 0) {
    success(`Global profile initialized with ${created} files`);
  } else {
    warn('All files already exist. Use --force to overwrite.');
  }

  dim('Next: edit ~/.cortex/profile.yaml with your preferences');
}

function detectProject(root) {
  const result = { name: null, language: null, framework: null };

  // Package.json
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      result.name = pkg.name || null;
      result.language = existsSync(join(root, 'tsconfig.json')) ? 'TypeScript' : 'JavaScript';

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) result.framework = 'Next.js';
      else if (deps.react) result.framework = 'React';
      else if (deps.vue) result.framework = 'Vue';
      else if (deps.svelte) result.framework = 'Svelte';
      else if (deps.express) result.framework = 'Express';
      else if (deps.fastify) result.framework = 'Fastify';
      else if (deps.astro) result.framework = 'Astro';
    } catch { /* ignore parse errors */ }
  }

  // Python
  if (!result.language && existsSync(join(root, 'pyproject.toml'))) {
    result.language = 'Python';
    if (existsSync(join(root, 'manage.py'))) result.framework = 'Django';
  }
  if (!result.language && existsSync(join(root, 'requirements.txt'))) {
    result.language = 'Python';
  }

  // Rust
  if (!result.language && existsSync(join(root, 'Cargo.toml'))) {
    result.language = 'Rust';
  }

  // Go
  if (!result.language && existsSync(join(root, 'go.mod'))) {
    result.language = 'Go';
  }

  // Ruby
  if (!result.language && existsSync(join(root, 'Gemfile'))) {
    result.language = 'Ruby';
    if (existsSync(join(root, 'config', 'application.rb'))) result.framework = 'Rails';
  }

  // Java
  if (!result.language && (existsSync(join(root, 'pom.xml')) || existsSync(join(root, 'build.gradle')))) {
    result.language = 'Java';
  }

  return result;
}

function readTemplate(name) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(__dirname, '..', '..', 'templates', ...name.split('/'));
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }
  return `# ${name}\n`;
}

/**
 * Ensure .gitignore includes cortex-specific entries.
 * Adds entries for: generated provider files, sync cache, compile manifest.
 * Preserves existing .gitignore content.
 */
function updateGitignore(projectRoot) {
  const gitignorePath = join(projectRoot, '.gitignore');

  // Only manage gitignore if this is a git repo
  if (!existsSync(join(projectRoot, '.git'))) return;

  const marker = '# cortex — auto-generated provider files';
  const entries = [
    marker,
    '# These are compiled from .cortex/ sources. Commit .cortex/ instead.',
    '.cortex/.compile-manifest.json',
    '.cortex/.sync-cache/',
    '.cortex/history/',
  ];

  let existing = '';
  if (existsSync(gitignorePath)) {
    existing = readFileSync(gitignorePath, 'utf-8');
    // Don't duplicate if we already added our section
    if (existing.includes(marker)) return;
  }

  const newContent = existing
    ? existing.trimEnd() + '\n\n' + entries.join('\n') + '\n'
    : entries.join('\n') + '\n';

  writeFileSync(gitignorePath, newContent, 'utf-8');
  dim('  Updated .gitignore with cortex entries');
}
