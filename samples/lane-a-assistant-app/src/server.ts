import Fastify from 'fastify';
import { runAssistant } from './agent.js';

const app = Fastify({ logger: false });

app.get('/health', async () => ({ ok: true }));

app.post('/assist', async (request, reply) => {
  const body = request.body as { goal?: string; context?: string };

  if (!body || typeof body.goal !== 'string' || !body.goal.trim()) {
    reply.status(400);
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'goal is required and must be a non-empty string',
      },
    };
  }

  const result = runAssistant({ goal: body.goal, context: body.context });
  return { data: result };
});

const port = Number.parseInt(process.env.PORT || '8080', 10);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  console.error(err);
  process.exit(1);
});
