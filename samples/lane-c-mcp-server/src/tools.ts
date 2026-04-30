import type { ToolCall, ToolResult } from './contracts.js';

export function listTools() {
  return [
    { name: 'echo', version: '1.0.0' },
    { name: 'analyzeGoal', version: '1.0.0' },
  ];
}

export function runTool(call: ToolCall): ToolResult {
  if (call.name === 'echo') {
    return { name: 'echo', output: { echoed: call.input.message } };
  }

  if (call.name === 'analyzeGoal') {
    const goal = String(call.input.goal || '');
    return {
      name: 'analyzeGoal',
      output: {
        intent: goal.length > 40 ? 'complex' : 'simple',
        recommendation: 'define contracts before scaling workflows',
      },
    };
  }

  throw new Error('tool not implemented');
}
