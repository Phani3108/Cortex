export type ToolResult = {
  tool: string;
  output: string;
};

const TOOLS: Record<string, (input: string) => ToolResult> = {
  summarize: input => ({ tool: 'summarize', output: `Summary: ${input.slice(0, 80)}` }),
  checklist: input => ({ tool: 'checklist', output: `Checklist: clarify, implement, verify for ${input}` }),
};

export function runTool(name: string, input: string): ToolResult {
  const tool = TOOLS[name];
  if (!tool) {
    throw new Error(`Unsupported tool: ${name}`);
  }
  return tool(input);
}
