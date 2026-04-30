import { runTool } from './tools.js';

export type WorkflowInput = {
  goal: string;
  mode: 'safe' | 'execute';
};

export type WorkflowOutput = {
  plan: string[];
  executed: string[];
};

export function runWorkflow(input: WorkflowInput): WorkflowOutput {
  const plan = [
    'Validate user goal and constraints.',
    'Select minimal tool chain for the task.',
    'Run tools with deterministic inputs.',
    'Return structured output with warnings.',
  ];

  if (input.mode === 'safe') {
    return { plan, executed: [] };
  }

  const executed = [
    runTool('summarize', input.goal).output,
    runTool('checklist', input.goal).output,
  ];

  return { plan, executed };
}
