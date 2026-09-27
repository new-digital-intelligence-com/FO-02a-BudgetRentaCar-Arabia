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
| Website with the voice call (`web/`) | ✅ Live: https://fo-02a-budget-renta-car-arabia.vercel.app (**the user deploys it on Vercel themselves**) |
| Customer accounts (email + password) and memory of past calls | ✅ Live; memory tool `customer_lookup` connected, **tested by the user: it works** (27 Sep 2026) |
| Booking tools: price quote, create, find, change, extend, early return, cancel + «حجوزاتي» | ✅ Live and connected to Noura (27 Sep 2026). Waiting for the user's test (§7) |
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
│   ├── export_branches.py        writes web/src/data/branches.json (the bookable branches, same names/hours as the PDFs)
│   └── 01…06_Budget_*.pdf        the knowledge base (the user uploaded them to Google Drive)
├── agent/
│   ├── setup_agent.py         creates/updates the ElevenLabs agent (see §5)
│   ├── prompt.md              Noura's main prompt
│   ├── prompt_memory.md       added to the prompt only when the memory tool is connected
│   └── agent_ids.json         IDs of the agent and its web-page documents (no secrets)
└── web/                       Next.js website (see web/README.md)
    (web/AGENTS.md and web/CLAUDE.md are written by `next dev` itself: leave them)
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
- **Voice model: `eleven_v3_conversational`** (Eleven v3 Conversational) with `expressive_mode: true` (the API does not switch
  it on by itself), for Arabic and the English preset. **Tested and chosen by the user on 27 Sep 2026: keep it.** Same price per
  minute as Flash in Agents; about 280 ms latency. Amal is a Professional Voice Clone (ElevenLabs warns v3 may not reproduce
  PVCs faithfully), but the user is happy with how she sounds. If ever going back to Flash (constants at the top of
  `setup_agent.py`): `eleven_flash_v2_5` for Arabic and **`eleven_flash_v2`** for the English preset, because with the Flash
  models ElevenLabs refuses v2.5 for English ("English Agents must use turbo or flash v2", checked with a temporary agent); a
  call started with the site's English switch stayed silent because of it until that was fixed.
- Checked in the call history (27 Sep 2026): the English switch works (English greeting), and switching to English mid-call
  with `language_detection` works.
- LLM `gemini-3.7-flash` (temperature 0.2), language `ar`, plus an `en` preset (English greeting).
- The prompt tells Noura to check the language of every caller turn, the first one included (a caller who spoke English first
  got an Arabic greeting by name from the memory example).
  Tools: `end_call`, `language_detection`, and webhook tools that send Budget's workspace secret `budget_agent_tool_secret`
  (`kDD7VJi1KuChr5aFjPSO`) as `x-budget-agent-secret`: `customer_lookup` (`tool_1801m3hd188yfw8r1csg63cffe4m`) and the 7
  booking tools `get_price_quote`, `create_booking`, `find_booking`, `change_booking`, `extend_rental`, `early_return`,
  `cancel_booking` (IDs in `agent_ids.json`). All tools are defined in the `TOOLS` table of `setup_agent.py`. ElevenLabs refuses
  a `description` next to a `dynamic_variable` in a tool's body schema. `setup_agent.py` checks for a dashboard draft before
  changing anything.
- The prompt gives Noura the current time with `{{system__time}}` (agent timezone Asia/Riyadh), so she can turn "next Thursday" into a date.
- First message: «هلا وغلا، معك نورة من Budget لتأجير السيارات. كيف أقدر أخدمك اليوم؟»
- **Names stay in English letters, everything else is translated** (user's rule): "Budget" (never «بدجت»), car brands and
  models (Toyota Camry), web and email addresses, and Quick Pass stay English. Everything else is said in Arabic: Gold → الذهبية,
  SUV → دفع رباعي, Unlimited Miles → الكيلومترات المفتوحة, and street names in Arabic.
- The prompt has the escalation rules (accidents → 911/997 then Najm 920000560; breakdowns → roadside 800 244 3399; safety → 911;
  billing disputes → bccc@budgetsaudi.com). It asks only for the minimum (reservation number + name, or the booking details) and never takes card or ID numbers.
  The reservation section now explains the booking tools. The transfer section still says "**not connected yet**": replace it
  when call_forward exists.
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

**Demo bookings** (`web/src/lib/bookings.ts`, one route `/api/agent/bookings/<quote|create|find|change|extend|early-return|cancel>`):
- **140 bookable branches** in the 9 countries (`web/src/data/branches.json`): the budget.com ones from the knowledge-base data
  (minus "At Your Door" delivery), plus the 12 UAE locations of budget-uae.com (codes `AE-…`, no published hours). Branches are
  found by code (JED) or by words ("Jeddah airport", «مطار جدة», "Tahlia Street"); Arabic and other spellings of cities work.
  When several fit, the tool returns `branch_not_clear` with the options.
- **Checks:** opening hours (parsed from budget.com; unknown hours are never refused), the branch's own time zone (Egypt and
  Lebanon have summer time), at least 1 hour of notice, up to 1 year ahead, 60 days at most, return in the same country.
- **Demo prices** (`web/src/lib/pricing.ts`), per 24 h with 1 h of grace, in SAR: economy 120, compact 150, family sedan 190,
  SUV 280, van 330, luxury 600. 15% off from 7 days, 30% off from 28 days, one-way fee 250 to another city, then VAT. Other
  countries: converted to their currency at fixed rates, with their VAT (Lebanon in USD).
