# Skill: Test-Driven Development
# Write tests before implementation. Red → Green → Refactor.

## Purpose
Drive design through tests to produce well-structured, verifiable code.

## Instructions
When implementing a feature or fix using TDD:
1. **Red** — Write a failing test that defines the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the implementation while keeping tests green
4. Repeat for the next behavior

## Test Writing Guidelines
- Test behavior, not implementation details
- Each test should verify one thing
- Use descriptive test names: `should_reject_invalid_email_format`
- Structure tests as Arrange → Act → Assert
- Mock external dependencies (APIs, databases, file system)
- Include edge cases: empty input, null, boundary values, unicode
- Test error paths, not just happy paths

## Coverage Strategy
- Prioritize tests for business logic and data transformations
- Integration tests for API boundaries and database queries
- Unit tests for pure functions and algorithms
- Don't test framework internals or third-party library behavior
