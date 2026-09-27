# Budget Arabia – voice assistant demo (web)

A password-protected page where visitors talk to **Noura**, the Arabic voice assistant of Budget Rent a Car
(ElevenLabs agent `agent_1801m3f12ed4e6mbhq174ky8c733`, set up by `../agent/setup_agent.py`). NDI demo, not an official
Budget website.

- Arabic (right to left) by default, English switch. The switch also sets the call language (the agent's `en` preset).
- The browser gets a one-use WebRTC token from `/api/voice/token`; the ElevenLabs API key stays on the server.
- Every page and route is behind `SITE_PASSWORD` (`src/proxy.ts`); without it the site stays locked. The only exception is
  `/api/agent/*` (Noura's tools, called by ElevenLabs), which checks the `x-budget-agent-secret` header instead.
- Customer accounts (email + password) in MongoDB. A signed-in customer's calls are remembered: Noura's `customer_lookup`
  tool returns their name and the summaries of their last calls. On the phone (later, Twilio) the caller is recognised by
  the mobile number saved in their account. Collections: `customers`, `account_sessions`, `conversations`.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Deploy on Vercel

1. New project → import this folder. If the repository holds the whole Budget project, set **Root Directory** to `web`.
2. Framework preset: Next.js (detected). No build settings to change.
3. Environment variables:

| Name | Value |
|---|---|
| `ELEVENLABS_API_KEY` | The ElevenLabs API key (same account as the agent) |
| `ELEVENLABS_AGENT_ID` | `agent_1801m3f12ed4e6mbhq174ky8c733` |
| `SITE_PASSWORD` | The password visitors type to open the demo |
| `MONGODB_URI` | The MongoDB Atlas link (Atlas → Network Access must allow 0.0.0.0/0 for Vercel) |
| `MONGODB_DB` | `budget_demo` |
| `AGENT_TOOL_SECRET` | The same value as in `.env.local` (Noura's tools send it) |

4. Deploy. After changing a variable later, redeploy.
5. Connect Noura's tools to the live site: `python ../agent/setup_agent.py https://<your-site>.vercel.app`

Checks before deploying: `npm run build`, `npx tsc --noEmit`, `npm run lint`.
