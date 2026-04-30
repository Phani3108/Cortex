export type AssistInput = {
  goal: string;
  context?: string;
};

export type AssistOutput = {
  summary: string;
  steps: string[];
  warnings: string[];
};

export function runAssistant(input: AssistInput): AssistOutput {
  const trimmedGoal = input.goal.trim();
  const context = (input.context || '').trim();

  const warnings: string[] = [];
  if (trimmedGoal.length < 10) {
    warnings.push('Goal is short. Clarify expected output and constraints.');
  }
  if (!context) {
    warnings.push('No context provided. Add product scope, stack, and success criteria.');
  }

  return {
    summary: `Plan for: ${trimmedGoal}`,
    steps: [
      'Define the smallest executable user flow.',
      'Define request/response contracts before writing implementation.',
      'Implement one endpoint with validation and fallback behavior.',
      'Add tests for malformed input and timeout paths.',
    ],
    warnings,
  };
}
