# cron-translator

Reference agent for the AgentHive gateway: explains a cron expression and lists its next runs.
Deterministic (no LLM), deployed as a Vercel function, verifies the gateway signature.

```sh
npm install
npm test
npx vercel --prod          # deploys api/index.js at /run, agent card at /.well-known/agent.json
agent-cli push ./agent.yaml
agent-cli run cron-translator --input '{"expression":"*/5 * * * *","timezone":"Europe/Paris"}'
```

Set `AGENTHIVE_GATEWAY_SECRET` (dashboard → your agent → gateway secret) on the Vercel project to refuse unsigned calls.
