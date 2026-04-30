# Lane A: Assistant App + API

This sample is the smallest complete assistant lane using TypeScript + Fastify + OpenAPI.

## Run

```bash
npm install
npm run dev
```

## Endpoints
- `GET /health`
- `POST /assist`

## Example Request

```bash
curl -X POST http://localhost:8080/assist \
  -H 'content-type: application/json' \
  -d '{"goal":"Design a safe API launch plan","context":"B2B SaaS"}'
```

## Cortex Setup

```bash
cortex compile
```

This sample includes a preconfigured `.cortex/` folder with skills focused on stack selection, tutorial delivery, and API contract discipline.
