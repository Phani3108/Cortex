export type ToolCall = {
  name: string;
  input: Record<string, unknown>;
};

export type ToolResult = {
  name: string;
  output: Record<string, unknown>;
};

export const TOOL_CONTRACTS: Record<string, { requiredKeys: string[] }> = {
  echo: { requiredKeys: ['message'] },
  analyzeGoal: { requiredKeys: ['goal'] },
};

export function validateToolCall(call: ToolCall): string | null {
  const contract = TOOL_CONTRACTS[call.name];
  if (!contract) return 'unknown tool';

  for (const key of contract.requiredKeys) {
    if (!(key in call.input)) {
      return `missing required key: ${key}`;
    }
  }
  return null;
}