- **6-digit reservation numbers.** An existing booking needs the number + the name on it (any spelling: Mohammed = Muhammad =
  محمد), except a known customer's own bookings. Change and cancel only before pick-up (cancel is free); extend before or
  during; early return only during, price recalculated on the days used. Status comes from the times: upcoming, in progress,
  completed, cancelled.
- A problem is a normal answer `{ok: false, error, message}`: the `message` tells Noura what to ask. Only a crash is `system_error`.
- Bookings made in a call tied to an account are linked to it: «حجوزاتي» / "My bookings" in the account panel, and `customer_lookup`
  returns the upcoming ones.

**MongoDB Atlas:** cluster `cluster0.98r5b88`, database `budget_demo`, collections `customers`, `account_sessions`,
`conversations`, `bookings`. The link and password are in `web/.env.local`. The database is created on first use.

---

## 5. Commands

```bash
# Knowledge base PDFs (after changing research data or texts)
cd knowledge_base && python build_knowledge_base.py      # then the user replaces the files in Drive
cd knowledge_base && python export_branches.py           # after changing branch data: the website's bookable branches

# Agent: reads web/.env.local (ELEVENLABS_API_KEY, AGENT_TOOL_SECRET) — never CDA's files
cd agent && python setup_agent.py      # update prompt, voice, knowledge base, Noura's tools and prompt_memory.md
#   the site link is saved in agent_ids.json ("site_url"); pass a new link only if the site address changes:
#   python setup_agent.py https://<new-site>.vercel.app
#   on Windows, prefix with PYTHONIOENCODING=utf-8 (the output has "–" characters)
#   refuses if the dashboard has an unpublished draft (--force to override, only if the user agrees)

# Website
cd web && npm install && npm run dev                           # http://localhost:3000, log in with SITE_PASSWORD
cd web && npm run build && npx tsc --noEmit && npm run lint    # checks
```

`web/.env.local` holds 6 values: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `SITE_PASSWORD`, `MONGODB_URI` (in quotes: it has
`&` characters), `MONGODB_DB=budget_demo`, `AGENT_TOOL_SECRET`. Next.js reads it itself. For node scripts use
`node --env-file=.env.local …` (sourcing it in bash breaks on the `&`). To test against MongoDB, use `MONGODB_DB=budget_demo_test` and
drop that database afterwards.

**How the booking tools were tested (27 Sep 2026)**, without spending credits: test scripts in the session's scratch folder (not
kept in the project), run with `npx tsx --tsconfig tsconfig.json --test <file>` from `web/` (add `--env-file=.env.local` and
`MONGODB_DB=budget_demo_test` for the database tests): 8 logic tests (names, time zones, branch search, hours, prices, rules) and
7 database tests (create, repeat, find, change, extend, early return, cancel, customer_lookup). Then the routes over HTTP on
`next dev` (port 3107, test database) and screenshots of the panel with Edge through `playwright-core` (`channel: "msedge"`).

---

## 6. Next steps (in order)

1. ~~**Deploy on Vercel and connect the memory tool**~~ ✅ Done on 27 Sep 2026. Checked on the live site (free): the password lock,
   the tool secret (401 without it, 200 with it), and MongoDB access from Vercel. The user tested it (sign up, call, call again →
   Noura greets them by name and remembers the first call): it works.
   - Vercel settings for later: Root Directory `web`, the 6 lines of `web/.env.local` in Environment Variables, and MongoDB
     Atlas → Network Access allows **0.0.0.0/0**.
   - After a code change that adds env values, the user adds them in Vercel and redeploys.
2. ~~**Booking tools**~~ ✅ Done on 27 Sep 2026: the user pushed and deployed (commit "booking"; the repo's remote is
   github.com/new-digital-intelligence-com/FO-02a---BudgetRentaCar-Arabia, and Vercel deploys on push; commit or push only if
   the user asks). Live routes checked (free), then `setup_agent.py` created the 7 tools and sent the new prompt. The user now
   tests with §7. Rule for later tool changes: **deploy the website first, then run `setup_agent.py`**, never the other way.
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

Booking tests, signed in on the site:

| Say | Expected |
|---|---|
| «أبغى أحجز سيارة من مطار جدة يوم الخميس الساعة عشرة الصبح لثلاث أيام» | She asks the car type, gives a total with «سعر تجريبي», asks the driver's name, repeats everything, books after your yes, and gives a 6-digit number in two groups. It appears in «حجوزاتي» |
| «أبغى أحجز من مطار الرياض» | She asks which one: Terminal 5, or the international airport (terminals 1 and 2) |
| A pick-up at the Abha Andalus Park branch on a Friday at 10 in the morning | Closed: she gives Friday's hours (16:30 to 23:00) and asks for another time |
| Call again: «أبغى أغيّر حجزي لسيارة دفع رباعي» | She knows your booking (no number needed), confirms it, gives the new price, changes it after your yes |
| «أبغى أمدد الحجز يوم زيادة» / «أبغى ألغي الحجز» | New return date and extra cost / free cancellation after your yes |
| Signed out: «عندي حجز رقم …» with a wrong name | She asks for the name again and never says the real one |
| "I'd like to book an SUV in Dubai" | English, prices in dirhams (AED) |
