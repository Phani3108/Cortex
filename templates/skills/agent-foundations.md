# Skill: Agent Foundations
# Build basic AI agents safely and incrementally.

## Purpose
Guide users through a phased agent build from single-task assistant to multi-step workflow agent.

## Phases
1. Phase 1 - Single Skill Agent
   - One clear objective
   - One input schema
   - One output schema
2. Phase 2 - Tool-Using Agent
   - Add 2-3 trusted tools
   - Add tool selection rules
   - Add timeout and retry policy
3. Phase 3 - Workflow Agent
   - Add planner + executor separation
   - Add memory boundaries and context windows
   - Add checkpoints for human review
4. Phase 4 - Production Agent
   - Add evals, telemetry, fallback model, and incident playbook

## Instructions
When building an agent:
1. Start by defining the agent contract:
   - Goal
   - Input schema
   - Output schema
   - Error schema
2. Force deterministic interfaces for tool calls.
3. Add explicit stop conditions.
4. Add a "safe mode" where the agent can only suggest actions.
5. Require tests for:
   - Tool failure
   - Hallucinated parameters
   - Empty or malformed user input

## Pitfalls to Surface
- Letting the model invent tool names or arguments
- No budget and token limits per interaction
- No isolation between system instructions and user content
- No fallback behavior when tool calls fail

## Expansion Paths
- Add role-based agent permissions
- Add queue-based execution for long tasks
- Add evaluator agent for post-run quality checks
