# Lane A Rules

## Contracts First
- Define endpoint request and response schemas before coding.
- Return structured error payloads with stable error codes.

## Safety
- Validate all external input at the API boundary.
- Keep a deterministic fallback response path for invalid or missing context.

## Delivery
- Keep the first release focused on one user goal.
- Add tests for malformed input and empty payloads.
