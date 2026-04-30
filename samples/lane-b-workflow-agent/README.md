# Lane B: Workflow Agent

This sample adds a planner + deterministic tool execution path on top of the baseline stack.

## Run

```bash
npm install
npm run dev
```

## Endpoint
- `POST /workflow/run` with `{ "goal": "...", "mode": "safe|execute" }`

## Safety Shape
- `safe` mode only plans and does not execute tools.
- `execute` mode runs a fixed tool whitelist.

## Cortex Setup

```bash
cortex compile
```
