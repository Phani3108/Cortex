// ─────────────────────────────────────────────────────────────────────────────
// Cortex — Universal AI Context Engine
// Copyright (c) 2026 Phani Marupaka. All rights reserved.
// Created & Developed by Phani Marupaka (https://linkedin.com/in/phani-marupaka)
// Licensed under MIT — see LICENSE for terms. Attribution required.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * cortex profile — View or edit your personal AI profile.
 */

import { existsSync } from 'node:fs';
import { loadProfile, saveProfile, getDefaultProfileString } from '../core/profile.js';
import { getCortexDir } from '../utils/fs.js';
import { heading, info, warn, success, dim, table } from '../utils/log.js';
import { stringify } from '../utils/yaml.js';

export default async function profile({ values, positionals }) {
  const subcommand = positionals[0]; // show, set, edit, reset

  switch (subcommand) {
    case 'set':
      return setProfileValue(positionals.slice(1));
    case 'reset':
      return resetProfile(values);
    case 'show':
    default:
      return showProfile();
  }
}

function showProfile() {
  const profileData = loadProfile();

  heading('AI Profile');

  if (!profileData._exists) {
    warn('No profile found. Run `cortex init --global` to create one.');
    dim(`Expected at: ${profileData._path}`);
    return;
  }

  info(`Location: ${profileData._path}`);
  console.log();

  const { _path, _exists, ...data } = profileData;
  console.log(stringify(data));
  console.log();
}

function setProfileValue(args) {
  if (args.length < 2) {
    warn('Usage: cortex profile set <key> <value>');
    dim('Example: cortex profile set style.tone concise');
    dim('Example: cortex profile set name "Your Name"');
    return;
  }

  const [keyPath, ...valueParts] = args;
  const value = valueParts.join(' ');
  const profileData = loadProfile();

  if (!profileData._exists) {
    warn('No profile found. Run `cortex init --global` first.');
    return;
  }

  // Set nested value
  const keys = keyPath.split('.');
  let obj = profileData;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;

  saveProfile(profileData, { force: true });
  success(`Set ${keyPath} = ${value}`);
}

function resetProfile(values) {
  const profileData = loadProfile();

  if (!profileData._exists) {
    warn('No profile to reset.');
    return;
  }

  if (!values.force) {
    warn('This will reset your profile to defaults. Use --force to confirm.');
    return;
  }

  saveProfile(profileData, { force: true });
  success('Profile reset to defaults');
}
