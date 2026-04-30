import Fastify from 'fastify';
import { runWorkflow } from './workflow.js';

const app = Fastify({ logger: false });

app.get('/health', async () => ({ ok: true }));

app.post('/workflow/run', async (request, reply) => {
  const body = request.body as { goal?: string; mode?: 'safe' | 'execute' };
  if (!body?.goal || typeof body.goal !== 'string') {
    reply.status(400);
    return { error: { code: 'INVALID_INPUT', message: 'goal is required' } };
  }

  try {
    const output = runWorkflow({ goal: body.goal, mode: body.mode || 'safe' });
    return { data: output };
  } catch (err) {
    reply.status(500);
    return {
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: err instanceof Error ? err.message : 'unknown error',
      },
    };
  }
});

const port = Number.parseInt(process.env.PORT || '8081', 10);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  console.error(err);
  process.exit(1);
});
