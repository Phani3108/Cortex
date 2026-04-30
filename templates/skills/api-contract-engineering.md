# Skill: API Contract Engineering
# Design, review, and evolve API contracts for AI systems.

## Purpose
Create robust API contracts that support agent workflows, MCP tools, and external integrations.

## Instructions
When asked to create or edit API contracts:
1. Begin with contract-first design using OpenAPI or JSON Schema.
2. Define versioning strategy before endpoint design.
3. For each endpoint, include:
   - Request schema
   - Response schema
   - Error schema
   - Idempotency behavior
   - Rate limit behavior
4. Add examples for success and failure cases.
5. Require compatibility notes for contract edits.
6. Add migration notes when introducing breaking changes.

## Review Checklist
- Are field names stable and descriptive?
- Are nullable fields explicit?
- Are enum values future-safe?
- Is pagination strategy consistent?
- Are authentication and authorization requirements explicit?

## Pitfalls to Surface
- Ambiguous error payloads
- Backward-incompatible field renames
- Missing idempotency keys for write endpoints
- Unbounded list endpoints with no pagination

## Expansion Paths
- Add async callback/webhook contracts
- Add event schemas for pub-sub integration
- Add consumer-driven contract tests
