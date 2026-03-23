# Project Rules
# These rules are compiled into provider-specific config files.
# Edit this file to customize AI behavior in your project.

## Code Style
- Follow the existing code style and conventions in this project
- Use meaningful variable and function names
- Keep functions focused and small
- Don't refactor code unrelated to the current task

## Architecture
- Follow the existing project architecture patterns
- Don't introduce new dependencies without discussion
- Prefer composition over inheritance
- Only add abstractions when there's a clear immediate need

## Testing
- Write tests for new features and bug fixes
- Maintain existing test coverage
- Verify changes work before marking complete

## Documentation
- Add comments only where the logic isn't self-evident
- Update README when adding new features

## Safety
- Never commit secrets, API keys, or credentials
- Validate all external input at system boundaries
- Don't bypass safety checks or linters
- Make small, reversible changes — commit before big refactors

## AI Interaction
- Complete the full implementation — do not leave TODOs or placeholders
- Show your reasoning when making non-obvious decisions
- If uncertain about requirements, state assumptions explicitly
- Prefer reading existing code before modifying it
