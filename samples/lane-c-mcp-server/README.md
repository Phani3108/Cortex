# Lane C: MCP Server

This sample demonstrates a contract-first MCP-style server surface.

## Run

```bash
npm install
npm run dev
```

## Endpoints
- `GET /mcp/tools/list`
- `POST /mcp/tools/run`

## Example

```bash
curl -X POST http://localhost:8082/mcp/tools/run \
  -H 'content-type: application/json' \
  -d '{"name":"echo","input":{"message":"hello"}}'
```

## Cortex Setup

```bash
cortex compile
```
