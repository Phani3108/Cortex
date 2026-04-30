import Fastify from 'fastify';
import { listTools, runTool } from './tools.js';
import { validateToolCall } from './contracts.js';

const app = Fastify({ logger: false });

app.get('/health', async () => ({ ok: true }));

app.get('/mcp/tools/list', async () => ({ data: listTools() }));

app.post('/mcp/tools/run', async (request, reply) => {
  const body = request.body as { name?: string; input?: Record<string, unknown> };
  if (!body?.name || !body.input) {
    reply.status(400);
    return { error: { code: 'INVALID_INPUT', message: 'name and input are required' } };
  }

  const validationError = validateToolCall({ name: body.name, input: body.input });
  if (validationError) {
    reply.status(400);
    return { error: { code: 'INVALID_TOOL_CALL', message: validationError } };
  }

  return { data: runTool({ name: body.name, input: body.input }) };
});

const port = Number.parseInt(process.env.PORT || '8082', 10);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  console.error(err);
  process.exit(1);
});
