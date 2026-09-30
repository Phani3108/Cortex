// Example .cortex/ sources for the playground.
export const PRESETS = {
  next: {
    config: { project: { name: 'storefront', language: 'TypeScript', framework: 'Next.js' } },
    files: {
      '.cortex/rules/project.md': `# Project rules

## Architecture
- Business logic lives in \`src/services/\`; route handlers stay thin
- Server Components by default; add "use client" only for interactivity
- Don't add a dependency without a one-line justification in the PR

## Code style
- TypeScript strict mode: no \`any\` without a comment explaining why
- Named exports only
- Prefer early returns over nested conditionals

## Safety
- ! Never commit secrets, API keys or \`.env\` files
- ! Validate all external input at the boundary (zod schemas in \`src/schemas/\`)

## Testing
- Every bug fix ships with a failing test first
- Use pnpm and vitest; run \`pnpm test\` before calling work done
`,
      '.cortex/rules/react.md': `---
scope: ["src/**/*.tsx"]
description: React component conventions
---
# React components

## Components
- Keep components under 150 lines; extract hooks for stateful logic
- Co-locate component tests as \`*.test.tsx\`
- Use the design-system primitives in \`src/ui/\` before writing new CSS
`,
      '.cortex/skills/code-review.md': `---
name: code-review
description: Review a diff for correctness, security and maintainability before merge.
---
# Code review

1. Read the diff top to bottom; list behaviour changes.
2. Check error handling, input validation and secrets.
3. Flag missing tests for changed behaviour.
4. Suggest the smallest fix for each finding.
`,
    },
  },
  python: {
    config: { project: { name: 'billing-api', language: 'Python', framework: 'FastAPI' } },
    files: {
      '.cortex/rules/project.md': `# Project rules

## Architecture
- FastAPI routers in \`app/api/\`, domain logic in \`app/services/\`, persistence in \`app/repos/\`
- Every endpoint declares Pydantic request and response models
- Use dependency injection for DB sessions; never create sessions in handlers

## Data
- ! Money is stored as integer cents, never floats
- Alembic migration for every schema change; no manual ALTER TABLE

## Testing
- pytest with the \`client\` fixture; one test per behaviour
- Use uv for dependencies (\`uv add\`, \`uv run pytest\`)
`,
      '.cortex/rules/migrations.md': `---
scope: ["alembic/versions/*.py"]
---
# Migrations

## Rules
- Migrations must be reversible: implement \`downgrade()\`
- Never drop a column in the same release that stops writing to it
`,
    },
  },
  monorepo: {
    config: { project: { name: 'platform', language: 'TypeScript', framework: 'Turborepo' } },
    files: {
      '.cortex/rules/project.md': `# Platform monorepo

## Structure
- Apps in \`apps/*\`, shared packages in \`packages/*\`; apps never import from other apps
- Cross-package imports go through each package's public \`index.ts\`

## Workflow
- Run \`pnpm turbo run lint test --filter=...[HEAD^]\` before pushing
- ! Never edit generated files in \`packages/sdk/src/gen/\` — regenerate them
`,
      '.cortex/rules/api.md': `---
scope: ["apps/api/**"]
---
# API service

## Rules
- Return RFC 7807 problem+json for errors
- Every new endpoint needs an OpenAPI entry in \`apps/api/openapi.yaml\`
`,
      '.cortex/skills/release.md': `---
name: release
description: Cut a release — changelog, version bump, tag — following the team's checklist.
---
# Release checklist

1. \`pnpm changeset version\` and review the generated CHANGELOG entries.
2. Confirm CI is green on main.
3. Tag \`vX.Y.Z\` and push; the release workflow publishes packages.
`,
      '.cortex/skills/incident.md': `---
name: incident
description: Triage a production incident — stabilise, communicate, then find root cause.
---
# Incident triage

1. Stabilise first (rollback or feature flag), then investigate.
2. Post a status update every 30 minutes.
3. Write a blameless postmortem within 48 hours.
`,
    },
  },
  blank: {
    config: { project: { name: '', language: '', framework: '' } },
    files: {
      '.cortex/rules/project.md': `# Project rules

## General
- Add your rules here as bullet points
- ! Prefix a rule with "!" to mark it as critical
`,
    },
  },
};
