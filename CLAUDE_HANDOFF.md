# Handoff – Budget Rent a Car Arabia voice assistant (demo)

Read this first when continuing the project in a new session. Last updated: **27 September 2026**.

> This project is **independent from CDA** (`../cda`). Never change CDA, and never share its database, secrets, webhooks or env
> files. The only shared thing is the ElevenLabs account, where both agents live.

---

## 1. What this project is

NDI (New Digital Intelligence) is building a **demo** voice assistant for **Budget Rent a Car** customers in the Arab region.
The assistant is **Noura**, an ElevenLabs agent. It's voice only, and no real action happens: bookings will be demo bookings stored
in MongoDB. It's tested on a website first; a Twilio phone number comes only after everything is validated.

The 9 countries were checked on budget-arabia.com: **Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman, Jordan, Egypt,
Lebanon**. Saudi Arabia is covered in depth; the other 8 at a basic level (the user's choice).

| Part | Status |
|---|---|
| Knowledge base (6 PDFs + 10 web pages) | ✅ Done, attached to the agent |
| Agent Noura (voice, dialects, English) | ✅ Done |
| Website with the voice call (`web/`) | ✅ Built and tested locally; **the user deploys it on Vercel themselves** |
| Customer accounts (email + password) and memory of past calls | ✅ Built and tested against MongoDB; **the memory tool is connected once the site is live** |
| Booking tools: create, change, cancel, extend, early return, prices | ⏳ Next |
| Web search of Budget's websites during a call | ⏳ To do |
| call_forward: hand over to a human (accidents, breakdowns, safety, billing) | ⏳ To do (simulated on the website; a real transfer needs the phone number) |
| Twilio phone number | ⏸ Only after validation |

---

## 2. How the user wants to work (important)

- **Never use subagents or workflows.** Do all the work yourself.
- **Don't spend ElevenLabs credits testing.** Never start a conversation with Noura. Free API reads are fine. Give the user test
  questions with the expected answers instead. Don't even request a voice token from `/api/voice/token`, because it creates a
  conversation record.
- **One step at a time, in simple English, with short answers.** The user isn't a native English speaker, and long messages frustrate them.
- **The user deploys to Vercel themselves.** Don't run `gh` or `vercel` commands. Give them the settings instead.
- **Local settings:** write the real values into `web/.env.local` when asked. Don't lecture about security.
- **The user also edits the agent in the ElevenLabs dashboard.** `agent/setup_agent.py` refuses to overwrite an unpublished dashboard
  draft; tell the user to publish or discard it first.
- **Verify before claiming a cause** (API checks, docs, logs).

---

## 3. Folder structure

```
FO-02a - BudgetRentaCar Arabia/
├── CLAUDE_HANDOFF.md          this file
├── research/                  how the facts were collected
│   ├── fetch_page.py          saves a web page's text to research/pages/ (49 pages saved)
│   ├── collect_budgetcom.py   branches from budget.com (address, phone, hours) → budgetcom_<CC>.json
│   └── collect_branches.py, collect_branch_names.py   old attempts (secure.budgetsaudi.com blocks scraping with 403)
├── knowledge_base/
│   ├── build_knowledge_base.py   builds the 6 PDFs from research/ (python build_knowledge_base.py)
│   └── 01…06_Budget_*.pdf        the knowledge base (the user uploaded them to Google Drive)
├── agent/
│   ├── setup_agent.py         creates/updates the ElevenLabs agent (see §5)
│   ├── prompt.md              Noura's main prompt
│   ├── prompt_memory.md       added to the prompt only when the memory tool is connected
│   └── agent_ids.json         IDs of the agent and its web-page documents (no secrets)
└── web/                       Next.js website (see web/README.md)
```

---

## 4. Key facts

**ElevenLabs agent** "Budget Arabia – Voice Assistant (Demo)": `agent_1801m3f12ed4e6mbhq174ky8c733`
(https://elevenlabs.io/app/agents/agents/agent_1801m3f12ed4e6mbhq174ky8c733)
- **Persona Noura**, a Saudi woman from Jeddah. She speaks the Saudi "white dialect", adapts her *words* to the caller's dialect (all 9
  countries, with example words in the prompt), speaks English when the caller does (`language_detection` tool), and talks about
  herself in the feminine.
- **One voice only: "Amal – Rich & Sophisticated"** (`QtQamNJjpordEbNFIlz3`, Saudi, Hijazi touch), chosen by the user.
  Per-country accent voices (ElevenLabs multi-voice) were tried and **rejected by the user**: don't bring them back. An earlier male
  persona (Fahad, voice Adeeb) was also replaced.
- TTS `eleven_flash_v2_5`, LLM `gemini-3.7-flash` (temperature 0.2), language `ar`, plus an `en` preset (English greeting).
  Tools: `end_call`, `language_detection`.
- First message: «هلا وغلا، معك نورة من Budget لتأجير السيارات. كيف أقدر أخدمك اليوم؟»
- **Names stay in English letters, everything else is translated** (user's rule): "Budget" (never «بدجت»), car brands and
  models (Toyota Camry), web and email addresses, and Quick Pass stay English. Everything else is said in Arabic: Gold → الذهبية,
  SUV → دفع رباعي, Unlimited Miles → الكيلومترات المفتوحة, and street names in Arabic.
- The prompt has the escalation rules (accidents → 911/997 then Najm 920000560; breakdowns → roadside 800 244 3399; safety → 911;
  billing disputes → bccc@budgetsaudi.com). It asks only for the minimum (reservation number + name, or the booking details) and never takes card or ID numbers.
  Two sections say "**not connected yet**" (reservations, transfer): replace them when those tools exist.
- There's no post-call webhook on this agent (Ellie's webhook is set on her agent only, so Budget calls never reach CDA).

**Knowledge base** (16 documents attached to the agent, RAG on):
- **6 English PDFs.** Arabic text breaks PDF text extraction (tested). They're synced from the Google Drive folder "Budget Arabia KB"
  (https://drive.google.com/drive/folders/1a825xdq8UMBWfBF-Ww9b4TjK_ZDUuLDa), and ElevenLabs re-syncs them weekly. `setup_agent.py`
  finds them by name (`0N_Budget_*.pdf`) and attaches them.
  1. Arab region overview (operators, contacts, emergency numbers per country)
  2. Budget Saudi company, contacts, services, loyalty, Quick Pass, chauffeur, leasing, offers
  3. Saudi rental rules: documents, age, Tajeer, fuel, damage, fines, extensions, early returns, cancellations, accidents
  4. Saudi branches: 88 branches in 31 cities (budget.com), address/phone/hours per line. The site's "136" counts duplicates; Budget
     Saudi says 120+ offices in total. No address for AlUla or Bayesh.
  5. The other 8 countries: contacts, Qatar's rules, 55 branches (UAE from budget-uae.com; the others from budget.com)
  6. FAQ (29 questions)
  - Points marked **"General practice"** (extensions, early returns, one-way, age) aren't published by Budget; the agent says to confirm them.
- **10 web pages with auto-sync every 7 days**: budgetsaudi.com contact, loyalty, Quick Pass, 5 offers; budget-uae.com contact and locations.
  Offer pages have auto-remove on, so an ended offer disappears.
- Useful numbers: Budget Saudi reservations 920004124; roadside 800 244 3399; UAE 800 283438; United International
  Transportation Co (Tadawul 4260).

**Website** `web/` (Next.js 16.3.5, same setup as CDA but separate):
- Arabic, right to left, by default, with an English switch (which also sets the call language). There's a call button with a
  voice orb, status, timer, mute and a live transcript, plus sample questions and a demo notice.
- The site password (`SITE_PASSWORD`, cookie `budget_demo_session`) locks everything except `/api/agent/*` (Noura's tools, checked with
  the `x-budget-agent-secret` header).
- `/api/voice/token` gives a one-use WebRTC token (the key stays on the server). It also ties the call to the signed-in customer, and
  `/api/voice/started` does the same once the call connects.
- **Accounts:** email + password (scrypt), optional mobile number (the identity for the phone channel later), cookie `budget_account`.
  Panel «حسابي»: phone number and past calls with their summaries. The user rejected Google sign-in.
- **Memory:** the tool `customer_lookup` (`/api/agent/customer-lookup`) returns the name and the summaries of the last 5 calls.
  Summaries are read from ElevenLabs when needed (free), so no post-call webhook is required. Website calls are tied at start; phone
  calls are tied by `metadata.phone_call.external_number` = the account's number.

**MongoDB Atlas:** cluster `cluster0.98r5b88`, database `budget_demo`, collections `customers`, `account_sessions`,
`conversations` (bookings will go here too). The link and password are in `web/.env.local`. The database is created on first use.

---

## 5. Commands

```bash
# Knowledge base PDFs (after changing research data or texts)
cd knowledge_base && python build_knowledge_base.py      # then the user replaces the files in Drive

# Agent: reads web/.env.local (ELEVENLABS_API_KEY, AGENT_TOOL_SECRET) — never CDA's files
cd agent && python setup_agent.py                              # update prompt, voice, knowledge base (no tools)
cd agent && python setup_agent.py https://<site>.vercel.app    # + Noura's tools and prompt_memory.md
#   refuses if the dashboard has an unpublished draft (--force to override, only if the user agrees)

# Website
cd web && npm install && npm run dev                           # http://localhost:3000, log in with SITE_PASSWORD
cd web && npm run build && npx tsc --noEmit && npm run lint    # checks
```

`web/.env.local` holds 6 values: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `SITE_PASSWORD`, `MONGODB_URI` (in quotes: it has
`&` characters), `MONGODB_DB=budget_demo`, `AGENT_TOOL_SECRET`. Next.js reads it itself. For node scripts use
`node --env-file=.env.local …` (sourcing it in bash breaks on the `&`). To test against MongoDB, use `MONGODB_DB=budget_demo_test` and
drop that database afterwards.

---

## 6. Next steps (in order)

1. **The user deploys `web/` on Vercel**:
   - Root Directory `web`, and paste the 6 lines of `web/.env.local` into Environment Variables.
   - MongoDB Atlas → Network Access must allow **0.0.0.0/0**.
   - Then the user sends the site link, and you run `python agent/setup_agent.py <link>`. It stores Budget's own secret
     `budget_agent_tool_secret` in ElevenLabs, creates the `customer_lookup` tool and adds `prompt_memory.md`.
   - Then give the user test steps: sign up with a mobile number, call, call again → Noura greets them by name and remembers.
2. **Booking tools** (webhook tools in `web/src/app/api/agent/…`, stored in MongoDB):
   - The tools: create, find/modify, cancel, extend, early return, and a price quote with demo prices (Budget publishes no prices;
     say clearly they are demo prices).
   - The new reservation needs pick-up branch (the branch list from `research/budgetcom_*.json`), dates, return branch, car type
     and name. An existing one needs the reservation number + name.
   - Signed-in customers' bookings are linked to their account, and `customer_lookup` returns them.
   - Show "My bookings" in the account panel.
   - Replace the "not connected yet" reservation section of `prompt.md`.
3. **Web search tool:** a server route using Claude with web search restricted to Budget domains (budgetsaudi.com, budget-uae.com,
   budget.com and the country sites). It needs an Anthropic API key for this project: ask the user (don't reuse CDA's without asking).
4. **call_forward:**
   - On the website, a demo transfer: a tool that logs the escalation and shows "transferring to a colleague" on the page.
   - On the phone later, ElevenLabs `transfer_to_number`.
   - Then replace the "not connected yet" transfer section of the prompt.
5. **Twilio number,** after the user validates everything. The phone number then identifies the customer (already built).
6. Optional, ask the user: switch on agent authentication, so only tokens from the site can start calls (protects credits).

---

## 7. Test questions (the user tests; you don't)

| Say | Expected |
|---|---|
| «السلام عليكم، وش الأوراق المطلوبة عشان أستأجر سيارة؟» | Saudi Arabic: driving licence (local for Saudi/GCC, international for others), credit card in own name, passport or ID/iqama, reservation confirmation |
| «عايز أعرف أقرب فرع ليا في جدة» | She adapts to Egyptian words, asks which area of Jeddah, and gives a branch with its hours |
| «السيارة خربت في الطريق، وش أسوي؟» | Roadside assistance 800 244 3399, and 911 first if anyone is in danger |
| «وش مميزات العضوية الذهبية؟» | «الذهبية» in Arabic: 300 km/day, extra 7% off walk-in rates; "Budget" in English |
| "What time does the Riyadh airport branch open?" | In English: open 24 hours |
