# Skill: Stack Selection for AI Products
# Decide stack, LLM, and data layer before implementation.

## Purpose
Help users pick an execution-ready stack for AI applications with clear trade-offs.

## Instructions
When a user asks to build AI features, run this sequence:
1. Clarify product type: chat app, agent workflow, API backend, automation, or internal tool.
2. Clarify constraints: budget, latency target, team skill level, compliance needs, and expected scale.
3. Propose a stack matrix with at least 3 options:
   - Fastest-to-ship
   - Most scalable
   - Most cost-efficient
4. For each option, include:
   - Frontend stack
   - Backend stack
   - LLM provider and model class
   - Database and vector store
   - Auth strategy
   - Deployment target
5. Explicitly call out lock-in risks and migration path.
6. Ask the user to choose one option before writing production code.

## Output Format
- Use a decision table with columns: Area, Option A, Option B, Option C.
- End with a recommendation and why it fits the user's constraints.
- Include "if this fails" fallback guidance.

## Pitfalls to Surface
- Picking a model before defining latency and cost budgets
- Mixing transactional DB and vector DB requirements without boundaries
- Overengineering with microservices too early
- Ignoring observability, guardrails, and eval loops

## Expansion Paths
- Add multi-model routing when traffic and budget justify it
- Split read/write data planes after scale inflection
- Introduce background orchestration for long-running agent jobs
