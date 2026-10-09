# AI Dev Team SaaS

Hosted multi-agent orchestration with risk gates.

Submit a development goal → six specialized agents reach consensus → risk is scored → safe steps auto-execute, dangerous ones escalate to a human.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy (Vercel)

```bash
npx vercel --yes
```

Or connect the repo in the Vercel dashboard.

## API

`POST /api/runs`

```json
{
  "goal": "Ship the parser feature",
  "steps": [
    { "id": "s1", "description": "Write unit tests for the new parser module" },
    { "id": "s2", "description": "Deploy the updated auth service to production" }
  ]
}
```
